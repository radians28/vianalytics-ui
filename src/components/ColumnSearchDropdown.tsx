import React, { useEffect, useRef } from 'react'
import { Button, Input, Space } from 'antd'
import type { InputRef } from 'antd'
import type { FilterDropdownProps } from 'antd/es/table/interface'
import { SearchOutlined } from '@ant-design/icons'

interface ColumnSearchDropdownProps extends FilterDropdownProps {
  /** Human readable field name shown in the input placeholder */
  label: string
}

/**
 * Header-level text search rendered inside an Ant Design column filter dropdown.
 * Kept as a real component (rather than an inline render function) so the focus
 * ref is created and read outside of the parent's render pass.
 */
export const ColumnSearchDropdown: React.FC<ColumnSearchDropdownProps> = ({
  label,
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  close,
}) => {
  const inputRef = useRef<InputRef>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.select(), 80)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
      <Input
        ref={inputRef}
        placeholder={`Search ${label}`}
        value={selectedKeys[0]}
        onChange={(e) =>
          setSelectedKeys(e.target.value ? [e.target.value] : [])
        }
        onPressEnter={() => confirm()}
        style={{ marginBottom: 8, display: 'block', width: 220 }}
      />
      <Space>
        <Button
          type="primary"
          size="small"
          icon={<SearchOutlined />}
          onClick={() => confirm()}
        >
          Search
        </Button>
        <Button
          size="small"
          onClick={() => {
            clearFilters?.()
            confirm()
          }}
        >
          Reset
        </Button>
        <Button type="link" size="small" onClick={() => close()}>
          Close
        </Button>
      </Space>
    </div>
  )
}
