import React, { useEffect, useState } from 'react'
import { Button, ConfigProvider, Dropdown, Table, message } from 'antd'
import type { MenuProps, TableColumnType, TableProps } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { EyeOutlined, HistoryOutlined, MergeCellsOutlined, MoreOutlined, SearchOutlined } from '@ant-design/icons'
import { ColumnSearchDropdown } from '../ColumnSearchDropdown'
import { SkuDetailModal } from '../SkuDetailModal'
import { MergeSkuModal } from '../MergeSkuModal'
import { SkuChangesDrawer } from '../SkuChangesDrawer'
import useStore from '../../store/store'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { extractErrorMessage } from '../../utils/api'
import type { SkuChange, SkuListPayload, SkuRow } from '../../types/sku'
import { BRAND_PRIMARY } from '../../theme'

// Row actions; add more entries here and handle them in handleAction. Merge is admin only.
const actionItems = (isAdmin: boolean): MenuProps['items'] => [
  { key: 'detail', label: 'Show detail', icon: <EyeOutlined /> },
  ...(isAdmin ? [{ key: 'merge', label: 'Merge', icon: <MergeCellsOutlined /> }] : []),
]

export const SkuMasterView: React.FC = () => {
  const { getSkus, getSkuChanges, skus, totalSkus } = useStore()
  const [authToken] = useLocalStorage('access_token')
  const isAdmin = ((authToken?.decoded_token?.roles ?? []) as string[]).includes('admin')
  const [mergeSku, setMergeSku] = useState<SkuRow | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [changes, setChanges] = useState<{ open: boolean; loading: boolean; rows: SkuChange[] }>({
    open: false, loading: false, rows: [],
  })

  const loadChanges = () => {
    setChanges((c) => ({ ...c, open: true, loading: true }))
    getSkuChanges(authToken.access_token)
      .then((rows) => setChanges({ open: true, loading: false, rows }))
      .catch((err) => {
        message.error(extractErrorMessage(err, 'Failed to load SKU changes'))
        setChanges((c) => ({ ...c, loading: false }))
      })
  }

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<Record<string, FilterValue | null>>({})
  const [sorter, setSorter] = useState<SorterResult<SkuRow> | null>(null)
  const [detailSku, setDetailSku] = useState<SkuRow | null>(null)

  const payload: SkuListPayload = {
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
  // The table shows a spinner until the response for the current request arrives
  const requestKey = JSON.stringify({ ...payload, reloadTick })
  const [loadedKey, setLoadedKey] = useState<string | null>(null)

  useEffect(() => {
    const { reloadTick: _tick, ...body } = JSON.parse(requestKey)
    void _tick
    getSkus(authToken.access_token, body)
      .catch((err) => message.error(extractErrorMessage(err, 'Failed to load SKU master')))
      .finally(() => setLoadedKey(requestKey))
  }, [requestKey, authToken.access_token, getSkus])

  const handleAction = (key: string, record: SkuRow) => {
    if (key === 'detail') setDetailSku(record)
    if (key === 'merge') setMergeSku(record)
  }

  const getColumnSearchProps = (label: string): TableColumnType<SkuRow> => ({
    filterDropdown: (props) => <ColumnSearchDropdown {...props} label={label} />,
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? BRAND_PRIMARY : undefined }} />
    ),
  })

  const columns: TableProps<SkuRow>['columns'] = [
    {
      title: 'SKU ID',
      dataIndex: 'skuId',
      key: 'skuId',
      width: 160,
      sorter: true,
      sortOrder: sorter?.columnKey === 'skuId' ? sorter.order : null,
      filteredValue: filters.skuId ?? null,
      ...getColumnSearchProps('SKU ID'),
      render: (id: string) => (
        <span className="sku-id-badge font-mono font-semibold">{id}</span>
      ),
    },
    {
      title: 'Latest Seller SKU',
      dataIndex: 'sellerSku',
      key: 'sellerSku',
      width: 200,
      sorter: true,
      sortOrder: sorter?.columnKey === 'sellerSku' ? sorter.order : null,
      filteredValue: filters.sellerSku ?? null,
      ...getColumnSearchProps('seller SKU'),
      render: (code: string | null) => <span className="font-mono text-xs">{code ?? '—'}</span>,
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      key: 'productName',
      sorter: true,
      sortOrder: sorter?.columnKey === 'productName' ? sorter.order : null,
      filteredValue: filters.productName ?? null,
      ...getColumnSearchProps('product name'),
      render: (name: string) => (
        <span className="font-semibold text-slate-900">{name}</span>
      ),
    },
    {
      title: 'Action',
      key: 'actions',
      width: 72,
      align: 'right',
      fixed: 'right',
      render: (_, record) => (
        <Dropdown
          trigger={['click']}
          menu={{ items: actionItems(isAdmin), onClick: ({ key }) => handleAction(key, record) }}
        >
          <Button type="text" icon={<MoreOutlined />} aria-label="Row actions" />
        </Dropdown>
      ),
    },
  ]

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: BRAND_PRIMARY,
          borderRadius: 8,
        },
      }}
    >
      <div className="view-container sku-view">
        <div className="sku-view-toolbar">
          <Button icon={<HistoryOutlined />} onClick={loadChanges}>Merge &amp; split log</Button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Table<SkuRow>
            rowKey="id"
            columns={columns}
            dataSource={skus}
            loading={loadedKey !== requestKey}
            pagination={{
              current: page,
              pageSize,
              total: totalSkus,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `Total ${total} SKUs`,
            }}
            scroll={{ x: 'max-content' }}
            onChange={(pagination, nextFilters, nextSorter) => {
              const nextSorterResult = Array.isArray(nextSorter) ? nextSorter[0] ?? null : nextSorter
              const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(filters)
              const sorterChanged =
                nextSorterResult?.columnKey !== sorter?.columnKey ||
                nextSorterResult?.order !== sorter?.order

              setFilters(nextFilters)
              setSorter(nextSorterResult)
              setPageSize(pagination.pageSize ?? pageSize)
              // A new filter/sort makes the old page number meaningless, so jump back to page 1.
              setPage(filtersChanged || sorterChanged ? 1 : (pagination.current ?? 1))
            }}
          />
        </div>

        {detailSku && (
          <SkuDetailModal
            key={detailSku.id}
            sku={detailSku}
            onClose={() => setDetailSku(null)}
            onChanged={() => setReloadTick((t) => t + 1)}
          />
        )}

        {mergeSku && (
          <MergeSkuModal
            key={mergeSku.id}
            sku={mergeSku}
            onClose={() => setMergeSku(null)}
            onMerged={() => setReloadTick((t) => t + 1)}
          />
        )}

        {changes.open && (
          <SkuChangesDrawer
            changes={changes.rows}
            loading={changes.loading}
            isAdmin={isAdmin}
            onClose={() => setChanges((c) => ({ ...c, open: false }))}
            onReload={loadChanges}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
