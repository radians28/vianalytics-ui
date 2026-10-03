import React from 'react'

export type TabType = 'upload' | 'sku' | 'team'

interface SidebarProps {
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  isAdmin: boolean
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isAdmin,
}) => {
  return (
    <aside
      className={`sidebar-container ${isCollapsed ? 'collapsed' : 'expanded'}`}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-wrapper">
          {!isCollapsed && <div className="brand-logo" title="Vianalytics">
            <svg
              className="icon-logo"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>}
          {!isCollapsed && <span className="brand-title">Vianalytics</span>}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="collapse-btn"
          title={isCollapsed ? 'Expand sidebar (20%)' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg
            className={`collapse-icon ${isCollapsed ? 'rotated' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
            />
          </svg>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav">
        {!isCollapsed && <div className="nav-heading">Main Menu</div>}

        {/* Menu Item 1: Upload */}
        <button
          type="button"
          onClick={() => onSelectTab('upload')}
          className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
          title="Upload"
        >
          <div className="nav-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <>
              <span className="nav-label">Upload</span>
            </>
          )}
        </button>

        {/* Menu Item 2: SKU Master */}
        <button
          type="button"
          onClick={() => onSelectTab('sku')}
          className={`nav-item ${activeTab === 'sku' ? 'active' : ''}`}
          title="SKU Master"
        >
          <div className="nav-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <>
              <span className="nav-label">SKU Master</span>
            </>
          )}
        </button>

        {/* Menu Item 3: Team Member*/}
        { isAdmin && (<button
          type="button"
          onClick={() => onSelectTab('team')}
          className={`nav-item ${activeTab === 'team' ? 'active' : ''}`}
          title="Team Members">
            <div className="nav-icon">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <>
              <span className="nav-label">Team Members</span>
            </>
          )}
        </button>)}
      </nav>

      {/* Sidebar Footer */}
      {/*<div className="sidebar-footer">
        <div className="footer-avatar" title="Vianalytics UI">
          VA
        </div>
        {!isCollapsed && (
          <div className="footer-info">
            <div className="footer-title">vianalytics-ui</div>
            <div className="footer-subtitle">Width: 20% (Collapsible)</div>
          </div>
        )}
      </div>*/}
    </aside>
  )
}

