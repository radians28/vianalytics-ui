import React, { useEffect, useState } from 'react'
import { Alert, Modal, Table, Tabs, Tag } from 'antd'
import type { TableProps } from 'antd'
import { ArrowRightOutlined } from '@ant-design/icons'
import useStore from '../store/store'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { extractErrorMessage } from '../utils/api'
import { formatJakarta } from '../utils/date'
import type { SkuHistoryRow, SkuPlatformRow, SkuRow } from '../types/sku'

// data/error stay undefined while the request is in flight
interface Loadable<T> {
  data?: T
  error?: string
}

type TabKey = 'history' | 'platforms'

interface SkuDetailModalProps {
  sku: SkuRow
  onClose: () => void
}

// Render with key={sku.id} so each SKU starts with fresh state.
export const SkuDetailModal: React.FC<SkuDetailModalProps> = ({ sku, onClose }) => {
  const { getSkuHistory, getSkuPlatforms } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const token: string = authToken.access_token

  // The history tab opens first, so it is requested right away; the platform
  // tab is requested the first time it is opened (null = not requested yet).
  const [history, setHistory] = useState<Loadable<SkuHistoryRow[]>>({})
  const [platforms, setPlatforms] = useState<Loadable<SkuPlatformRow[]> | null>(null)

  useEffect(() => {
    getSkuHistory(token, sku.id)
      .then((data) => setHistory({ data }))
      .catch((err) => setHistory({ error: extractErrorMessage(err, 'Failed to load SKU history') }))
  }, [getSkuHistory, token, sku.id])

  const loadPlatforms = () => {
    setPlatforms({})
    getSkuPlatforms(token, sku.id)
      .then((data) => setPlatforms({ data }))
      .catch((err) => setPlatforms({ error: extractErrorMessage(err, 'Failed to load platform SKUs') }))
  }

  const handleTabChange = (key: string) => {
    if ((key as TabKey) === 'platforms' && platforms === null) loadPlatforms()
  }

  const historyColumns: TableProps<SkuHistoryRow>['columns'] = [
    {
      title: 'Date',
      key: 'date',
      width: 190,
      render: (_, row) => (
        <span className="text-xs">{formatJakarta(row.changedAt ?? row.validFrom)}</span>
      ),
    },
    {
      title: 'Platform',
      key: 'platform',
      render: (_, row) => (
        <div>
          <div className="font-semibold">{row.channel}</div>
          <div className="font-mono text-xs">{row.merchantSku}</div>
        </div>
      ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 90,
      render: (version: number) => <Tag>v{version}</Tag>,
    },
    {
      title: 'Seller SKU',
      key: 'sellerSku',
      render: (_, row) => (
        <span className="font-mono text-xs">
          {row.oldSellerSku ? (
            <>
              {row.oldSellerSku} <ArrowRightOutlined style={{ fontSize: 10 }} />{' '}
            </>
          ) : null}
          <span className="font-semibold">{row.newSellerSku ?? '—'}</span>
        </span>
      ),
    },
    {
      title: 'Notes',
      key: 'notes',
      render: (_, row) => (
        <>
          {row.version === 1 && <Tag color="blue">First seen</Tag>}
          {row.skuId && row.skuId !== sku.skuId && (
            <Tag color="warning">Under {row.skuId}</Tag>
          )}
          {row.dqFlag && <Tag color="error">{row.dqFlag}</Tag>}
        </>
      ),
    },
  ]

  const platformColumns: TableProps<SkuPlatformRow>['columns'] = [
    {
      title: 'Platform',
      dataIndex: 'channel',
      key: 'channel',
      render: (channel: string, row) => (
        <span className="font-semibold">
          {channel} {row.isLatest && <Tag color="green">Latest</Tag>}
        </span>
      ),
    },
    {
      title: 'Platform SKU',
      dataIndex: 'merchantSku',
      key: 'merchantSku',
      render: (value: string) => <span className="font-mono text-xs">{value}</span>,
    },
    {
      title: 'Current Seller SKU',
      dataIndex: 'currentSellerSku',
      key: 'currentSellerSku',
      render: (value: string | null, row) => (
        <span className="font-mono text-xs">
          {value ?? '—'}{' '}
          {!row.isOnMasterSku && <Tag color="warning">Not master code</Tag>}
        </span>
      ),
    },
    {
      title: 'Listing Name',
      dataIndex: 'productName',
      key: 'productName',
      render: (value: string | null) => value ?? '—',
    },
    {
      title: 'First Order',
      dataIndex: 'firstOrderAt',
      key: 'firstOrderAt',
      width: 180,
      render: (value: string | null) => <span className="text-xs">{formatJakarta(value)}</span>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 180,
      render: (value: string | null) => <span className="text-xs">{formatJakarta(value)}</span>,
    },
  ]

  const renderTable = <T extends object>(
    state: Loadable<T[]> | null,
    columns: TableProps<T>['columns'],
    rowKey: (row: T) => string,
    emptyText: string,
  ) =>
    state?.error ? (
      <Alert type="error" showIcon message={state.error} />
    ) : (
      <Table<T>
        rowKey={rowKey}
        columns={columns}
        dataSource={state?.data ?? []}
        loading={!state || state.data === undefined}
        pagination={false}
        size="small"
        scroll={{ x: 'max-content', y: 360 }}
        locale={{ emptyText }}
      />
    )

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={1120}
      title={
        <span>
          <span className="sku-id-badge font-mono font-semibold">{sku.skuId}</span>{' '}
          {sku.productName}
        </span>
      }
    >
      <Tabs
        defaultActiveKey="history"
        onChange={handleTabChange}
        items={[
          {
            key: 'history',
            label: 'SKU History',
            children: renderTable(
              history,
              historyColumns,
              (row) => `${row.platformSkuId}-${row.version}`,
              'No listing recorded for this SKU',
            ),
          },
          {
            key: 'platforms',
            label: 'SKU Platform',
            children: renderTable(
              platforms,
              platformColumns,
              (row) => String(row.platformSkuId),
              'No marketplace listing for this SKU',
            ),
          },
        ]}
      />
    </Modal>
  )
}
