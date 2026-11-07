import React, { useState } from 'react'
import { Alert, Button, Checkbox, Collapse, Modal, Popconfirm, Spin, Statistic, Table, Tag, Tooltip, message } from 'antd'
import type { TableProps } from 'antd'
import axios from 'axios'
import { FileDropzone, SampleDownload } from './FileDropzone'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { formatIdr } from '../utils/format'
import type { BundleUploadComponent, BundleUploadItem, BundleUploadReport } from '../types/sku'

interface BundleUploadModalProps {
  onClose: () => void
  onApplied: () => void
}

const FLAG_COLORS: Record<string, string> = {
  free_gift: 'green',
  equal_split: 'orange',
  price_gap: 'gold',
  nested_bundle: 'blue',
  qty_missing: 'red',
  dup_component: 'purple',
  component_price_missing: 'volcano',
}

const componentColumns: TableProps<BundleUploadComponent>['columns'] = [
  { title: '#', dataIndex: 'lineNo', key: 'lineNo', width: 48, align: 'center' },
  {
    title: 'Component Seller SKU',
    dataIndex: 'sellerSku',
    key: 'sellerSku',
    width: 170,
    render: (code: string, c) => (
      <>
        <span className="font-mono text-xs">{code}</span>
        {c.skuId === null && <Tag color="purple" style={{ marginLeft: 6, fontSize: 11 }}>new SKU</Tag>}
      </>
    ),
  },
  {
    title: 'Product Name',
    dataIndex: 'productName',
    key: 'productName',
    render: (name: string | null, c) => (
      <div style={{ minWidth: 180, maxWidth: 280, whiteSpace: 'normal' }}>
        {name ?? '—'}
        {c.dqFlags.map((f) => (
          <Tag key={f} color={FLAG_COLORS[f]} style={{ marginLeft: 6, fontSize: 11 }}>{f.replace(/_/g, ' ')}</Tag>
        ))}
      </div>
    ),
  },
  { title: 'Qty', dataIndex: 'qty', key: 'qty', width: 56, align: 'right' },
  {
    title: 'Unit Price',
    dataIndex: 'unitPrice',
    key: 'unitPrice',
    width: 110,
    align: 'right',
    render: (p: number | null) => (p === 0 ? <Tag color="green">Free</Tag> : formatIdr(p)),
  },
  {
    title: 'Price Ratio',
    dataIndex: 'priceRatio',
    key: 'priceRatio',
    width: 100,
    align: 'right',
    render: (r: number) => <span className="font-mono text-xs">{r.toFixed(2)}%</span>,
  },
]

const itemColumns: TableProps<BundleUploadItem>['columns'] = [
  {
    title: 'Bundle Seller SKU',
    dataIndex: 'skuCode',
    key: 'skuCode',
    width: 170,
    render: (code: string, item) => (
      <>
        <span className="font-mono text-xs">{code}</span>
        {item.skuId === null && <Tag color="purple" style={{ marginLeft: 6, fontSize: 11 }}>new SKU</Tag>}
      </>
    ),
  },
  {
    title: 'Bundle Product Name',
    dataIndex: 'productName',
    key: 'productName',
    render: (name: string | null) => <div style={{ maxWidth: 360, whiteSpace: 'normal' }}>{name ?? '—'}</div>,
  },
  {
    title: 'Components',
    key: 'components',
    width: 110,
    align: 'center',
    render: (_, item) => <Tag>{item.components.length}</Tag>,
  },
  {
    title: 'Loaded Lines',
    dataIndex: 'affectedLines',
    key: 'affectedLines',
    width: 110,
    align: 'right',
    render: (n: number) => (n ? n.toLocaleString('id-ID') : '—'),
  },
  {
    title: 'Action',
    dataIndex: 'replaces',
    key: 'replaces',
    width: 110,
    render: (replaces: boolean) =>
      replaces ? <Tag color="orange">Replace</Tag> : <Tag color="green">New bundle</Tag>,
  },
]

