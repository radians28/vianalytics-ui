import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown, type MenuProps } from 'antd'
import { DownOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons'
import type { TabType } from './Sidebar'
import type { AuthToken } from '../types/auth'
import { SettingsDrawer } from './SettingsDrawer'

interface HeaderProps {
  activeTab: TabType
  onToggleSidebar: () => void
  authToken: AuthToken
  onAuthChange: (token: AuthToken | undefined) => void
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onToggleSidebar, authToken, onAuthChange }) => {
  const navigate = useNavigate()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  // Bumped every time Settings is opened, so SettingsDrawer remounts with
  // fresh state instead of needing an effect to reset its form fields.
  const [settingsKey, setSettingsKey] = useState(0)
  const { decoded_token: decodedToken }= authToken;

  const firstName = decodedToken.user_first_name ?? '';
  const lastName = decodedToken.user_last_name ?? '';
  const name = `${firstName} ${lastName}`.trim();
  const initial = `${firstName[0] ?? ''}${lastName[0] ?? ''}`;

  const headerContent: Record<TabType, { title: string; subtitle: string }> = {
    upload: {
      title: 'Data Upload',
      subtitle: 'Import datasets, files, and SKU manifests into Vianalytics',
    },
    sku: {
      title: 'SKU Master',
      subtitle: 'Manage products, inventory items, codes, and stock levels',
    },
    team: {
      title: 'Team Members',
      subtitle: 'Manage team member accounts, roles, and access',
    },
  }

  const { title, subtitle } = headerContent[activeTab]

  const handleLogout = () => {
    onAuthChange(undefined);
    navigate('/login');
  };

  const menuItems: MenuProps['items'] = [
    { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
    { key: 'logout', label: 'Logout', icon: <LogoutOutlined />, danger: true },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'settings') {
      setSettingsKey((k) => k + 1);
      setIsSettingsOpen(true);
    } else if (key === 'logout') {
      handleLogout();
    }
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="header-mobile-toggle"
          aria-label="Toggle Navigation"
        >
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="header-titles">
          <h1 className="header-title">{title}</h1>
          <p className="header-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="header-right">
        <div className="status-pill">
          <span className="status-dot"></span>
          <span>System Ready</span>
        </div>
        <div className="header-divider"></div>
        <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['click']}>
          <div className="user-profile" style={{ cursor: 'pointer' }}>
            <div className="user-avatar" title="Front End Engineer">
              {initial}
            </div>
            <span className="user-role">{name}</span>
            <DownOutlined style={{ fontSize: 11, color: 'var(--text-muted)' }} />
          </div>
        </Dropdown>
      </div>

      <SettingsDrawer
        key={settingsKey}
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        authToken={authToken}
        onAuthChange={onAuthChange}
      />
    </header>
  )
}
