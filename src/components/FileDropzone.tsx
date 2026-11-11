import React, { useEffect, useId, useRef, useState } from 'react'
import { message } from 'antd'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  LoadingOutlined,
  ReloadOutlined,
} from '@ant-design/icons'

const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv']

// Per-file state of a staged upload
export type StagedStatus = 'ready' | 'uploading' | 'done' | 'failed'

// Called by onSubmit for each file it handles: index into the files it was given
export type StagedReport = (index: number, status: StagedStatus, detail?: string) => void

interface FileDropzoneProps {
  heading: React.ReactNode
  description: React.ReactNode
  busy: boolean
  busyLabel?: string
  buttonLabel?: string
  multiple?: boolean
  // Immediate mode: called with the files that have a supported extension (others are reported and dropped)
  onFiles?: (files: File[]) => void
  // Staged mode: files are collected into a list first, then sent with the submit button.
  // onSubmit gets the files to send and reports each one's progress; one file = one request.
  staged?: boolean
  onSubmit?: (files: File[], report: StagedReport) => Promise<void>
  submitLabel?: string
  // A change (e.g. another marketplace) clears the staged list
  resetKey?: string
  // Extra buttons next to the select button, e.g. a sample download
  actions?: React.ReactNode
}

interface StagedItem {
  key: string
  file: File
  status: StagedStatus
  detail?: string
}

const fileKey = (file: File) => `${file.name}|${file.size}|${file.lastModified}`

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const STATUS_ICON: Record<StagedStatus, React.ReactNode> = {
  ready: <ClockCircleOutlined />,
  uploading: <LoadingOutlined />,
  done: <CheckCircleOutlined />,
  failed: <CloseCircleOutlined />,
}

// Drag & drop area with a "select files" button; shared by the upload pages
export const FileDropzone: React.FC<FileDropzoneProps> = ({
  heading,
  description,
  busy,
  busyLabel = 'Uploading...',
  buttonLabel,
  multiple = true,
  onFiles,
  staged = false,
  onSubmit,
  submitLabel = 'Queue',
  resetKey,
  actions,
}) => {
  const inputId = useId()
  const [isDragging, setIsDragging] = useState(false)
  const [items, setItems] = useState<StagedItem[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const locked = busy || running

  // Another marketplace: staged files belong to the previous one
  const lastResetKey = useRef(resetKey)
  useEffect(() => {
    if (lastResetKey.current !== resetKey) {
      lastResetKey.current = resetKey
      setItems([])
      setProgress(null)
    }
  }, [resetKey])

  const accept = (files: File[]) => {
    const accepted = files.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        message.error(`${file.name}: unsupported file type (.xlsx, .xls, .csv only)`)
        return false
      }
      return true
    })
    if (accepted.length === 0) return
    const picked = multiple ? accepted : accepted.slice(0, 1)
    if (!staged) {
      onFiles?.(picked)
      return
    }
    setItems((prev) => {
      const known = new Set(prev.map((i) => i.key))
      const added = picked
        .filter((file) => !known.has(fileKey(file)))
        .map((file) => ({ key: fileKey(file), file, status: 'ready' as StagedStatus }))
      if (added.length < picked.length) message.info('Files already in the list were skipped')
      return multiple ? [...prev, ...added] : added.slice(0, 1)
    })
  }

  // Sends `keys` in list order (one request per file, so they enter the queue in that order)
  const submit = async (keys: string[]) => {
    if (!onSubmit || keys.length === 0) return
    const batch = items.filter((i) => keys.includes(i.key))
    setRunning(true)
    setProgress({ done: 0, total: batch.length })
    const report: StagedReport = (index, status, detail) => {
      const key = batch[index]?.key
      if (!key) return
      setItems((prev) => prev.map((i) => (i.key === key ? { ...i, status, detail } : i)))
      if (status === 'done' || status === 'failed') {
        setProgress((p) => (p ? { ...p, done: p.done + 1 } : p))
      }
    }
    try {
      await onSubmit(batch.map((i) => i.file), report)
    } finally {
      setRunning(false)
      // sent files leave the list; failed ones stay for a retry
      setItems((prev) => prev.filter((i) => i.status !== 'done'))
      setProgress(null)
    }
  }

  const pending = items.filter((i) => i.status === 'ready' || i.status === 'failed')
  const failedCount = items.filter((i) => i.status === 'failed').length
  const selectLabel = buttonLabel ?? (staged ? 'Select Files' : 'Select & Queue Files')

  return (
    <div
      className={`dropzone-card ${isDragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0 && !locked) accept(files)
      }}
    >
      <input
        type="file"
        id={inputId}
        className="file-input-hidden"
        multiple={multiple}
        accept=".xlsx,.xls,.csv"
        disabled={locked}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) accept(Array.from(e.target.files))
          // Clear so selecting the same file again still fires onChange
          e.target.value = ''
        }}
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
      <h3 className="dropzone-heading">{heading}</h3>
      <p className="dropzone-sub">{description}</p>

      <div className="dropzone-actions">
        <label
          htmlFor={inputId}
          className={`btn ${staged && items.length > 0 ? 'btn-secondary' : 'btn-primary'} cursor-pointer`}
          aria-disabled={locked}
          style={locked ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!staged && busy ? busyLabel : staged && items.length > 0 ? 'Add Files' : selectLabel}
        </label>
        {actions}
      </div>

      {staged && items.length > 0 && (
        <div className="staged-files" onClick={(e) => e.stopPropagation()}>
          <div className="staged-files-header">
            <span>
              {items.length} file{items.length === 1 ? '' : 's'}
              {failedCount > 0 && !running && <span className="staged-files-failed"> · {failedCount} failed</span>}
            </span>
            {progress && <span className="staged-files-progress">{progress.done} / {progress.total}</span>}
          </div>
          <ul className="staged-file-list">
            {items.map((item) => (
              <li key={item.key} className={`staged-file staged-file-${item.status}`}>
                <span className="staged-file-icon">{STATUS_ICON[item.status]}</span>
                <span className="staged-file-name" title={item.file.name}>{item.file.name}</span>
                <span className="staged-file-size">{formatSize(item.file.size)}</span>
                <span className="staged-file-detail" title={item.detail}>
                  {item.status === 'uploading' ? busyLabel : item.detail ?? ''}
                </span>
                {item.status === 'failed' && !locked && (
                  <button
                    type="button"
                    className="staged-file-action"
                    title="Retry this file"
                    onClick={() => void submit([item.key])}
                  >
                    <ReloadOutlined />
                  </button>
                )}
                {(item.status === 'ready' || item.status === 'failed') && !locked && (
                  <button
                    type="button"
                    className="staged-file-action"
                    title="Remove from the list"
                    onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))}
                  >
                    <CloseOutlined />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="staged-files-footer">
            <button type="button" className="btn btn-secondary" disabled={locked} onClick={() => setItems([])}>
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={locked || pending.length === 0}
              onClick={() => void submit(pending.map((i) => i.key))}
            >
              {running
                ? busyLabel
                : `${failedCount === pending.length && failedCount > 0 ? 'Retry' : submitLabel} ${pending.length} file${pending.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// A link styled as a secondary button that downloads one of the files in public/templates
export const SampleDownload: React.FC<{ file: string; children: React.ReactNode }> = ({ file, children }) => (
  <a className="btn btn-secondary" href={`/templates/${file}`} download={file}>
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
    {children}
  </a>
)
