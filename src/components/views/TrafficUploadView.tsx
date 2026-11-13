import React, { useEffect, useState } from 'react'
import { Alert, ConfigProvider, Table, message } from 'antd'
import type { TableProps } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { CheckCircleOutlined, CloseCircleOutlined, SearchOutlined } from '@ant-design/icons'
import { ColumnSearchDropdown } from '../ColumnSearchDropdown'
import { FileDropzone, SampleDownload } from '../FileDropzone'
import type { StagedReport } from '../FileDropzone'
import useStore from '../../store/store'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { extractErrorMessage } from '../../utils/api'
import { formatJakarta } from '../../utils/date'
import type { TrafficUploadResult, UploadJob } from '../../types/upload'
import { BRAND_PRIMARY } from '../../theme'

type TrafficMarketplace = 'Shopee' | 'Tokopedia' | 'Lazada' | 'TikTok Shop' | 'Blibli'

// Traffic exports are per platform, so TikTok Shop and Tokopedia are separate channels here
const MARKETPLACES: { name: TrafficMarketplace; code: string; color: string; channel: string; source: string }[] = [
  { name: 'Shopee', code: 'SP', color: 'orange', channel: 'shopee', source: 'Business Insights › Traffic Overview' },
  { name: 'Tokopedia', code: 'TK', color: 'emerald', channel: 'tokopedia', source: 'Seller Center › Data Compass' },
  { name: 'Lazada', code: 'LZ', color: 'blue', channel: 'lazada', source: 'Business Advisor › Kunci Metrik' },
  { name: 'TikTok Shop', code: 'TT', color: 'slate', channel: 'tiktok', source: 'Seller Center › Data Compass' },
  { name: 'Blibli', code: 'BL', color: 'sky', channel: 'blibli', source: 'Seller Analytics › Traffic' },
]

interface FileResult {
  fileName: string
  marketplace: string
  result?: TrafficUploadResult
  error?: string
}

const dateLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export const TrafficUploadView: React.FC = () => {
  const { uploadTraffic, getTrafficUploads } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const [selected, setSelected] = useState<TrafficMarketplace>('Shopee')
  const [isUploading, setIsUploading] = useState(false)
  const [results, setResults] = useState<FileResult[]>([])

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)
  const [filters, setFilters] = useState<Record<string, FilterValue | null>>({})
  const [sorter, setSorter] = useState<SorterResult<UploadJob> | null>(null)
  const [history, setHistory] = useState<{ records: UploadJob[]; total: number }>({ records: [], total: 0 })
  const [reloadTick, setReloadTick] = useState(0)

  const marketplace = MARKETPLACES.find((m) => m.name === selected)!

  const payload = {
    page,
    size: pageSize,
    filter: Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value && value[0] !== undefined && value[0] !== '')
        .map(([key, value]) => [key, String(value![0])])
    ),
    sort: sorter?.order && sorter.columnKey
      ? { [String(sorter.columnKey)]: sorter.order === 'ascend' ? 'asc' : 'desc' }
      : {},
  }
  const requestKey = JSON.stringify({ ...payload, reloadTick })
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    const { reloadTick: _tick, ...body } = JSON.parse(requestKey)
    void _tick
    getTrafficUploads(authToken.access_token, body)
      .then(setHistory)
      .catch((err) => message.error(extractErrorMessage(err, 'Failed to load traffic uploads')))
      .finally(() => setLoadedKey(requestKey))
  }, [requestKey, authToken.access_token, getTrafficUploads])

  const handleFiles = async (files: File[], report: StagedReport) => {
    setIsUploading(true)
    const done: FileResult[] = []
    // One at a time: overlapping exports of the same marketplace then resolve in the order listed
    for (const [index, file] of files.entries()) {
      report(index, 'uploading')
      try {
        const result = await uploadTraffic(authToken.access_token, file, { channel: marketplace.channel })
        done.push({ fileName: file.name, marketplace: selected, result })
        report(index, 'done', `${result.days} day${result.days === 1 ? '' : 's'} loaded`)
      } catch (err) {
        const error = extractErrorMessage(err, 'Upload failed.')
        done.push({ fileName: file.name, marketplace: selected, error })
        report(index, 'failed', error)
      }
    }
    setIsUploading(false)
    setResults(done)
    const loaded = done.filter((d) => d.result)
    if (loaded.length) {
      const days = loaded.reduce((sum, d) => sum + d.result!.days, 0)
      message.success(`${days} day${days === 1 ? '' : 's'} of ${selected} traffic loaded`)
    }
    if (loaded.length < done.length) message.error(`${done.length - loaded.length} file(s) could not be loaded`)
    setPage(1)
    setReloadTick((t) => t + 1)
  }

  const columns: TableProps<UploadJob>['columns'] = [
    {
      title: 'File',
      dataIndex: 'fileName',
      key: 'fileName',
      width: 300,
      sorter: true,
      sortOrder: sorter?.columnKey === 'fileName' ? sorter.order : null,
      filteredValue: filters.fileName ?? null,
      filterDropdown: (props) => <ColumnSearchDropdown {...props} label="file name" />,
      filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? BRAND_PRIMARY : undefined }} />,
      render: (name: string) => <span className="job-filename">{name}</span>,
    },
    {
      title: 'Marketplace',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 150,
      filters: MARKETPLACES.map((m) => ({ text: m.name, value: m.name })),
      filteredValue: filters.marketplace ?? null,
      sorter: true,
      sortOrder: sorter?.columnKey === 'marketplace' ? sorter.order : null,
      render: (mkt: string) => (
        <span className={`mkt-tag mkt-tag-${mkt.toLowerCase().replace(/[^a-z]/g, '')}`}>{mkt}</span>
      ),
    },
    {
      title: 'Days Loaded',
      key: 'details',
      render: (_, record) => (
        <div className="job-records-cell">
          <span className="job-size">{record.size}</span>
          {record.recordsSummary && <> • <span className={record.status === 'Failed' ? 'text-danger' : ''}>{record.recordsSummary}</span></>}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      filters: [{ text: 'Completed', value: 'Completed' }, { text: 'Failed', value: 'Failed' }],
      filteredValue: filters.status ?? null,
      render: (status: string) =>
        status === 'Failed' ? (
          <span className="status-tag status-failed"><CloseCircleOutlined style={{ fontSize: 13 }} /> Failed</span>
        ) : (
          <span className="status-tag status-completed">
            <CheckCircleOutlined style={{ fontSize: 13, color: '#059669' }} /> Loaded
          </span>
        ),
    },
    {
      title: 'Uploaded',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 200,
      render: (value: string) => <span className="text-xs">{formatJakarta(value)}</span>,
    },
  ]

  return (
    <ConfigProvider theme={{ token: { colorPrimary: BRAND_PRIMARY, borderRadius: 8 } }}>
      <div className="view-container upload-view">
        {/* Step 1: marketplace */}
        <div className="card marketplace-card">
          <div className="card-header-flex">
            <div>
              <h3 className="section-title">
                <span className="step-num">1</span>
                Select Marketplace
              </h3>
              <p className="section-desc">
                Choose the marketplace whose daily traffic (visitors) export you are uploading
              </p>
            </div>
            <span className="badge-active-mkt">
              Active: <strong>{selected}</strong>
            </span>
          </div>
          <div className="marketplace-grid">
            {MARKETPLACES.map((mkt) => (
              <button
                key={mkt.name}
                type="button"
                onClick={() => setSelected(mkt.name)}
                disabled={isUploading && selected !== mkt.name}
                className={`mkt-button ${selected === mkt.name ? 'selected' : ''} mkt-${mkt.color}`}
              >
                <div className={`mkt-avatar avatar-${mkt.color}`}>{mkt.code}</div>
                <span className="mkt-title">{mkt.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: upload */}
        <FileDropzone
          heading={<>Upload <span className="highlight-text">{selected}</span> Traffic Data</>}
          description={<>
            Export from <strong>{marketplace.source}</strong>. Daily visitors are loaded right away; days
            already loaded are updated. Supported formats: <strong>.XLSX</strong>, <strong>.XLS</strong>,{' '}
            <strong>.CSV</strong>
          </>}
          busy={isUploading}
          busyLabel="Loading..."
          staged
          onSubmit={handleFiles}
          submitLabel="Load"
          resetKey={selected}
          actions={
            <SampleDownload file={`traffic_${marketplace.channel}_sample.xlsx`}>
              Download {selected} Sample
            </SampleDownload>
          }
        />

        {results.length > 0 && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) =>
              r.result ? (
                <Alert
                  key={i}
                  type={r.result.skipped.length || r.result.warnings.length ? 'warning' : 'success'}
                  showIcon
                  closable
                  title={`${r.fileName}: ${r.result.days} days loaded (${dateLabel(r.result.periodStart)} – ${dateLabel(r.result.periodEnd)})`}
                  description={
                    <>
                      {r.result.inserted} new day(s), {r.result.updated} updated.
                      {r.result.skipped.map((s) => (
                        <div key={s.row}>Row {s.row} skipped: {s.reason}</div>
                      ))}
                      {r.result.warnings.map((w) => (
                        <div key={w}>{w}</div>
                      ))}
                    </>
                  }
                />
              ) : (
                <Alert key={i} type="error" showIcon closable title={`${r.fileName}: not loaded`} description={r.error} />
              )
            )}
          </div>
        )}

        {/* Step 3: history */}
        <div className="card pipeline-card">
          <div className="card-header-flex">
            <div>
              <h4 className="section-title">Traffic Uploads</h4>
              <p className="section-desc">Every traffic file loaded, newest first</p>
            </div>
            <span className="badge-count">{history.total} Uploads</span>
          </div>
          <Table<UploadJob>
            rowKey="id"
            columns={columns}
            dataSource={history.records}
            loading={loadedKey !== requestKey}
            pagination={{
              current: page,
              pageSize,
              total: history.total,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20'],
              showTotal: (total) => `Total ${total} uploads`,
            }}
            scroll={{ x: 'max-content' }}
            onChange={(pagination, nextFilters, nextSorter) => {
              const nextSorterResult = Array.isArray(nextSorter) ? nextSorter[0] ?? null : nextSorter
              const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(filters)
              const sorterChanged =
                nextSorterResult?.columnKey !== sorter?.columnKey || nextSorterResult?.order !== sorter?.order
              setFilters(nextFilters)
              setSorter(nextSorterResult)
              setPageSize(pagination.pageSize ?? pageSize)
              setPage(filtersChanged || sorterChanged ? 1 : (pagination.current ?? 1))
            }}
          />
        </div>
      </div>
    </ConfigProvider>
  )
}
