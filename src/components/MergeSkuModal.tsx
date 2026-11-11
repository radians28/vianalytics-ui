import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Alert, Button, Descriptions, Empty, Modal, Popconfirm, Radio, Spin, Switch, Tag, message } from 'antd'
import { MergeCellsOutlined } from '@ant-design/icons'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { SkuSearchSelect } from './SkuSearchSelect'
import type { MergeSuggestion, SkuChangeResult, SkuRow } from '../types/sku'

// Same choices as the SKU review (Validate & Sanitize): #1 a suggested SKU, #2 any other SKU
type Mode = `cand:${number}` | 'other'

const FACTOR_LABEL: Record<string, string> = { species: 'species', stage: 'life stage', size: 'size', qty: 'pack qty' }

const scoreTag = (score: number) => {
  const color = score >= 0.85 ? 'green' : score >= 0.7 ? 'gold' : 'default'
  return <Tag color={color}>{Math.round(score * 100)}% name match</Tag>
}

// Categories that lowered the score (1.0 = both names agree)
const factorTags = (factors: MergeSuggestion['factors']) =>
  Object.entries(factors)
    .filter(([, v]) => v < 1)
    .map(([k, v]) => (
      <Tag key={k} color={v <= 0.7 ? 'red' : 'default'} style={{ fontSize: 11 }}>
        {FACTOR_LABEL[k] ?? k} {v <= 0.7 ? 'differs' : 'unknown'}
      </Tag>
    ))

interface MergeSkuModalProps {
  sku: SkuRow                // the SKU whose row action opened the dialog
  onClose: () => void
  onMerged: () => void       // refresh the SKU list
}

