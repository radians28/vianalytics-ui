import React, { useState } from 'react'
import { Brand } from './Brand'

export type TabType = 'upload' | 'traffic' | 'sku' | 'bundle' | 'team'

const icon = (d: string) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
)

const ICONS = {
  upload: icon('M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12'),
  order: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'),
  traffic: icon('M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z'),
  database: icon('M4 7c0-1.657 3.582-3 8-3s8 1.343 8 3-3.582 3-8 3-8-1.343-8-3zm0 0v5c0 1.657 3.582 3 8 3s8-1.343 8-3V7M4 12v5c0 1.657 3.582 3 8 3s8-1.343 8-3v-5'),
  box: icon('M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'),
  stack: icon('M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'),
}

interface NavGroupProps {
  label: string
  icon: React.ReactNode
  items: { tab: TabType; label: string; icon: React.ReactNode }[]
  activeTab: TabType
  onSelectTab: (tab: TabType) => void
  isCollapsed: boolean
}

// A menu entry that opens into sub-pages. It stays open while one of its pages is shown; a
// collapsed sidebar hides the group row and lists the sub-pages as icons
const NavGroup: React.FC<NavGroupProps> = ({ label, icon: groupIcon, items, activeTab, onSelectTab, isCollapsed }) => {
  const [open, setOpen] = useState(true)
  const active = items.some((item) => item.tab === activeTab)
  const showItems = isCollapsed || open || active

  return (
    <div className="nav-group">
      {!isCollapsed && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`nav-item nav-group-toggle ${active ? 'has-active' : ''}`}
          title={label}
          aria-expanded={showItems}
        >
          <div className="nav-icon">{groupIcon}</div>
          <span className="nav-label">{label}</span>
          <svg className={`nav-chevron ${showItems ? 'open' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      {showItems && (
        <div className={`nav-sub-list ${isCollapsed ? 'collapsed' : ''}`}>
          {items.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => onSelectTab(item.tab)}
              className={`nav-item nav-sub ${activeTab === item.tab ? 'active' : ''}`}
              title={item.label}
            >
              <div className="nav-icon">{item.icon}</div>
              {!isCollapsed && <span className="nav-label">{item.label}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
          {!isCollapsed && <Brand />}
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

        {/* Menu Item 1: Upload group (orders, traffic) */}
        <NavGroup
          label="Upload"
          icon={ICONS.upload}
          items={[
            { tab: 'upload', label: 'Upload Order', icon: ICONS.order },
            { tab: 'traffic', label: 'Upload Traffic', icon: ICONS.traffic },
          ]}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          isCollapsed={isCollapsed}
        />

        {/* Menu Item 2: Master Data group (SKU Master, SKU Bundling) */}
        <NavGroup
          label="Master Data"
          icon={ICONS.database}
          items={[
            { tab: 'sku', label: 'SKU Master', icon: ICONS.box },
            { tab: 'bundle', label: 'SKU Bundling', icon: ICONS.stack },
          ]}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          isCollapsed={isCollapsed}
        />

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

