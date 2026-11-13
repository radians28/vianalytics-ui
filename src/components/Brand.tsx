import React from 'react'
import logo from '../assets/royal-canin.png'
import { APP_NAME, APP_NAME_LONG } from '../theme'

interface BrandProps {
  variant?: 'sidebar' | 'auth'
}

// Royal Canin logo + product name. The sidebar stacks them (it is only ~20% wide);
// the login / verify cards show them side by side
export const Brand: React.FC<BrandProps> = ({ variant = 'sidebar' }) => (
  <div className={`brand ${variant}`} title={APP_NAME_LONG}>
    <img src={logo} alt="Royal Canin" className="brand-logo-img" />
    {variant === 'auth' && <span className="brand-divider" aria-hidden="true" />}
    <span className="brand-title">{APP_NAME}</span>
  </div>
)