export const BundleUploadModal: React.FC<BundleUploadModalProps> = ({ onClose, onApplied }) => {
  const { uploadBundles } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const [file, setFile] = useState<File | null>(null)
  const [report, setReport] = useState<BundleUploadReport | null>(null)
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  // re-split order lines already loaded with these bundles (Airflow), off by default
  const [reconsolidate, setReconsolidate] = useState(false)

  const runPreview = async (files: File[]) => {
    const picked = files[0]
    setFile(picked)
    setReport(null)
    setFileError(null)
    setBusy('preview')
    try {
      setReport(await uploadBundles(authToken.access_token, picked, 'preview'))
    } catch (err) {
      setFileError(extractErrorMessage(err, 'The file could not be read'))
    } finally {
      setBusy(null)
    }
  }

  const apply = async () => {
    if (!file) return
    setBusy('apply')
    try {
      const result = await uploadBundles(authToken.access_token, file, 'apply', reconsolidate)
      const created = result.created?.length ?? 0
      message.success(`${result.bundles} bundle(s) saved${created ? `, ${created} new SKU(s) registered` : ''}`)
      if (result.reconsolidate?.triggered) {
        message.info(`Re-splitting stored orders of ${result.reconsolidate.changeIds.length} bundle(s) in the background`)
      } else if (result.reconsolidate) {
        message.warning(`Bundles saved, but the order re-split could not start: ${result.reconsolidate.error ?? 'unknown error'}. Retry from "Re-split status".`, 8)
      }
      onApplied()
      onClose()
    } catch (err) {
      // a 400 with row errors means the master changed since the preview: show them
      const errors = axios.isAxiosError(err) ? err.response?.data?.errors : undefined
      if (report && Array.isArray(errors)) setReport({ ...report, errors })
      message.error(extractErrorMessage(err, 'The bundles could not be saved'))
    } finally {
      setBusy(null)
    }
  }

  const errors = report?.errors ?? []
  const canApply = !!report && errors.length === 0 && busy === null

  return (
    <Modal
      open
      title="Upload SKU Bundling"
      width={980}
      style={{ top: 24 }}
      styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' } }}
      onCancel={busy ? undefined : onClose}
      maskClosable={false}
      footer={[
        <Button key="close" onClick={onClose} disabled={busy !== null}>
          Cancel
        </Button>,
        <Popconfirm
          key="apply"
          title="Save these bundles?"
          description={
            report
              ? `${report.replacedBundles} bundle(s) get their components replaced, ${report.newBundles} are new` +
                (report.newSkus.length ? `, ${report.newSkus.length} SKU(s) will be registered.` : '.')
              : ''
          }
          okText="Save"
          onConfirm={apply}
          disabled={!canApply}
        >
          <Tooltip title={errors.length ? 'Fix the errors in the file and upload it again' : undefined}>
            <Button type="primary" disabled={!canApply} loading={busy === 'apply'}>
              Save Bundles
            </Button>
          </Tooltip>
        </Popconfirm>,
      ]}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FileDropzone
          heading={file ? <>File: <span className="highlight-text">{file.name}</span></> : 'Upload a SKU bundling file'}
          description={<>
            One row per component: <strong>Bundle SKU, Bundle Product Name, Line No, Component SKU, Component
            Product Name, Qty, Unit Price</strong>. The price ratio is calculated from unit price × qty. Every
            bundle in the file gets its components replaced; other bundles stay as they are.
          </>}
          busy={busy !== null}
          busyLabel="Checking..."
          buttonLabel={file ? 'Choose Another File' : 'Select File'}
          multiple={false}
          onFiles={runPreview}
          actions={<>
            <SampleDownload file="sku_bundling_sample.xlsx">Sample (.xlsx)</SampleDownload>
            <SampleDownload file="sku_bundling_sample.csv">Sample (.csv)</SampleDownload>
          </>}
        />

        {busy === 'preview' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Spin /> Checking the file...</div>
        )}
        {fileError && <Alert type="error" showIcon title={fileError} />}

        {report && (
          <>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <Statistic title="Bundles" value={report.bundles} />
              <Statistic title="Components" value={report.components} />
              <Statistic title="Replaced" value={report.replacedBundles} />
              <Statistic title="New bundles" value={report.newBundles} />
              <Statistic title="New SKUs" value={report.newSkus.length} />
            </div>

            {report.affectedLines > 0 && (
              <Alert
                type="info"
                showIcon
                title={`${report.affectedLines.toLocaleString('id-ID')} order line(s) already loaded use these bundles`}
                description={
                  <Checkbox checked={reconsolidate} onChange={(e) => setReconsolidate(e.target.checked)}>
                    Re-split those orders with the new components (runs in the background; order totals stay the same)
                  </Checkbox>
                }
              />
            )}

            {errors.length > 0 ? (
              <Alert
                type="error"
                showIcon
                title={`${errors.length} problem(s) must be fixed before saving`}
                description={
                  <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
                    {errors.map((e, i) => (
                      <li key={i}>{e.row ? `Row ${e.row}: ` : ''}{e.message}</li>
                    ))}
                  </ul>
                }
              />
            ) : (
              <Alert type="success" showIcon title="The file is valid and ready to save" />
            )}

            <Collapse
              size="small"
              items={[
                ...(report.warnings.length
                  ? [{
                      key: 'warnings',
                      label: `Warnings (${report.warnings.length})`,
                      children: (
                        <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 160, overflowY: 'auto' }}>
                          {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      ),
                    }]
                  : []),
                ...(report.newSkus.length
                  ? [{
                      key: 'new',
                      label: `SKUs to register (${report.newSkus.length})`,
                      children: (
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {report.newSkus.map((n) => (
                            <li key={n.code}>
                              <span className="font-mono text-xs">{n.code}</span> — {n.name}{' '}
                              <Tag style={{ fontSize: 11 }}>{n.role}</Tag>
                              {n.freeGift && <Tag color="green" style={{ fontSize: 11 }}>free gift</Tag>}
                            </li>
                          ))}
                        </ul>
                      ),
                    }]
                  : []),
              ]}
            />

            <Table<BundleUploadItem>
              rowKey="skuCode"
              size="small"
              columns={itemColumns}
              dataSource={report.items}
              pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `${t} bundles in the file` }}
              expandable={{
                expandRowByClick: true,
                expandedRowRender: (item) => (
                  <Table<BundleUploadComponent>
                    rowKey="lineNo"
                    size="small"
                    columns={componentColumns}
                    dataSource={item.components}
                    pagination={false}
                  />
                ),
              }}
            />
          </>
        )}
      </div>
    </Modal>
  )
}
