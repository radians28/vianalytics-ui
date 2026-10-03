import React, { useState } from 'react'

export interface UnmatchedSkuItem {
  id: string
  rawTitle: string
  rawSku: string
  marketplace: string
  suggestedSkuId: string
  suggestedTitle: string
  suggestedCategory: string
  similarityScore: number
  status: 'pending' | 'mapped' | 'created_new'
}

interface SkuSanitizeModalProps {
  isOpen: boolean
  fileName: string
  marketplace: string
  onClose: () => void
  onResumeEtl: () => void
}

const SAMPLE_UNMATCHED: UnmatchedSkuItem[] = [
  {
    id: 'unmatched-1',
    rawTitle: 'Sepatu Lari Ultra-Light Black 42',
    rawSku: 'TKP-SHOES-UL-BLK-42',
    marketplace: 'Tokopedia',
    suggestedSkuId: 'SKU-001092',
    suggestedTitle: 'Ultra-Light Running Shoes',
    suggestedCategory: 'Footwear',
    similarityScore: 94,
    status: 'pending',
  },
  {
    id: 'unmatched-2',
    rawTitle: 'Kaos Kaki Lari Merino Breathable',
    rawSku: 'TKP-SOCKS-MRN-01',
    marketplace: 'Tokopedia',
    suggestedSkuId: 'SKU-001093',
    suggestedTitle: 'Merino Wool Trail Socks',
    suggestedCategory: 'Apparel',
    similarityScore: 89,
    status: 'pending',
  },
]

export const SkuSanitizeModal: React.FC<SkuSanitizeModalProps> = ({
  isOpen,
  fileName,
  marketplace,
  onClose,
  onResumeEtl,
}) => {
  const [items, setItems] = useState<UnmatchedSkuItem[]>(SAMPLE_UNMATCHED)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (!isOpen) return null

  const currentItem = items[currentIndex] || items[0]
  const allResolved = items.every((i) => i.status !== 'pending')

  const handleApproveMapping = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'mapped' } : item))
    )
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handleCreateNewSku = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: 'created_new' } : item
      )
    )
    if (currentIndex < items.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handleResume = () => {
    onResumeEtl()
    onClose()
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-container" role="dialog" aria-modal="true">
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-header-info">
            <div className="modal-icon-alert">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h3 className="modal-title">SKU Sanitization & Name Similarity Resolution</h3>
              <p className="modal-subtitle">
                File: <span className="font-mono text-highlight">{fileName}</span> ({marketplace})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          <div className="etl-condition-notice">
            <div className="notice-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="notice-text">
              Transaction SKU does not exist in{' '}
              <strong>SKU Master</strong>, but the incoming raw product title matches an existing
              catalog item with high similarity. Review and validate mappings below to resume the
              pipeline.
            </div>
          </div>

          {/* Similarity Card */}
          <div className="similarity-card">
            <div className="similarity-card-header">
              <span className="item-counter">
                Item {currentIndex + 1} of {items.length}
              </span>
              <span className="similarity-badge">
                <svg fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {currentItem.similarityScore}% Name Similarity
              </span>
            </div>

            <div className="comparison-grid">
              {/* Raw Transaction Info */}
              <div className="source-record-box">
                <span className="box-tag tag-source">Incoming Transaction Record</span>
                <div className="record-title">{currentItem.rawTitle}</div>
                <div className="record-meta font-mono">Raw SKU: {currentItem.rawSku}</div>
                <div className="record-source">Marketplace: {currentItem.marketplace}</div>
              </div>

              {/* Suggested SKU Master Match */}
              <div className="target-record-box">
                <span className="box-tag tag-target">Suggested Master SKU</span>
                <div className="record-title">{currentItem.suggestedTitle}</div>
                <div className="record-meta font-mono text-primary-color">
                  {currentItem.suggestedSkuId} • {currentItem.suggestedCategory}
                </div>
                <div className="record-source">
                  Status:{' '}
                  {currentItem.status === 'mapped'
                    ? '✓ Mapped'
                    : currentItem.status === 'created_new'
                      ? '✓ Registered as New SKU'
                      : 'Pending Approval'}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="comparison-actions">
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => handleCreateNewSku(currentItem.id)}
              >
                + Create as New SKU in Master
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs"
                onClick={() => handleApproveMapping(currentItem.id)}
              >
                ✓ Map to {currentItem.suggestedSkuId}
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <span className="footer-status-text">
            {items.filter((i) => i.status !== 'pending').length} of {items.length} items mapped
          </span>
          <div className="footer-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Close
            </button>
            <button
              type="button"
              onClick={handleResume}
              className="btn btn-success"
              title={
                allResolved
                  ? 'Resume ETL processing'
                  : 'Resume ETL with current mappings'
              }
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Approve & Resume ETL Process</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

