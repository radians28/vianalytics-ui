import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Button, ConfigProvider } from 'antd'
import type { TableColumnType, TableProps } from 'antd'
import {
  RightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { SkuSanitizeModal } from '../SkuSanitizeModal'
import { ColumnSearchDropdown } from '../ColumnSearchDropdown'
import useStore from '../../store/store'
import { useLocalStorage } from '../../hooks/useLocalStorage'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'

export type MarketplaceType =
  | 'Shopee'
  | 'Tokopedia'
  | 'Lazada'
  | 'TikTok Shop'
  | 'Blibli'
  // | 'Custom / Other'

export type ProcessingStatus =
  | 'Processing'
  | 'Paused'
  | 'Queued'
  | 'Completed'
  | 'Failed'

export interface PipelineJob {
  id: string
  fifoOrder?: number
  fileName: string
  marketplace: MarketplaceType
  size: string
  recordsSummary: string
  status: ProcessingStatus
  statusDetail?: string
  timestamp: string
}

export const UploadView: React.FC = () => {
  const { getProgressUpload, jobs, totalJobs, setJobs } = useStore();
  const [authToken] = useLocalStorage('access_token');
  const navigate = useNavigate()
  const [page, setPage] = useState(1);
      const [pageSize, setPageSize] = useState(5);
      const [filters, setFilters] = useState<Record<string, FilterValue | null>>({});
      const [sorter, setSorter] = useState<SorterResult<any> | null>(null);
  const [selectedMarketplace, setSelectedMarketplace] =
    useState<MarketplaceType>('Shopee')
  const [isDragging, setIsDragging] = useState(false)
  const [selectedPausedJob, setSelectedPausedJob] = useState<PipelineJob | null>(
    null
  )
  // Shared FIFO priority used both for the default sort and the Status column sorter
  const statusPriority = (status: ProcessingStatus) => {
    switch (status) {
      case 'Processing':
        return 1
      case 'Paused':
        return 2
      case 'Queued':
        return 3
      case 'Completed':
        return 4
      case 'Failed':
        return 5
    }
  }

  // Per-column search dropdown for the Job File column
  const fileColumnSearchProps: TableColumnType<PipelineJob> = {
    filterDropdown: (props) => (
      <ColumnSearchDropdown {...props} label="file name" />
    ),
    filterIcon: (filtered: boolean) => (
      <SearchOutlined style={{ color: filtered ? '#4f46e5' : undefined }} />
    ),
    onFilter: () => true,
  }

  const marketplaces: { name: MarketplaceType; code: string; color: string }[] =
    [
      { name: 'Shopee', code: 'SP', color: 'orange' },
      { name: 'Tokopedia', code: 'TK', color: 'emerald' },
      { name: 'Lazada', code: 'LZ', color: 'blue' },
      { name: 'TikTok Shop', code: 'TT', color: 'slate' },
      { name: 'Blibli', code: 'BL', color: 'sky' },
      // { name: 'Custom / Other', code: '+', color: 'indigo' },
    ]

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      queueFiles(files)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      queueFiles(Array.from(e.target.files))
    }
  }

  const queueFiles = (files: File[]) => {
    const nextOrder =
      jobs.filter((j) => j.status === 'Queued' || j.status === 'Processing').length + 1

    const newJobs: PipelineJob[] = files.map((file, idx) => ({
      id: `job-${Date.now()}-${idx}`,
      fifoOrder: nextOrder + idx,
      fileName: file.name,
      marketplace: selectedMarketplace,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      recordsSummary: 'Waiting in FIFO queue for processing',
      status: 'Queued',
      timestamp: 'Just now',
    }))

    setJobs((prev) => [...newJobs, ...prev])
  }

  const handleResumeJob = (jobId: string) => {
    setJobs((prev) =>
      prev.map((job) =>
        job.id === jobId
          ? {
              ...job,
              status: 'Completed',
              recordsSummary: 'All 14 SKUs sanitized & mapped to SKU Master',
              statusDetail: undefined,
            }
          : job
      )
    )
  }

  const sortedJobs = [...jobs].sort(
    (a, b) => statusPriority(a.status) - statusPriority(b.status)
  )

  // Ant Design Table Columns for Data Processing Pipeline
  const columns: TableProps<PipelineJob>['columns'] = [
    {
      title: 'Queue # / Job File',
      key: 'fileName',
      dataIndex: 'fileName',
      width: 260,
      sorter: true,
      sortOrder: sorter?.columnKey === 'fileName' ? sorter.order : null,
      filteredValue: filters.fileName ?? null,
      ...fileColumnSearchProps,
      render: (_, record) => {
        const isProcessing = record.status === 'Processing'
        const isPaused = record.status === 'Paused'
        const isQueued = record.status === 'Queued'

        return (
          <div className="job-file-cell">
            {isProcessing && (
              <span className="queue-pill pill-processing">#1 Now</span>
            )}
            {isPaused && (
              <span className="queue-pill pill-paused">Paused</span>
            )}
            {isQueued && (
              <span className="queue-pill pill-queued">
                #{record.fifoOrder || 2}
              </span>
            )}
            {record.status === 'Completed' && (
              <span className="queue-pill pill-completed">Done</span>
            )}
            <span className="job-filename">{record.fileName}</span>
          </div>
        )
      },
    },
    {
      title: 'Marketplace',
      dataIndex: 'marketplace',
      key: 'marketplace',
      width: 150,
      filters: marketplaces.map((m) => ({ text: m.name, value: m.name })),
      onFilter: () => true,
      filteredValue: filters.marketplace ?? null,
      sorter: true,
      sortOrder: sorter?.columnKey === 'marketplace' ? sorter.order : null,
      render: (mkt: MarketplaceType) => (
        <span
          className={`mkt-tag mkt-tag-${mkt.toLowerCase().replace(/[^a-z]/g, '')}`}
        >
          {mkt}
        </span>
      ),
    },
    {
      title: 'Records & Ingestion Details',
      key: 'details',
      width: 340,
      render: (_, record) => (
        <div className="job-records-cell">
          <span className="job-size">{record.size}</span> •{' '}
          <span
            className={
              record.status === 'Paused' ? 'font-semibold text-danger' : ''
            }
          >
            {record.recordsSummary}
          </span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 190,
      sorter: true,
      sortOrder: sorter?.columnKey === 'status' ? sorter.order : null,
      filters: [
        {
          text: 'Processing',
          value: 'Processing'
        }, {
          text: 'Paused',
          value: 'Paused'
        }, {
          text: 'Queued',
          value: 'Queued'
        }, {
          text: 'Completed',
          value: 'Completed'
        }, {
          text: 'Failed',
          value: 'Failed'
        },
      ],
      onFilter: () => true,
      filteredValue: filters.status ?? null,
      render: (status: ProcessingStatus) => {
        if (status === 'Processing') {
          return (
            <span className="status-tag status-processing-animated">
              <LoadingOutlined style={{ fontSize: 13 }} spin />
              Processing ETL
            </span>
          )
        }
        if (status === 'Paused') {
          return (
            <span className="status-tag status-paused-tag">
              <ExclamationCircleOutlined style={{ fontSize: 13 }} />
              Paused (Action Req.)
            </span>
          )
        }
        if (status === 'Queued') {
          return (
            <span className="status-tag status-queued-tag">
              <ClockCircleOutlined style={{ fontSize: 13 }} />
              Queued
            </span>
          )
        }
        return (
          <span className="status-tag status-completed">
            <CheckCircleOutlined style={{ fontSize: 13, color: '#059669' }} />
            Completed
          </span>
        )
      },
    },
    {
      title: 'Action / Resolution',
      key: 'action',
      align: 'right',
      fixed: 'right',
      width: 180,
      render: (_, record) => {
        if (record.status === 'Paused') {
          return (
            <button
              type="button"
              className="btn btn-warning-action"
              onClick={() => setSelectedPausedJob(record)}
            >
              <span>Validate & Sanitize</span>
              <RightOutlined style={{ fontSize: 11 }} />
            </button>
          )
        }
        if (record.status === 'Completed') {
          return (
            <Button
              type="link"
              size="small"
              onClick={() => navigate('/sku')}
              style={{ padding: 0, fontWeight: 600 }}
            >
              View in SKU Master →
            </Button>
          )
        }
        if (record.status === 'Processing') {
          return <span className="subtle-status">Auto-ingesting...</span>
        }
        return <span className="subtle-status">Waiting in queue</span>
      },
    },
  ]

  const fetchProgress = () => {
    const filterPayload = Object.fromEntries(
            Object.entries(filters)
                .filter(([, value]) => value && value[0] !== undefined && value[0] !== '')
                .map(([key, value]) => [key, value![0]])
        );
        const sortPayload = sorter?.order && sorter.columnKey
            ? { [String(sorter.columnKey)]: sorter.order === 'ascend' ? 'asc' : 'desc' }
            : {};

    getProgressUpload(authToken.access_token, {
      page,
            size: pageSize,
            filter: filterPayload,
            sort: sortPayload,
    });
  }

  useEffect(() => {
    fetchProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters, sorter, authToken.access_token, getProgressUpload]);

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4f46e5',
          borderRadius: 8,
        },
      }}
    >
      <div className="view-container upload-view">
        {/* Step 1: Marketplace Selection */}
        <div className="card marketplace-card">
          <div className="card-header-flex">
            <div>
              <h3 className="section-title">
                <span className="step-num">1</span>
                Select Marketplace
              </h3>
              <p className="section-desc">
                Choose the target marketplace before uploading raw transaction or inventory
                manifests
              </p>
            </div>
            <span className="badge-active-mkt">
              Active: <strong>{selectedMarketplace}</strong>
            </span>
          </div>

          <div className="marketplace-grid">
            {marketplaces.map((mkt) => {
              const isSelected = selectedMarketplace === mkt.name
              return (
                <button
                  key={mkt.name}
                  type="button"
                  onClick={() => setSelectedMarketplace(mkt.name)}
                  className={`mkt-button ${isSelected ? 'selected' : ''} mkt-${mkt.color}`}
                >
                  <div className={`mkt-avatar avatar-${mkt.color}`}>{mkt.code}</div>
                  <span className="mkt-title">{mkt.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Upload Dropzone */}
        <div
          className={`dropzone-card ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload-input"
            className="file-input-hidden"
            multiple
            accept=".xlsx,.xls"
            onChange={handleFileInput}
          />
          <div className="dropzone-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h3 className="dropzone-heading">
            Upload <span className="highlight-text">{selectedMarketplace}</span> Transaction & SKU Data
          </h3>
          <p className="dropzone-sub">
            Files are automatically queued and processed in order. Supported
            formats: <strong>.XLSX</strong>, <strong>.XLS</strong>
          </p>

          <div className="dropzone-actions">
            <label htmlFor="file-upload-input" className="btn btn-primary cursor-pointer">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Select & Queue Files
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => alert(`Sample template for ${selectedMarketplace} downloaded.`)}
            >
              Download {selectedMarketplace} Template
            </button>
          </div>
        </div>

        {/* Step 3: Ant Design Data Processing Pipeline Table */}
        <div className="card pipeline-card">
          <div className="card-header-flex">
            <div>
              <h4 className="section-title">
                <span className="status-dot-pulse"></span>
                Data Processing Pipeline
              </h4>
              <p className="section-desc">
                Active ETL jobs are pinned to the top in execution order
              </p>
            </div>
            <span className="badge-count">{jobs.length} Total Jobs</span>
          </div>

          <Table<PipelineJob>
            rowKey="id"
            columns={columns}
            dataSource={sortedJobs}
            pagination={{
                            current: page,
                            pageSize,
                            total: totalJobs,
                            showSizeChanger: true,
                            pageSizeOptions: ['5', '10', '20'],
                            showTotal: () => `Total ${totalJobs} members`,
                        }}
            scroll={{ x: 'max-content' }}
            rowClassName={(record) =>
              record.status === 'Paused'
                ? 'row-paused'
                : record.status === 'Processing'
                  ? 'row-processing'
                  : ''
            }
            onChange={(pagination, nextFilters, nextSorter) => {
                            const nextSorterResult = Array.isArray(nextSorter) ? nextSorter[0] ?? null : nextSorter;
                            const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(filters);
                            const sorterChanged =
                                nextSorterResult?.field !== sorter?.field ||
                                nextSorterResult?.order !== sorter?.order;

                            setFilters(nextFilters);
                            setSorter(nextSorterResult);
                            setPageSize(pagination.pageSize ?? pageSize);
                            // A new filter/sort makes the old page number meaningless, so jump back to page 1.
                            setPage(filtersChanged || sorterChanged ? 1 : (pagination.current ?? 1));
                        }}
          />
        </div>

        {/* Sku Sanitization Modal */}
        {selectedPausedJob && (
          <SkuSanitizeModal
            isOpen={Boolean(selectedPausedJob)}
            fileName={selectedPausedJob.fileName}
            marketplace={selectedPausedJob.marketplace}
            onClose={() => setSelectedPausedJob(null)}
            onResumeEtl={() => handleResumeJob(selectedPausedJob.id)}
          />
        )}
      </div>
    </ConfigProvider>
  )
}