export const MergeSkuModal: React.FC<MergeSkuModalProps> = ({ sku, onClose, onMerged }) => {
  const { getMergeSuggestions, mergeSku } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const token = authToken.access_token

  const [suggestions, setSuggestions] = useState<MergeSuggestion[] | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [other, setOther] = useState<SkuRow | undefined>()
  const [keepThis, setKeepThis] = useState(false)      // false: this SKU is merged into the chosen one
  // the preview / error of the request key it answers; shown only while that key is current
  const [result, setResult] = useState<{ key: string; preview?: SkuChangeResult; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMergeSuggestions(token, sku.id)
      .then((rows) => {
        setSuggestions(rows)
        setMode(rows.length ? `cand:${rows[0].id}` : 'other')
      })
      .catch((err) => {
        setSuggestions([])
        setMode('other')
        message.error(extractErrorMessage(err, 'Failed to load suggestions'))
      })
  }, [token, sku.id, getMergeSuggestions])

  const chosen: SkuRow | undefined =
    mode === 'other' ? other : suggestions?.find((s) => mode === `cand:${s.id}`)
  // source is merged into target and deleted
  const source = keepThis ? chosen : sku
  const target = keepThis ? sku : chosen

  const previewKey = source && target ? `${source.id}>${target.id}` : null
  useEffect(() => {
    if (!previewKey) return
    const [from, into] = previewKey.split('>').map(Number)
    mergeSku(token, from, into, 'preview')
      .then((preview) => setResult({ key: previewKey, preview }))
      .catch((err) => setResult({ key: previewKey, error: extractErrorMessage(err, 'Merge is not possible') }))
  }, [token, previewKey, mergeSku])
  const current = result && result.key === previewKey ? result : null
  const preview = current?.preview ?? null
  const previewError = current?.error ?? null

  const apply = async () => {
    if (!source || !target) return
    setBusy(true)
    try {
      const r = await mergeSku(token, source.id, target.id, 'apply')
      if (r.reassign?.triggered) message.success(`${r.source.skuId} merged into ${r.target.skuId}; moving its order lines`)
      else message.warning(`${r.source.skuId} merged into ${r.target.skuId}; order line move not started - retry it from the change log`)
      onMerged()
      onClose()
    } catch (err) {
      message.error(extractErrorMessage(err, 'Merge failed'))
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setResult({ key: previewKey ?? '', error: extractErrorMessage(err, 'Merge is not possible') })
      }
    } finally {
      setBusy(false)
    }
  }

  const counts = preview?.counts
  return (
    <Modal
      open
      width={760}
      title={<span><MergeCellsOutlined /> Merge {sku.skuId}</span>}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Popconfirm
          key="merge"
          title={`Delete ${source?.skuId ?? ''}?`}
          description={`${source?.skuId} is merged into ${target?.skuId} and then deleted. There is no undo; a wrong merge is fixed with a split.`}
          okText="Merge"
          okButtonProps={{ danger: true }}
          onConfirm={apply}
          disabled={!preview}
        >
          <Button type="primary" danger disabled={!preview} loading={busy}>Merge</Button>
        </Popconfirm>,
      ]}
    >
      <div className="sku-change-head">
        <span className="sku-id-badge font-mono font-semibold">{sku.skuId}</span> {sku.productName}
        <div className="font-mono text-xs" style={{ color: '#64748b' }}>Seller SKU: {sku.sellerSku ?? '—'}</div>
      </div>

      {suggestions === null ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : (
        <Radio.Group
          className="sku-change-options"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <div className="sku-change-section-title">Suggested SKU</div>
          {suggestions.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No similar SKU found" />}
          {suggestions.map((s) => (
            <div key={s.id} className={`sku-change-option ${mode === `cand:${s.id}` ? 'selected' : ''}`}>
              <Radio value={`cand:${s.id}`}>
                <span className="font-mono font-semibold">{s.skuId}</span> {s.productName}
              </Radio>
              <div className="sku-change-option-meta">
                {scoreTag(s.score)} {factorTags(s.factors)}
                <span className="font-mono text-xs" style={{ color: '#64748b' }}>Seller SKU: {s.sellerSku ?? '—'}</span>
              </div>
            </div>
          ))}
          <div className="sku-change-section-title">Other SKU</div>
          <div className={`sku-change-option ${mode === 'other' ? 'selected' : ''}`}>
            <Radio value="other">Merge with another SKU</Radio>
            <div style={{ marginTop: 8 }}>
              <SkuSearchSelect token={token} value={other} excludeId={sku.id} disabled={mode !== 'other'}
                               onChange={setOther} />
            </div>
          </div>
        </Radio.Group>
      )}

      <div className="sku-change-direction">
        <Switch size="small" checked={keepThis} onChange={setKeepThis} />{' '}
        Keep <span className="font-mono">{sku.skuId}</span> and merge the chosen SKU into it instead
      </div>

      {previewError && <Alert type="error" showIcon message={previewError} style={{ marginTop: 12 }} />}
      {source && target && !previewError && !preview && <div style={{ textAlign: 'center', padding: 12 }}><Spin size="small" /></div>}
      {preview && counts && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
          message={<>
            <span className="font-mono font-semibold">{preview.source.skuId}</span> moves into{' '}
            <span className="font-mono font-semibold">{preview.target.skuId}</span> and is deleted
          </>}
          description={
            <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
              <Descriptions.Item label="Seller SKUs">{counts.codes}</Descriptions.Item>
              <Descriptions.Item label="Listings">{counts.listings}</Descriptions.Item>
              <Descriptions.Item label="Order lines">{counts.orderLines.toLocaleString('id-ID')}</Descriptions.Item>
              <Descriptions.Item label="History versions">{counts.historyRows}</Descriptions.Item>
              {!!counts.componentOfBundles && (
                <Descriptions.Item label="Component of">{counts.componentOfBundles} bundle(s)</Descriptions.Item>
              )}
              {counts.bundle && <Descriptions.Item label="Bundle">{counts.bundle}</Descriptions.Item>}
            </Descriptions>
          }
        />
      )}
    </Modal>
  )
}
