import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Descriptions, Input, Modal, Radio, Spin, Tag, message } from 'antd'
import { ScissorOutlined } from '@ant-design/icons'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { SkuSearchSelect } from './SkuSearchSelect'
import type { SkuChangeResult, SkuComposition, SkuHistoryRow, SkuRow, SplitTarget } from '../types/sku'

// Seller SKU as the master keys it (svc / Airflow clean_sku): trimmed, upper case, marketplace prefix off
const cleanCode = (code: string | null) =>
  code ? code.trim().toUpperCase().replace(/^(TKP|TTS|LZD|SHP|BLI)[_-]/, '') : null

// Same target choices as the SKU review: #3 a new SKU, #2 another SKU
type Target = 'new' | 'other'

interface SplitSkuModalProps {
  sku: SkuRow                  // the SKU being split
  row: SkuHistoryRow           // the history row whose Split button was clicked
  history: SkuHistoryRow[]     // all history rows of the SKU (the listing's other seller SKUs)
  onClose: () => void
  onSplit: () => void          // refresh history / list
}

export const SplitSkuModal: React.FC<SplitSkuModalProps> = ({ sku, row, history, onClose, onSplit }) => {
  const { getSkuComposition, splitSku } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const token = authToken.access_token

  const [composition, setComposition] = useState<SkuComposition | null>(null)
  const [listingOn, setListingOn] = useState(true)
  const [codes, setCodes] = useState<string[]>([])
  const [target, setTarget] = useState<Target>('new')
  const [newName, setNewName] = useState('')
  const [other, setOther] = useState<SkuRow | undefined>()
  // the preview / error of the request body it answers; shown only while that body is current
  const [result, setResult] = useState<{ key: string; preview?: SkuChangeResult; error?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSkuComposition(token, sku.id)
      .then((c) => {
        setComposition(c)
        const own = new Set(c.codes.map((x) => x.code))
        const rowCode = cleanCode(row.newSellerSku)
        setCodes(rowCode && own.has(rowCode) ? [rowCode] : [])
        const listing = c.listings.find((l) => l.platformSkuId === row.platformSkuId)
        setListingOn(!!listing)
        setNewName(listing?.productName ?? sku.productName)
      })
      .catch((err) => message.error(extractErrorMessage(err, 'Failed to load the SKU')))
  }, [token, sku.id, sku.productName, row.platformSkuId, row.newSellerSku, getSkuComposition])

  const listing = composition?.listings.find((l) => l.platformSkuId === row.platformSkuId)
  const ownCodes = useMemo(() => new Map((composition?.codes ?? []).map((c) => [c.code, c])), [composition])
  // the clicked version's seller SKU first, then the listing's other seller SKUs
  const codeChoices = useMemo(() => {
    const seen: string[] = []
    const first = cleanCode(row.newSellerSku)
    if (first) seen.push(first)
    history
      .filter((h) => h.platformSkuId === row.platformSkuId)
      .flatMap((h) => [cleanCode(h.oldSellerSku), cleanCode(h.newSellerSku)])
      .forEach((c) => c && !seen.includes(c) && seen.push(c))
    return seen
  }, [history, row])

  const splitTarget: SplitTarget | null =
    target === 'new' ? (newName.trim() ? { new: { productName: newName.trim() } } : null)
      : other ? { skuId: other.id } : null
  const listingIds = listingOn && listing ? [listing.platformSkuId] : []
  const body = splitTarget ? { codes, listingIds, target: splitTarget } : null
  const bodyKey = JSON.stringify(body)

  const ready = !!body && (codes.length > 0 || listingIds.length > 0)
  useEffect(() => {
    if (!ready) return
    const request = JSON.parse(bodyKey)
    const timer = window.setTimeout(() => {
      splitSku(token, sku.id, request, 'preview')
        .then((preview) => setResult({ key: bodyKey, preview }))
        .catch((err) => setResult({ key: bodyKey, error: extractErrorMessage(err, 'Split is not possible') }))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [ready, bodyKey, token, sku.id, splitSku])
  const current = ready && result && result.key === bodyKey ? result : null
  const preview = current?.preview ?? null
  const previewError = current?.error ?? null

  const apply = async () => {
    if (!body) return
    setBusy(true)
    try {
      const r = await splitSku(token, sku.id, body, 'apply')
      if (r.reassign?.triggered) message.success(`Split off to ${r.target.skuId}; moving its order lines`)
      else message.warning(`Split off to ${r.target.skuId}; order line move not started - retry it from the change log`)
      onSplit()
      onClose()
    } catch (err) {
      message.error(extractErrorMessage(err, 'Split failed'))
    } finally {
      setBusy(false)
    }
  }

  const counts = preview?.counts
  return (
    <Modal
      open
      width={720}
      title={<span><ScissorOutlined /> Split {sku.skuId}</span>}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="split" type="primary" disabled={!preview} loading={busy} onClick={apply}>Split</Button>,
      ]}
    >
      {!composition ? (
        <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
      ) : (
        <>
          <div className="sku-change-section-title">Move off {sku.skuId}</div>
          <div className="sku-change-option">
            <Checkbox checked={listingOn} disabled={!listing} onChange={(e) => setListingOn(e.target.checked)}>
              Listing <span className="font-semibold">{row.channel}</span>{' '}
              <span className="font-mono">{row.merchantSku}</span> (all versions)
            </Checkbox>
            <div className="sku-change-option-meta">
              {listing
                ? <Tag>{listing.orderLines.toLocaleString('id-ID')} order lines follow the listing</Tag>
                : <Tag color="warning">belongs to another SKU</Tag>}
            </div>
          </div>
          {codeChoices.map((code) => {
            const own = ownCodes.get(code)
            return (
              <div key={code} className="sku-change-option">
                <Checkbox
                  checked={codes.includes(code)}
                  disabled={!own}
                  onChange={(e) => setCodes(e.target.checked ? [...codes, code] : codes.filter((c) => c !== code))}
                >
                  Seller SKU <span className="font-mono font-semibold">{code}</span>
                  {own?.isMasterCode && <Tag color="blue" style={{ marginLeft: 6 }}>master</Tag>}
                </Checkbox>
                <div className="sku-change-option-meta">
                  {own
                    ? <Tag>{own.orderLines.toLocaleString('id-ID')} order lines</Tag>
                    : <Tag color="warning">belongs to another SKU</Tag>}
                </div>
              </div>
            )
          })}

          <div className="sku-change-section-title">Into</div>
          <Radio.Group className="sku-change-options" value={target} onChange={(e) => setTarget(e.target.value)}>
            <div className={`sku-change-option ${target === 'new' ? 'selected' : ''}`}>
              <Radio value="new">Split into a new SKU</Radio>
              <Input
                style={{ marginTop: 8 }}
                disabled={target !== 'new'}
                value={newName}
                maxLength={300}
                placeholder="Product name of the new SKU"
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className={`sku-change-option ${target === 'other' ? 'selected' : ''}`}>
              <Radio value="other">Split and merge into another SKU</Radio>
              <div style={{ marginTop: 8 }}>
                <SkuSearchSelect token={token} value={other} excludeId={sku.id} disabled={target !== 'other'}
                                 onChange={setOther} />
              </div>
            </div>
          </Radio.Group>

          {previewError && <Alert type="error" showIcon message={previewError} style={{ marginTop: 12 }} />}
          {preview && counts && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 12 }}
              message={<>
                Moves to <span className="font-mono font-semibold">{preview.target.skuId}</span>{' '}
                {preview.target.id === null && <Tag color="green">new</Tag>}
              </>}
              description={
                <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
                  <Descriptions.Item label="Seller SKUs">{counts.codes}</Descriptions.Item>
                  <Descriptions.Item label="Listings">{counts.listings}</Descriptions.Item>
                  <Descriptions.Item label="Order lines">{counts.orderLines.toLocaleString('id-ID')}</Descriptions.Item>
                  <Descriptions.Item label="History versions">{counts.historyRows}</Descriptions.Item>
                  {counts.bundle && <Descriptions.Item label="Bundle">{counts.bundle}</Descriptions.Item>}
                </Descriptions>
              }
            />
          )}
        </>
      )}
    </Modal>
  )
}
