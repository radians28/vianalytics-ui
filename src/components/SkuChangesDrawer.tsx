import React, { useState } from 'react'
import { Button, Drawer, Table, Tag, Tooltip, message } from 'antd'
import type { TableProps } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { formatJakarta } from '../utils/date'
import type { SkuChange } from '../types/sku'

const STATUS: Record<SkuChange['status'], { color: string; label: string }> = {
  PENDING: { color: 'gold', label: 'Waiting' },
  RUNNING: { color: 'processing', label: 'Moving orders' },
  DONE: { color: 'green', label: 'Done' },
  FAILED: { color: 'red', label: 'Failed' },
}

interface SkuChangesDrawerProps {
  changes: SkuChange[]
  loading: boolean
  isAdmin: boolean
  onClose: () => void
  onReload: () => void
}

// SKU merges / splits and whether their stored order lines have been moved
export const SkuChangesDrawer: React.FC<SkuChangesDrawerProps> = ({ changes, loading, isAdmin, onClose, onReload }) => {
  const { retrySkuChange } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const [retrying, setRetrying] = useState<number | null>(null)

  const retry = async (changeId: number) => {
    setRetrying(changeId)
    try {
      const r = await retrySkuChange(authToken.access_token, changeId)
      if (r.triggered) message.success('Order line move restarted')
      else message.warning(`Order line move could not start: ${r.error ?? 'unknown error'}`)
    } catch (err) {
      message.error(extractErrorMessage(err, 'Retry failed'))
    } finally {
      setRetrying(null)
      onReload()
    }
  }

  const columns: TableProps<SkuChange>['columns'] = [
    {
      title: 'Change',
      key: 'change',
      render: (_, c) => (
        <div style={{ whiteSpace: 'normal' }}>
          <Tag color={c.kind === 'MERGE' ? 'purple' : 'blue'}>{c.kind === 'MERGE' ? 'Merge' : 'Split'}</Tag>
          <span className="font-mono font-semibold">{c.source}</span> → <span className="font-mono font-semibold">{c.target}</span>
          {c.targetCreated && <Tag color="green" style={{ marginLeft: 6, fontSize: 11 }}>new SKU</Tag>}
          <div className="text-xs" style={{ color: '#64748b', marginTop: 2 }}>
            {c.kind === 'MERGE' ? `${c.source} deleted · ` : ''}{c.codes} seller SKU(s), {c.listings} listing(s) · {c.by ?? '—'}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, c) => {
        const s = STATUS[c.status]
        const tag = <Tag color={s.color}>{s.label}</Tag>
        return c.message ? <Tooltip title={c.message}>{tag}</Tooltip> : tag
      },
    },
    {
      title: 'Order lines',
      key: 'lines',
      width: 120,
      align: 'right',
      render: (_, c) => (c.counts?.rows_moved ?? 0) + (c.counts?.rows_swept ?? 0) + (c.counts?.lines_rebuilt ?? 0) || '—',
    },
    {
      title: 'When',
      key: 'when',
      width: 170,
      render: (_, c) => <span className="text-xs">{formatJakarta(c.finishedAt ?? c.createdAt)}</span>,
    },
    {
      title: '',
      key: 'retry',
      width: 90,
      render: (_, c) => isAdmin && (c.status === 'FAILED' || c.status === 'PENDING') && (
        <Button size="small" icon={<ReloadOutlined />} loading={retrying === c.changeId} onClick={() => retry(c.changeId)}>
          Retry
        </Button>
      ),
    },
  ]

  return (
    <Drawer
      open
      width={820}
      title="SKU merges & splits"
      onClose={onClose}
      extra={<Button icon={<ReloadOutlined />} onClick={onReload}>Refresh</Button>}
    >
      <Table<SkuChange>
        rowKey="changeId"
        size="small"
        columns={columns}
        dataSource={changes}
        loading={loading}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
      />
    </Drawer>
  )
}
