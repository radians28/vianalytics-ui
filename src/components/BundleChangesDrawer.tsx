import React, { useState } from 'react'
import { Button, Drawer, Popconfirm, Table, Tag, Tooltip, message } from 'antd'
import type { TableProps } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { formatJakarta } from '../utils/date'
import type { BundleChange } from '../types/sku'

const STATUS: Record<BundleChange['status'], { color: string; label: string }> = {
  PENDING: { color: 'gold', label: 'Waiting' },
  RUNNING: { color: 'processing', label: 'Running' },
  DONE: { color: 'green', label: 'Done' },
  FAILED: { color: 'red', label: 'Failed' },
  SKIPPED: { color: 'default', label: 'Not re-split' },
}

interface BundleChangesDrawerProps {
  changes: BundleChange[]
  loading: boolean
  onClose: () => void
  onReload: () => void
}

// Bundles whose components changed, and whether their stored order lines were split again
export const BundleChangesDrawer: React.FC<BundleChangesDrawerProps> = ({ changes, loading, onClose, onReload }) => {
  const { reconsolidateBundles } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const [starting, setStarting] = useState(false)

  const start = async (ids: number[]) => {
    setStarting(true)
    try {
      const result = await reconsolidateBundles(authToken.access_token, ids)
      if (result.triggered) message.success(`Re-split started for ${result.changeIds.length} bundle(s)`)
      else message.warning(`Re-split could not start: ${result.error ?? 'unknown error'}`)
    } catch (err) {
      message.error(extractErrorMessage(err, 'Re-split could not start'))
    } finally {
      setStarting(false)
      onReload()
    }
  }

  const startable = changes.filter((c) => c.status === 'PENDING' || c.status === 'FAILED' || c.status === 'SKIPPED')

  const columns: TableProps<BundleChange>['columns'] = [
    {
      title: 'Bundle',
      key: 'bundle',
      render: (_, c) => (
        <div style={{ maxWidth: 260, whiteSpace: 'normal' }}>
          <span className="sku-id-badge font-mono font-semibold">{c.skuId}</span>{' '}
          {c.newBundle && <Tag color="purple" style={{ fontSize: 11 }}>new bundle</Tag>}
          <div className="text-xs" style={{ marginTop: 2 }}>{c.productName}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: BundleChange['status'], c) => (
        <Tooltip title={c.status === 'FAILED' || c.message?.startsWith('Not started') ? c.message : undefined}>
          <Tag color={STATUS[status].color}>{STATUS[status].label}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Result',
      key: 'result',
      width: 170,
      render: (_, c) =>
        c.status === 'DONE' ? (
          <span className="text-xs">
            {c.linesRebuilt ?? 0} line(s) in {c.ordersTouched ?? 0} order(s)
            {c.linesMismatch ? <> · <span className="text-danger">{c.linesMismatch} not rebuilt</span></> : null}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: 'Uploaded',
      key: 'createdAt',
      width: 170,
      render: (_, c) => (
        <span className="text-xs">
          {formatJakarta(c.createdAt)}
          <div style={{ color: '#64748b' }}>{c.fileName}</div>
        </span>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_, c) =>
        c.status === 'PENDING' || c.status === 'FAILED' || c.status === 'SKIPPED' ? (
          <Button size="small" loading={starting} onClick={() => start([c.changeId])}>
            {c.status === 'SKIPPED' ? 'Re-split' : 'Retry'}
          </Button>
        ) : null,
    },
  ]

  return (
    <Drawer
      open
      width={860}
      title="Order re-split after bundle changes"
      onClose={onClose}
      extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ReloadOutlined />} onClick={onReload} loading={loading}>Refresh</Button>
          <Popconfirm
            title={`Re-split the stored orders of ${startable.length} bundle(s)?`}
            description="Order lines already loaded are split again with the current components."
            onConfirm={() => start(startable.map((c) => c.changeId))}
            disabled={startable.length === 0}
          >
            <Button type="primary" disabled={startable.length === 0} loading={starting}>
              Re-split all open
            </Button>
          </Popconfirm>
        </div>
      }
    >
      <p className="section-desc" style={{ marginTop: 0 }}>
        A bundle upload changes the components of new orders only. Re-splitting rebuilds every stored order line of
        the bundle from its old components and splits it with the new ones; order totals stay the same. Lines that
        can't be rebuilt are left as they are and flagged.
      </p>
      <Table<BundleChange>
        rowKey="changeId"
        size="small"
        columns={columns}
        dataSource={changes}
        loading={loading}
        pagination={{ pageSize: 10, size: 'small' }}
      />
    </Drawer>
  )
}
