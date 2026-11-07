import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Spin,
  Tag,
  Tooltip,
  message,
} from 'antd'
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { formatJakarta } from '../utils/date'
import type { SkuRow } from '../types/sku'
import type { SkuDecision, SkuReview, SkuReviewItem } from '../types/sku-review'

// What the admin picked for a pending listing: a suggested SKU, another SKU
// found by search, or a new SKU
type Mode = `cand:${number}` | 'other' | 'create'

const scoreTag = (score: number | null) => {
  if (score === null) return null
  const color = score >= 0.85 ? 'green' : score >= 0.7 ? 'gold' : 'default'
  return <Tag color={color}>{Math.round(score * 100)}% name match</Tag>
}

// ------------------------------------------------------------------ SKU picker

interface SkuSearchSelectProps {
  token: string
  value?: SkuRow
  disabled?: boolean
  onChange: (sku: SkuRow) => void
}

// Server-side search over SKU ID, latest and older seller SKUs and product name
const SkuSearchSelect: React.FC<SkuSearchSelectProps> = ({ token, value, disabled, onChange }) => {
  const { searchSkus } = useStore()
  const [options, setOptions] = useState<SkuRow[]>(value ? [value] : [])
  const [loading, setLoading] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const latestRequest = useRef(0)

  const search = (query: string) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const request = ++latestRequest.current
      setLoading(true)
      searchSkus(token, query)
        .then((rows) => {
          if (request === latestRequest.current) setOptions(rows)
        })
        .catch((err) => message.error(extractErrorMessage(err, 'SKU search failed')))
        .finally(() => {
          if (request === latestRequest.current) setLoading(false)
        })
    }, 300)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <Select<number>
      style={{ width: '100%' }}
      placeholder="Search SKU ID, seller SKU or product name"
      disabled={disabled}
      value={value?.id}
      showSearch={{ filterOption: false, onSearch: search }}
      onFocus={() => {
        if (options.length <= 1) search('')
      }}
      notFoundContent={loading ? <Spin size="small" /> : 'No SKU found'}
      onChange={(id) => {
        const sku = options.find((o) => o.id === id)
        if (sku) onChange(sku)
      }}
      options={options.map((o) => ({ value: o.id, label: `${o.skuId} · ${o.productName}` }))}
      optionRender={(option) => {
        const sku = options.find((o) => o.id === option.value)
        if (!sku) return option.label
        return (
          <div>
            <span className="font-mono font-semibold">{sku.skuId}</span> {sku.productName}
            <div className="font-mono text-xs" style={{ color: '#64748b' }}>
              Seller SKU: {sku.sellerSku ?? '—'}
            </div>
          </div>
        )
      }}
    />
  )
}

// ------------------------------------------------------------------ modal

interface SkuSanitizeModalProps {
  uploadId: string
  fileName: string
  onClose: () => void
  onChanged: () => void   // the upload's status changed; refresh the pipeline table
}

