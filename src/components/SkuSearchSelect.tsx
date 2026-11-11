import React, { useEffect, useRef, useState } from 'react'
import { Select, Spin, message } from 'antd'
import useStore from '../store/store'
import { extractErrorMessage } from '../utils/api'
import type { SkuRow } from '../types/sku'

// SKU picker shared by the SKU review (SkuSanitizeModal) and the merge / split dialogs
interface SkuSearchSelectProps {
  token: string
  value?: SkuRow
  disabled?: boolean
  excludeId?: number       // e.g. the SKU being merged or split; never offered as its own target
  onChange: (sku: SkuRow) => void
}

// Server-side search over SKU ID, latest and older seller SKUs and product name
export const SkuSearchSelect: React.FC<SkuSearchSelectProps> = ({ token, value, disabled, excludeId, onChange }) => {
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
          if (request === latestRequest.current) setOptions(rows.filter((r) => r.id !== excludeId))
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
