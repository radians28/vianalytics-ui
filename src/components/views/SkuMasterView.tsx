import React, { useState } from 'react'
import { Table, Tag, Button, Popconfirm, ConfigProvider } from 'antd'
import type { TableColumnType, TableProps } from 'antd'
import {
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
} from '@ant-design/icons'
import { ColumnSearchDropdown } from '../ColumnSearchDropdown'

interface SkuItem {
  id: string
  name: string
  category: string
  code: string
  quantity: number
  status: 'In Stock' | 'Low Stock' | 'Out of Stock'
}

const INITIAL_SKUS: SkuItem[] = [
  {
    id: 'SKU-001092',
    name: 'Ultra-Light Running Shoes',
    category: 'Footwear',
    code: '8901248901',
    quantity: 142,
    status: 'In Stock',
  },
  {
    id: 'SKU-001093',
    name: 'Merino Wool Trail Socks',
    category: 'Apparel',
    code: '8901248902',
    quantity: 28,
    status: 'Low Stock',
  },
  {
    id: 'SKU-001094',
    name: 'Hydration Flask 750ml',
    category: 'Accessories',
    code: '8901248903',
    quantity: 0,
    status: 'Out of Stock',
  },
  {
    id: 'SKU-001095',
    name: 'Reflective Windbreaker Jacket',
    category: 'Apparel',
    code: '8901248904',
    quantity: 65,
    status: 'In Stock',
  },
  {
    id: 'SKU-001096',
    name: 'All-Terrain Trekking Poles',
    category: 'Equipment',
    code: '8901248905',
    quantity: 19,
    status: 'Low Stock',
  },
  {
    id: 'SKU-001097',
    name: 'Polarized Performance Sunglasses',
    category: 'Accessories',
    code: '8901248906',
    quantity: 84,
    status: 'In Stock',
  },
]

const STATUS_OPTIONS: SkuItem['status'][] = [
  'In Stock',
  'Low Stock',
  'Out of Stock',
]

export const SkuMasterView: React.FC = () => {
  const [skuList, setSkuList] = useState<SkuItem[]>(INITIAL_SKUS)

  const handleDelete = (id: string) => {
    setSkuList((prev) => prev.filter((item) => item.id !== id))
  }

  // Reusable per-column text search (rendered in the column header dropdown)
  const getColumnSearchProps = (
    dataIndex: keyof SkuItem,
    label: string
  ): TableColumnType<SkuItem> => ({
    filterDropdown: (props) => (
      <ColumnSearchDropdown {...props} label={label} />
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#4f46e5' : undefined }} />
    ),
    onFilter: (value, record) =>
      String(record[dataIndex])
        .toLowerCase()
        .includes(String(value).toLowerCase()),
  })

  // Category filter options derived from the current catalog
  const categoryFilters = Array.from(
    new Set(skuList.map((item) => item.category))
  )
    .sort()
    .map((category) => ({ text: category, value: category }))

  const columns: TableProps<SkuItem>['columns'] = [
    {
      title: 'SKU ID',
      dataIndex: 'id',
      key: 'id',
      width: 160,
      sorter: (a, b) => a.id.localeCompare(b.id),
      ...getColumnSearchProps('id', 'SKU ID'),
      render: (id: string) => (
        <span className="sku-id-badge font-mono font-semibold">{id}</span>
      ),
    },
    {
      title: 'Product Name',
      dataIndex: 'name',
      key: 'name',
      sorter: (a, b) => a.name.localeCompare(b.name),
      ...getColumnSearchProps('name', 'product name'),
      render: (name: string) => (
        <span className="font-semibold text-slate-900">{name}</span>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      filters: categoryFilters,
      onFilter: (value, record) => record.category === value,
      sorter: (a, b) => a.category.localeCompare(b.category),
    },
    {
      title: 'Barcode / Code',
      dataIndex: 'code',
      key: 'code',
      width: 160,
      sorter: (a, b) => a.code.localeCompare(b.code),
      ...getColumnSearchProps('code', 'barcode'),
      render: (code: string) => <span className="font-mono text-xs">{code}</span>,
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      sorter: (a, b) => a.quantity - b.quantity,
      render: (qty: number) => <span className="font-semibold">{qty}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      filters: STATUS_OPTIONS.map((status) => ({ text: status, value: status })),
      onFilter: (value, record) => record.status === value,
      sorter: (a, b) => a.status.localeCompare(b.status),
      render: (status: SkuItem['status']) => {
        let color = 'green'
        if (status === 'Low Stock') color = 'warning'
        if (status === 'Out of Stock') color = 'error'

        return (
          <Tag color={color} style={{ borderRadius: 12, padding: '2px 10px' }}>
            {status}
          </Tag>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 130,
      align: 'right',
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => alert(`Edit ${record.id}`)}
          />
          <Popconfirm
            title="Delete SKU"
            description={`Are you sure you want to delete ${record.id}?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </div>
      ),
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
        {/* Ant Design SKU Table Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Table<SkuItem>
            rowKey="id"
            columns={columns}
            dataSource={skuList}
            pagination={{
              pageSize: 5,
              showSizeChanger: true,
              pageSizeOptions: ['5', '10', '20'],
              showTotal: (total) => `Total ${total} items`,
            }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </div>
    </ConfigProvider>
  )
}
