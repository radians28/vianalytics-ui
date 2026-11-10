import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, ConfigProvider, message } from 'antd'
import type { TableColumnType, TableProps } from 'antd'
import {
  RightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  SearchOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import { SkuSanitizeModal } from '../SkuSanitizeModal'
import { ColumnSearchDropdown } from '../ColumnSearchDropdown'
import { FileDropzone, SampleDownload } from '../FileDropzone'
import type { StagedReport } from '../FileDropzone'
import useStore from '../../store/store'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { extractErrorMessage } from '../../utils/api'

export type MarketplaceType =
  | 'Shopee'
  | 'Tokopedia'
  | 'Lazada'
  | 'TikTok Shop'
  | 'Blibli'
  // | 'Custom / Other'

export type ProcessingStatus =
  | 'Processing'
  | 'Paused'
  | 'Queued'
  | 'Completed'
  | 'Failed'

// Channel the svc processes each marketplace's export as. TikTok Shop and
// Tokopedia come in one merged export
const MARKETPLACE_CHANNELS: Record<MarketplaceType, string> = {
  Shopee: 'shopee',
  Tokopedia: 'tiktok_tokped',
  'TikTok Shop': 'tiktok_tokped',
  Lazada: 'lazada',
  Blibli: 'blibli',
}

// How often the pipeline table refreshes while jobs are queued or processing
const POLL_INTERVAL_MS = 10_000

export interface PipelineJob {
  id: string
  fifoOrder?: number
  fileName: string
  marketplace: MarketplaceType
  size: string
  recordsSummary: string
  status: ProcessingStatus
  statusDetail?: string
  timestamp: string
}

export const UploadView: React.FC = () => {
  const { getProgressUpload, uploadFile, jobs, totalJobs } = useStore();
  const [authToken] = useLocalStorage('access_token');
  const navigate = useNavigate()
  const [page, setPage] = useState(1);
      const [pageSize, setPageSize] = useState(5);
      const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
      const [sorter, setSorter] = useState<SorterResult<any> | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] =
    useState<MarketplaceType>('Shopee')
  const [isUploading, setIsUploading] = useState(false)
  const [selectedPausedJob, setSelectedPausedJob] = useState<PipelineJob | null>(
    null
  )
  // Per-column search dropdown for the Job File column
  const fileColumnSearchProps: TableColumnType<PipelineJob> = {
    filterDropdown: (props) => (
      <ColumnSearchDropdown {...props} label="file name" />
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#4f46e5' : undefined }} />
    ),
    onFilter: () => true,
  }

  const marketplaces: { name: MarketplaceType; code: string; color: string }[] =
    [
      { name: 'Shopee', code: 'SP', color: 'orange' },
      { name: 'Tokopedia', code: 'TK', color: 'emerald' },
      { name: 'Lazada', code: 'LZ', color: 'blue' },
      { name: 'TikTok Shop', code: 'TT', color: 'slate' },
      { name: 'Blibli', code: 'BL', color: 'sky' },
      // { name: 'Custom / Other', code: '+', color: 'indigo' },
    ]

  // Each staged file is its own request, so each becomes its own queue entry (and Airflow run)
  const queueFiles = async (files: File[], report: StagedReport) => {
    const channel = MARKETPLACE_CHANNELS[selectedMarketplace]
    setIsUploading(true)
    let queued = 0
    // One at a time so the files enter the FIFO queue in the order listed
    for (const [index, file] of files.entries()) {
      report(index, 'uploading')
      try {
        await uploadFile(authToken.access_token, file, { channel })
        queued += 1
        report(index, 'done', 'Queued')
      } catch (err) {
        report(index, 'failed', extractErrorMessage(err, 'Upload failed.'))
      }
    }
    setIsUploading(false)

    if (queued > 0) {
      message.success(`${queued} file${queued > 1 ? 's' : ''} queued for processing.`)
    }
    if (queued < files.length) {
      message.error(`${files.length - queued} file(s) could not be queued; retry them from the list.`)
    }
    fetchProgress()
  }

  // Ant Design Table Columns for Data Processing Pipeline
  const columns: TableProps<PipelineJob>['columns'] = [
    {
      title: 'Queue # / Job File',
      key: 'fileName',
      dataIndex: 'fileName',
      width: 260,
      sorter: true,
      sortOrder: sorter?.columnKey === 'fileName' ? sorter.order : null,
      filteredValue: filters.fileName ?? null,
      ...fileColumnSearchProps,
      render: (_, record) => {
        const isProcessing = record.status === 'Processing'
        const isPaused = record.status === 'Paused'
        const isQueued = record.status === 'Queued'

        return (
          <div className="job-file-cell">
            {isProcessing && (
              <span className="queue-pill pill-processing">#1 Now</span>
            )}
            {isPaused && (
              <span className="queue-pill pill-paused">Paused</span>
            )}
            {isQueued && (
              <span className="queue-pill pill-queued">
                #{record.fifoOrder || 2}
              </span>
            )}
            {record.status === 'Completed' && (
              <span className="queue-pill pill-completed">Done</span>
            )}
            <span className="job-filename">{record.fileName}</span>
          </div>
        )
      },
    },
    {
      title: 'Marketplace',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 150,
      filters: marketplaces.map((m) => ({ text: m.name, value: m.name })),
      onFilter: () => true,
      filteredValue: filters.marketplace ?? null,
      sorter: true,
      sortOrder: sorter?.columnKey === 'marketplace' ? sorter.order : null,
      render: (mkt: MarketplaceType) => (
        <span
          className={`mkt-tag mkt-tag-${mkt.toLowerCase().replace(/[^a-z]/g, '')}`}
        >
          {mkt}
        </span>
      ),
    },
    {
      title: 'Records & Ingestion Details',
      key: 'details',
      width: 340,
      render: (_, record) => (
        <div className="job-records-cell">
          <span className="job-size">{record.size}</span>
          {record.recordsSummary && (
            <>
              {' • '}
              <span
                className={
                  record.status === 'Paused' ? 'font-semibold text-danger' : ''
                }
              >
                {record.recordsSummary}
              </span>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 190,
      sorter: true,
      sortOrder: sorter?.columnKey === 'status' ? sorter.order : null,
      filters: [
        {
          text: 'Processing',
          value: 'Processing'
        }, {
          text: 'Paused',
          value: 'Paused'
        }, {
          text: 'Queued',
          value: 'Queued'
        }, {
          text: 'Completed',
          value: 'Completed'
        }, {
          text: 'Failed',
          value: 'Failed'
        },
      ],
      onFilter: () => true,
      filteredValue: filters.status ?? null,
      render: (status: ProcessingStatus) => {
        if (status === 'Processing') {
          return (
            <span className="status-tag status-processing-animated">
              <LoadingOutlined style={{ fontSize: 13 }} spin />
              Processing ETL
            </span>
          )
        }
        if (status === 'Paused') {
          return (
            <span className="status-tag status-paused-tag">
              <ExclamationCircleOutlined style={{ fontSize: 13 }} />
              Paused (Action Req.)
            </span>
          )
        }
        if (status === 'Queued') {
          return (
            <span className="status-tag status-queued-tag">
              <ClockCircleOutlined style={{ fontSize: 13 }} />
              Queued
            </span>
          )
        }
        if (status === 'Failed') {
          return (
            <span className="status-tag status-failed">
              <CloseCircleOutlined style={{ fontSize: 13 }} />
              Failed
            </span>
          )
        }
        return (
          <span className="status-tag status-completed">
            <CheckCircleOutlined style={{ fontSize: 13, color: '#059669' }} />
            Completed
          </span>
        )
      },
    },
    {
      title: 'Action / Resolution',
      key: 'action',
      align: 'right',
      fixed: 'right',
      width: 180,
      render: (_, record) => {
        if (record.status === 'Paused') {
          return (
            <button
              type="button"
              className="btn btn-warning-action"
              onClick={() => setSelectedPausedJob(record)}
            >
              <span>Validate & Sanitize</span>
              <RightOutlined style={{ fontSize: 11 }} />
            </button>
          )
        }
        if (record.status === 'Completed') {
          return (
            <Button
              type="link"
              size="small"
              onClick={() => navigate('/sku')}
              style={{ padding: 0, fontWeight: 600 }}
            >
              View in SKU Master →
            </Button>
          )
        }
        if (record.status === 'Processing') {
          return <span className="subtle-status">Auto-ingesting...</span>
        }
        if (record.status === 'Failed') {
          return (
            <span className="subtle-status" title={record.statusDetail}>
              Processing failed
            </span>
          )
        }
        return <span className="subtle-status">Waiting in queue</span>
      },
    },
  ]

  const fetchProgress = () => {
    const filterPayload = Object.fromEntries(
            Object.entries(filters)
                .filter(([, value]) => value && value[0] !== undefined && value[0] !== '')
                .map(([key, value]) => [key, value![0]])
        );
        const sortPayload = sorter?.order && sorter.columnKey
            ? { [String(sorter.columnKey)]: sorter.order === 'ascend' ? 'asc' : 'desc' }
            : {};

    getProgressUpload(authToken.access_token, {
      type: 'order',
      page,
            size: pageSize,
            filter: filterPayload,
            sort: sortPayload,
    });
  }

  useEffect(() => {
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters, sorter, authToken.access_token, getProgressUpload]);

  // Keep statuses fresh while Airflow works through the queue
  const hasActiveJobs = jobs.some((j) => j.status === 'Queued' || j.status === 'Processing')
  useEffect(() => {
    if (!hasActiveJobs) return
    const timer = window.setInterval(fetchProgress, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveJobs, page, pageSize, filters, sorter, authToken.access_token]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 8,
        },
      }}
    >
      <div className="view-container upload-view">
        {/* Step 1: Marketplace Selection */}
        <div className="card marketplace-card">
          <div className="card-header-flex">
            <div>
              <h3 className="section-title">
                <span className="step-num">1</span>
                Select Marketplace
              </h3>
              <p className="section-desc">
                Choose the marketplace whose order export you are uploading
              </p>
            </div>
            <span className="badge-active-mkt">
              Active: <strong>{selectedMarketplace}</strong>
            </span>
          </div>

          <div className="marketplace-grid">
            {marketplaces.map((mkt) => {
              const isSelected = selectedMarketplace === mkt.name
              return (
                <button
                  key={mkt.name}
                  type="button"
                  onClick={() => setSelectedMarketplace(mkt.name)}
                  disabled={isUploading && !isSelected}
                  className={`mkt-button ${isSelected ? 'selected' : ''} mkt-${mkt.color}`}
                >
                  <div className={`mkt-avatar avatar-${mkt.color}`}>{mkt.code}</div>
                  <span className="mkt-title">{mkt.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Upload Dropzone */}
        <FileDropzone
          heading={<>Upload <span className="highlight-text">{selectedMarketplace}</span> Order Data</>}
          description={<>
            Add one or more export files of this marketplace; each file is queued as its own job and
            processed in list order. Supported formats: <strong>.XLSX</strong>, <strong>.XLS</strong>, <strong>.CSV</strong>
          </>}
          busy={isUploading}
          staged
          onSubmit={queueFiles}
          submitLabel="Queue"
          resetKey={selectedMarketplace}
          actions={
            <SampleDownload file={`order_${MARKETPLACE_CHANNELS[selectedMarketplace]}_sample.xlsx`}>
              Download {MARKETPLACE_CHANNELS[selectedMarketplace] === 'tiktok_tokped' ? 'TikTok / Tokopedia' : selectedMarketplace} Sample
            </SampleDownload>
          }
        />

        {/* Step 3: Ant Design Data Processing Pipeline Table */}
        <div className="card pipeline-card">
          <div className="card-header-flex">
            <div>
              <h4 className="section-title">
                <span className="status-dot-pulse"></span>
                Data Processing Pipeline
              </h4>
              <p className="section-desc">
                Active ETL jobs are pinned to the top in execution order
              </p>
            </div>
            <span className="badge-count">{totalJobs} Total Jobs</span>
          </div>

          <Table<PipelineJob>
            rowKey="id"
            columns={columns}
            dataSource={jobs}
            pagination={{
                            current: page,
                            pageSize,
                            total: totalJobs,
                            showSizeChanger: true,
                            pageSizeOptions: ['5', '10', '20'],
                            showTotal: () => `Total ${totalJobs} jobs`,
                        }}
            scroll={{ x: 'max-content' }}
            rowClassName={(record) =>
              record.status === 'Paused'
                ? 'row-paused'
                : record.status === 'Processing'
                  ? 'row-processing'
                  : ''
            }
            onChange={(pagination, nextFilters, nextSorter) => {
                            const nextSorterResult = Array.isArray(nextSorter) ? nextSorter[0] ?? null : nextSorter;
                            const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(filters);
                            const sorterChanged =
                                nextSorterResult?.field !== sorter?.field ||
                                nextSorterResult?.order !== sorter?.order;

                            setFilters(nextFilters);
                            setSorter(nextSorterResult);
                            setPageSize(pagination.pageSize ?? pageSize);
                            // A new filter/sort makes the old page number meaningless, so jump back to page 1.
                            setPage(filtersChanged || sorterChanged ? 1 : (pagination.current ?? 1));
                        }}
          />
        </div>

        {/* Sku Sanitization Modal */}
        {selectedPausedJob && (
          <SkuSanitizeModal
            key={selectedPausedJob.id}
            uploadId={selectedPausedJob.id}
            fileName={selectedPausedJob.fileName}
            onClose={() => setSelectedPausedJob(null)}
            onChanged={fetchProgress}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