// Render with key={uploadId} so each upload starts with fresh state.
export const SkuSanitizeModal: React.FC<SkuSanitizeModalProps> = ({
  uploadId,
  fileName,
  onClose,
  onChanged,
}) => {
  const { getSkuReview, resolveSkuReview, resumeUpload } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const token: string = authToken.access_token

  const [review, setReview] = useState<SkuReview | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [modes, setModes] = useState<Record<number, Mode>>({})
  const [otherSku, setOtherSku] = useState<Record<number, SkuRow>>({})
  const [newNames, setNewNames] = useState<Record<number, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    getSkuReview(token, uploadId)
      .then((data) => {
        setReview(data)
        setSelectedId((current) => current ?? data.items.find((i) => i.status === 'PENDING')?.matchId ?? null)
      })
      .catch((err) => setLoadError(extractErrorMessage(err, 'Failed to load the SKU review')))
  }, [getSkuReview, token, uploadId, reloadKey])

  // Fetch again from scratch (after a save, or when the pending set changed)
  const reload = () => {
    setReview(null)
    setLoadError(null)
    setSelectedId(null)
    setModes({})
    setOtherSku({})
    setNewNames({})
    setReloadKey((k) => k + 1)
  }

  const pending = review?.items.filter((i) => i.status === 'PENDING') ?? []
  const resolvedItems = review?.items.filter((i) => i.status !== 'PENDING') ?? []
  const selected = pending.find((i) => i.matchId === selectedId) ?? null

  const decisionOf = (item: SkuReviewItem): SkuDecision | null => {
    const mode = modes[item.matchId]
    if (!mode) return null
    if (mode === 'create') {
      const name = (newNames[item.matchId] ?? item.productName ?? '').trim()
      return { matchId: item.matchId, action: 'create', productName: name || undefined }
    }
    if (mode === 'other') {
      const sku = otherSku[item.matchId]
      return sku ? { matchId: item.matchId, action: 'map', skuId: sku.id } : null
    }
    return { matchId: item.matchId, action: 'map', skuId: Number(mode.slice('cand:'.length)) }
  }

  const decisions = pending.map(decisionOf).filter((d): d is SkuDecision => d !== null)
  const mappedCount = decisions.filter((d) => d.action === 'map').length
  const createCount = decisions.length - mappedCount
  const allDecided = pending.length > 0 && decisions.length === pending.length
  const canApprove = allDecided && !submitting
  const approveHint = allDecided ? '' : `${pending.length - decisions.length} SKU(s) still need a decision`

  const setMode = (matchId: number, mode: Mode) => setModes((prev) => ({ ...prev, [matchId]: mode }))

  const decisionTag = (item: SkuReviewItem) => {
    const decision = decisionOf(item)
    if (!decision) return <Tag>Pending</Tag>
    if (decision.action === 'create') return <Tag color="green">New SKU</Tag>
    const code = modes[item.matchId] === 'other'
      ? otherSku[item.matchId]?.skuId
      : item.candidates.find((c) => c.id === decision.skuId)?.skuId
    return <Tag color="blue">→ {code}</Tag>
  }

  const approve = async () => {
    setSubmitting(true)
    try {
      const result = await resolveSkuReview(token, uploadId, decisions)
      onChanged()
      const created = result.created.length
      const summary = `${result.mapped} mapped, ${created} new SKU${created === 1 ? '' : 's'}`
      if (result.resume.triggered) {
        message.success(`${summary}. ETL resumed.`)
        onClose()
      } else {
        message.warning(`${summary} saved, but the ETL could not resume. You can retry here.`)
        reload()
      }
    } catch (err) {
      message.error(extractErrorMessage(err, 'Failed to resolve the SKUs'))
      if (axios.isAxiosError(err) && err.response?.status === 409) reload()
    } finally {
      setSubmitting(false)
    }
  }

  const retryResume = async () => {
    setSubmitting(true)
    try {
      const result = await resumeUpload(token, uploadId)
      onChanged()
      if (result.resume.triggered) {
        message.success('ETL resumed.')
        onClose()
      } else {
        message.warning('The ETL could not resume yet.')
        reload()
      }
    } catch (err) {
      message.error(extractErrorMessage(err, 'Failed to resume the ETL'))
      if (axios.isAxiosError(err) && err.response?.status === 409) reload()
    } finally {
      setSubmitting(false)
    }
  }

  // ---------------------------------------------------------------- render parts

  const header = (
    <div>
      <div style={{ fontWeight: 600 }}>SKU review · {fileName}</div>
      {review && (
        <div style={{ fontWeight: 400, fontSize: 12, color: '#64748b', marginTop: 4 }}>
          <Tag color={review.upload.status === 'Paused' ? 'warning' : 'default'}>{review.upload.status}</Tag>
          {review.upload.marketplace} · uploaded {formatJakarta(review.upload.createdAt)}
          {review.upload.totalRows !== null && ` · ${review.upload.totalRows.toLocaleString('id-ID')} rows`}
        </div>
      )}
    </div>
  )

  const itemList = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', maxHeight: 480 }}>
      {pending.length > 0 && (
        <div className="text-xs" style={{ color: '#64748b', fontWeight: 600 }}>
          UNMAPPED SKUS ({pending.length})
        </div>
      )}
      {pending.map((item) => {
        const active = item.matchId === selectedId
        return (
          <button
            key={item.matchId}
            type="button"
            onClick={() => setSelectedId(item.matchId)}
            style={{
              textAlign: 'left',
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${active ? '#a5b4fc' : '#e5e7eb'}`,
              background: active ? '#eef2ff' : '#fff',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.productName ?? item.merchantSku}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <span className="font-mono text-xs" style={{ color: '#64748b' }}>
                {item.sellerSku ?? 'no seller SKU'}
              </span>
              {decisionTag(item)}
            </div>
          </button>
        )
      })}

      {resolvedItems.length > 0 && (
        <>
          <div className="text-xs" style={{ color: '#64748b', fontWeight: 600, marginTop: 8 }}>
            ALREADY RESOLVED ({resolvedItems.length})
          </div>
          {resolvedItems.map((item) => (
            <div
              key={item.matchId}
              style={{ padding: '6px 10px', borderRadius: 8, border: '1px dashed #e5e7eb', fontSize: 12 }}
            >
              <div style={{ fontWeight: 600 }}>{item.productName ?? item.merchantSku}</div>
              <div style={{ color: '#64748b', marginTop: 2 }}>
                <Tag color={item.status === 'MAPPED' ? 'blue' : 'green'}>
                  {item.status === 'MAPPED' ? 'Mapped' : 'New SKU'}
                </Tag>
                {item.resolved?.skuId} · {item.resolved?.by ?? '—'}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )

  const detail = (item: SkuReviewItem) => {
    const mode = modes[item.matchId]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div className="text-xs" style={{ color: '#64748b', fontWeight: 600, marginBottom: 6 }}>
            INCOMING LISTING · {item.channel.toUpperCase()}
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{item.productName ?? '—'}</div>
          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              { key: 'seller', label: 'Seller SKU', children: <span className="font-mono">{item.sellerSku ?? '—'}</span> },
              { key: 'platform', label: 'Platform SKU', children: <span className="font-mono">{item.merchantSku}</span> },
              { key: 'variation', label: 'Variation', children: item.variation ?? '—' },
              { key: 'lines', label: 'Order lines', children: item.orderLineCount ?? '—' },
              { key: 'first', label: 'First order', children: formatJakarta(item.firstOrderAt) },
              { key: 'last', label: 'Last order', children: formatJakarta(item.lastOrderAt) },
            ]}
          />
        </div>

        <Radio.Group
          value={mode}
          onChange={(e) => setMode(item.matchId, e.target.value as Mode)}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          <div className="text-xs" style={{ color: '#64748b', fontWeight: 600, fontSize: 12 }}>
            SUGGESTED BY NAME SIMILARITY
          </div>
          {item.candidates.length === 0 && (
            <span className="text-xs" style={{ color: '#94a3b8', fontSize: 12 }}>No suggestion</span>
          )}
          {item.candidates.map((candidate, index) => (
            <div
              key={candidate.id}
              style={{
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${mode === `cand:${candidate.id}` ? '#a5b4fc' : '#e5e7eb'}`,
              }}
            >
              <Radio value={`cand:${candidate.id}`}>
                <span className="sku-id-badge font-mono font-semibold">{candidate.skuId}</span>{' '}
                <span style={{ fontWeight: 600 }}>{candidate.productName}</span>{' '}
                {index === 0 && <Tag color="purple">Recommended</Tag>}
                {scoreTag(candidate.score)}
                <div className="font-mono text-xs" style={{ color: '#64748b', marginTop: 2 }}>
                  Latest seller SKU: {candidate.sellerSku ?? '—'}
                </div>
              </Radio>
            </div>
          ))}

          <div className="text-xs" style={{ color: '#64748b', fontWeight: 600, marginTop: 8, fontSize: 12 }}>
            OR
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${mode === 'other' ? '#a5b4fc' : '#e5e7eb'}`,
            }}
          >
            <Radio value="other">Map to another SKU</Radio>
            <div style={{ marginTop: 8 }}>
              <SkuSearchSelect
                key={item.matchId}
                token={token}
                value={otherSku[item.matchId]}
                onChange={(sku) => {
                  setOtherSku((prev) => ({ ...prev, [item.matchId]: sku }))
                  setMode(item.matchId, 'other')
                }}
              />
            </div>
          </div>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${mode === 'create' ? '#86efac' : '#e5e7eb'}`,
            }}
          >
            <Radio value="create">Register as a new SKU</Radio>
            <Input
              style={{ marginTop: 8 }}
              disabled={mode !== 'create'}
              maxLength={300}
              placeholder="Product name of the new SKU"
              value={newNames[item.matchId] ?? item.productName ?? ''}
              onChange={(e) => setNewNames((prev) => ({ ...prev, [item.matchId]: e.target.value }))}
            />
          </div>
        </Radio.Group>
      </div>
    )
  }

  const renderBody = () => {
    if (loadError) {
      return (
        <Alert
          type="error"
          showIcon
          message={loadError}
          action={<Button size="small" icon={<ReloadOutlined />} onClick={reload}>Retry</Button>}
        />
      )
    }
    if (!review) {
      return <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
    }
    if (pending.length === 0) {
      if (review.upload.status === 'Paused') {
        return (
          <>
            <Alert
              type="warning"
              showIcon
              message="All SKUs of this upload are resolved, but the ETL has not resumed yet."
              description={review.upload.resumeError ?? undefined}
              action={
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={submitting}
                  onClick={retryResume}
                >
                  Resume ETL
                </Button>
              }
            />
            {resolvedItems.length > 0 && <div style={{ marginTop: 16 }}>{itemList}</div>}
          </>
        )
      }
      return <Empty description={`This upload is ${review.upload.status}; no SKU waits for review.`} />
    }
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) 1fr', gap: 20 }}>
          {itemList}
          <div>{selected ? detail(selected) : <Empty description="Select an unmapped SKU" />}</div>
        </div>
      </>
    )
  }

  const footer = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span className="text-xs" style={{ color: '#64748b' }}>
        {pending.length > 0 && `${decisions.length} of ${pending.length} decided`}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={onClose}>Close</Button>
        {pending.length > 0 && (
          <Popconfirm
            title="Approve and resume the ETL?"
            description={`${mappedCount} mapped to existing SKUs, ${createCount} registered as new SKUs. The SKU master is updated.`}
            okText="Approve"
            disabled={!canApprove}
            onConfirm={approve}
          >
            <Tooltip title={approveHint}>
              <Button type="primary" icon={<PlayCircleOutlined />} loading={submitting} disabled={!canApprove}>
                Approve & Resume ETL
              </Button>
            </Tooltip>
          </Popconfirm>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      open
      onCancel={onClose}
      width={1100}
      style={{ top: 24 }}
      // keep the footer (Approve) on screen; the body scrolls instead
      styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: 4 } }}
      title={header}
      footer={footer}
    >
      {renderBody()}
    </Modal>
  )
}
