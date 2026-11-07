import React, { useEffect, useState } from 'react'
import { Button, ConfigProvider, Progress, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { TableColumnType, TableProps } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { SearchOutlined, UploadOutlined } from '@ant-design/icons'
import { BundleUploadModal } from '../BundleUploadModal'
import { SampleDownload } from '../FileDropzone'
import { ColumnSearchDropdown } from '../ColumnSearchDropdown'
import useStore from '../../store/store'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import { extractErrorMessage } from '../../utils/api'
import { formatIdr } from '../../utils/format'
import type { SkuBundleComponent, SkuBundleRow, SkuListPayload } from '../../types/sku'

// m_sku_bundle.dq_flag values, explained for the tag tooltips
const DQ_FLAGS: Record<string, { label: string; color: string; help: string }> = {
  free_gift: { label: 'Free gift', color: 'green', help: 'Free gift component: no price, no share of the bundle price' },
  equal_split: { label: 'Equal split', color: 'orange', help: 'Prices missing or all zero: the bundle price is split by quantity' },
  price_gap: { label: 'Price gap', color: 'gold', help: 'Component prices do not add up to the bundle price in the source file' },
  flattened: { label: 'Flattened', color: 'blue', help: 'Came from a bundle inside this bundle, broken down to its final component' },
}

// The Components column filters on the component (SKU ID, seller SKU or name), the API's `component` key
const FILTER_KEY: Record<string, string> = { componentCount: 'component' }

const ComponentTable: React.FC<{ bundle: SkuBundleRow }> = ({ bundle }) => {
  const columns: TableProps<SkuBundleComponent>['columns'] = [
    { title: '#', dataIndex: 'seq', key: 'seq', width: 48, align: 'center' },
    {
      title: 'Component SKU ID',
      dataIndex: 'skuId',
      key: 'skuId',
      width: 120,
      render: (id: string | null) =>
        id ? <span className="sku-id-badge font-mono font-semibold">{id}</span> : '—',
    },
    {
      title: 'Seller SKU',
      dataIndex: 'sellerSku',
      key: 'sellerSku',
      width: 150,
      render: (code: string) => <span className="font-mono text-xs">{code}</span>,
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      key: 'productName',
      render: (name: string | null, c) => (
        <div style={{ minWidth: 200, maxWidth: 300, whiteSpace: 'normal' }}>
          <span>{name ?? '—'}</span>
          {c.dqFlags.map((flag) => {
            const f = DQ_FLAGS[flag]
            return (
              <Tooltip key={flag} title={f?.help ?? flag}>
                <Tag color={f?.color} style={{ marginLeft: 6, fontSize: 11 }}>{f?.label ?? flag}</Tag>
              </Tooltip>
            )
          })}
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
      render: (price: number | null) => (price === 0 ? <Tag color="green">Free</Tag> : formatIdr(price)),
    },
    {
      title: 'Subtotal',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 110,
      align: 'right',
      render: (value: number | null) => formatIdr(value),
    },
    {
      title: 'Price Ratio',
      dataIndex: 'priceRatio',
      key: 'priceRatio',
      width: 150,
      render: (ratio: number | null) =>
        ratio === null ? '—' : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress percent={ratio} showInfo={false} size="small" style={{ width: 64, margin: 0 }} />
            <span className="font-mono text-xs">{ratio.toFixed(2)}%</span>
          </div>
        ),
    },
  ]

  // Stored ratios sum to 1 per bundle; the 2-dp shares shown can add up to 99.99%
  const ratioSum = bundle.components.reduce((sum, c) => sum + (c.priceRatio ?? 0), 0)
  const ratioTotal = Math.abs(ratioSum - 100) < 0.1 ? 100 : ratioSum

  return (
    <Table<SkuBundleComponent>
      rowKey="seq"
      size="small"
      columns={columns}
      dataSource={bundle.components}
      pagination={false}
      scroll={{ x: 'max-content' }}
      summary={() => (
        <Table.Summary.Row>
          <Table.Summary.Cell index={0} colSpan={4} align="right">
            <Typography.Text strong>Bundle total</Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={4} align="right">
            <Typography.Text strong>{bundle.totalQty}</Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={5} />
          <Table.Summary.Cell index={6} align="right">
            <Typography.Text strong>{formatIdr(bundle.bundlePrice)}</Typography.Text>
          </Table.Summary.Cell>
          <Table.Summary.Cell index={7}>
            <Typography.Text strong className="font-mono text-xs">{ratioTotal.toFixed(2)}%</Typography.Text>
          </Table.Summary.Cell>
        </Table.Summary.Row>
      )}
    />
  )
}

export const SkuBundlingView: React.FC = () => {
  const { getBundles, bundles, totalBundles } = useStore()
  const [authToken] = useLocalStorage('access_token')

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [filters, setFilters] = useState<Record<string, FilterValue | null>>({})
  const [sorter, setSorter] = useState<SorterResult<SkuBundleRow> | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const payload: SkuListPayload = {
    page,
    size: pageSize,
    filter: Object.fromEntries(
      Object.entries(filters)
        .filter(([, value]) => value && value[0] !== undefined && value[0] !== '')
        .map(([key, value]) => [FILTER_KEY[key] ?? key, String(value![0])])
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
    getBundles(authToken.access_token, body)
      .catch((err) => message.error(extractErrorMessage(err, 'Failed to load SKU bundles')))
      .finally(() => setLoadedKey(requestKey))
  }, [requestKey, authToken.access_token, getBundles])

  const getColumnSearchProps = (label: string): TableColumnType<SkuBundleRow> => ({
    filterDropdown: (props) => <ColumnSearchDropdown {...props} label={label} />,
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#4f46e5' : undefined }} />
    ),
  })

  const sortable = (key: string): TableColumnType<SkuBundleRow> => ({
    sorter: true,
    sortOrder: sorter?.columnKey === key ? sorter.order : null,
    filteredValue: filters[key] ?? null,
  })

  const columns: TableProps<SkuBundleRow>['columns'] = [
    {
      title: 'Bundle SKU ID',
      dataIndex: 'skuId',
      key: 'skuId',
      width: 160,
      ...sortable('skuId'),
      ...getColumnSearchProps('SKU ID'),
      render: (id: string) => <span className="sku-id-badge font-mono font-semibold">{id}</span>,
    },
    {
      title: 'Latest Seller SKU',
      dataIndex: 'sellerSku',
      key: 'sellerSku',
      width: 200,
      ...sortable('sellerSku'),
      ...getColumnSearchProps('seller SKU'),
      render: (code: string | null) => <span className="font-mono text-xs">{code ?? '—'}</span>,
    },
    {
      title: 'Product Name',
      dataIndex: 'productName',
      key: 'productName',
      ...sortable('productName'),
      ...getColumnSearchProps('product name'),
      // long marketplace names wrap so Components / Bundle Price stay in view
      render: (name: string) => (
        <span className="font-semibold text-slate-900" style={{ display: 'block', minWidth: 240, maxWidth: 400, whiteSpace: 'normal' }}>
          {name}
        </span>
      ),
    },
    {
      title: 'Components',
      dataIndex: 'componentCount',
      key: 'componentCount',
      width: 130,
      align: 'center',
      ...sortable('componentCount'),
      ...getColumnSearchProps('component SKU or name'),
      render: (count: number, record) => (
        <Tooltip title={`${record.totalQty} item(s) in total`}>
          <Tag>{count} item{count === 1 ? '' : 's'}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Bundle Price',
      dataIndex: 'bundlePrice',
      key: 'bundlePrice',
      width: 130,
      align: 'right',
      render: (price: number | null) => <span className="font-semibold">{formatIdr(price)}</span>,
    },
  ]

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 8,
        },
      }}
    >
      <div className="view-container sku-view">
        <div className="sku-toolbar">
          <SampleDownload file="sku_bundling_sample.xlsx">Download Sample</SampleDownload>
          <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
            Upload Bundle File
          </Button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Table<SkuBundleRow>
            rowKey="id"
            columns={columns}
            dataSource={bundles}
            loading={loadedKey !== requestKey}
            expandable={{
              expandedRowRender: (record) => <ComponentTable bundle={record} />,
              expandedRowKeys: expandedKeys,
              onExpandedRowsChange: (keys) => setExpandedKeys([...keys]),
              expandRowByClick: true,
            }}
            pagination={{
              current: page,
              pageSize,
              total: totalBundles,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
              showTotal: (total) => `Total ${total} bundles`,
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
              setExpandedKeys([])
            }}
          />
        </div>

        {uploadOpen && (
          <BundleUploadModal
            onClose={() => setUploadOpen(false)}
            onApplied={() => {
              setExpandedKeys([])
              setReloadTick((t) => t + 1)
            }}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
