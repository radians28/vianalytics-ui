import React, { useId, useState } from 'react'
import { message } from 'antd'

const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'csv']

interface FileDropzoneProps {
  heading: React.ReactNode
  description: React.ReactNode
  busy: boolean
  busyLabel?: string
  buttonLabel?: string
  multiple?: boolean
  // Called with the files that have a supported extension (others are reported and dropped)
  onFiles: (files: File[]) => void
  // Extra buttons next to the select button, e.g. a sample download
  actions?: React.ReactNode
}

// Drag & drop area with a "select files" button; shared by the upload pages
export const FileDropzone: React.FC<FileDropzoneProps> = ({
  heading,
  description,
  busy,
  busyLabel = 'Uploading...',
  buttonLabel = 'Select & Queue Files',
  multiple = true,
  onFiles,
  actions,
}) => {
  const inputId = useId()
  const [isDragging, setIsDragging] = useState(false)

  const accept = (files: File[]) => {
    const accepted = files.filter((file) => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        message.error(`${file.name}: unsupported file type (.xlsx, .xls, .csv only)`)
        return false
      }
      return true
    })
    if (accepted.length > 0) onFiles(multiple ? accepted : accepted.slice(0, 1))
  }

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
        if (files.length > 0 && !busy) accept(files)
      }}
    >
      <input
        type="file"
        id={inputId}
        className="file-input-hidden"
        multiple={multiple}
        accept=".xlsx,.xls,.csv"
        disabled={busy}
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
          className="btn btn-primary cursor-pointer"
          aria-disabled={busy}
          style={busy ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {busy ? busyLabel : buttonLabel}
        </label>
        {actions}
      </div>
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
