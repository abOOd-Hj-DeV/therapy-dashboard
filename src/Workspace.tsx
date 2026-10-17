import { useEffect, useState, type ReactNode } from 'react'
import { asset } from './assets'
import { menu, notifications as demoNotifications } from './data'
import { Logo, Modal } from './ui'
import { ApiClient } from './api'
import { LiveNotifications } from './api-chat-and-notifications-live-notifications'

type WorkspaceProps = {
  title: string
  active: 'Dashboard' | 'Clients' | 'Messages' | 'Sessions' | 'Profile' | 'Wallet'
  navigate: (path: string) => void
  children: ReactNode
  offline?: boolean
  onSearch?: (value: string) => void
  mobileTitle?: string
  api?: ApiClient
}

const navigationIcons = [
  'part2-07-imgDashboardIcon.svg',
  'part2-03-imgSquareUserCheck.svg',
  'part2-07-imgCalendarAlt.svg',
  'part2-03-imgMessageCircleLinesAlt.svg',
  'part2-03-imgStars.svg',
  'part2-03-imgWallet.svg',
]
const mobileIcons = [
  'part2-06-imgHome.svg',
  'part2-06-imgFrame2147234901.svg',
  'part2-06-imgFrame2147234900.svg',
  'part2-06-imgFrame2147234899.svg',
  'part2-06-imgStars.svg',
  'part2-06-imgWalletAlt.svg',
  'part2-06-imgUserAlt.svg',
]

export function DesignIcon({ name }: { name: string }) {
  return <img className="design-icon" src={asset(name)} alt="" aria-hidden="true" />
}

export function Workspace({
  title,
  active,
  navigate,
  children,
  offline = false,
  onSearch,
  mobileTitle,
  api,
}: WorkspaceProps) {
  const user = api?.getUser()
  const notifications = api ? [] : demoNotifications
  const params = new URLSearchParams(window.location.search)
  const initial = params.get('state')
  const [collapsed, setCollapsed] = useState(initial === 'collapsed')
  const [expanded, setExpanded] = useState(initial === 'expanded')
  const [online, setOnline] = useState(navigator.onLine)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [dismissed, setDismissed] = useState<number[]>([])
  const isOffline = offline || initial === 'offline' || !online

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false)
        setNotificationOpen(false)
        setSearchOpen(false)
      }
    }
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      window.removeEventListener('keydown', escape)
    }
  }, [])

  function openPage(label: string) {
    setExpanded(false)
    const route =
      label === 'Dashboard'
        ? '/dashboard'
        : label === 'Messages'
          ? '/chats'
          : label === 'Sessions'
            ? '/sessions'
            : label === 'Wallet'
              ? '/wallet'
              : label === 'Profile'
                ? '/profile'
                : (label === 'Patients' || label === 'Clients') && (api || (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'))
                  ? '/clients'
                  : null
    if (route) navigate(route)
    else
      setNotice(
        api
          ? `${label}: this feature is not available in the therapist API.`
          : `${label}: this screen is not included in the supplied designs. No backend is connected.`,
      )
  }

  const activeLabel = active === 'Clients' ? 'Patients' : active

  return (
    <div
      className={`workspace secondary-workspace visual-auth-shell ${active === 'Profile' || active === 'Wallet' ? 'remaining-workspace' : ''} ${active === 'Messages' ? 'chat-workspace' : ''} ${collapsed ? 'is-collapsed' : ''} ${expanded ? 'is-expanded' : ''} ${isOffline ? 'secondary-offline' : ''}`}
    >
      {expanded && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setExpanded(false)}
        />
      )}
      <aside className="sidebar" aria-label="Main navigation">
        <div>
          <header className="sidebar-header">
            <Logo wordmark />
            <button
              className="icon-button collapse-button"
              aria-label={
                expanded ? 'Close navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'
              }
              onClick={() => {
                if (window.innerWidth <= 1100) setExpanded(!expanded)
                else if (expanded) setExpanded(false)
                else setCollapsed(!collapsed)
              }}
            >
              <DesignIcon name="part2-03-imgCaretDoubleHorizontal.svg" />
            </button>
          </header>
          <nav className="navigation">
            <p className="nav-label">MAIN MENU</p>
            {menu.map((item, index) => (
              <button
                key={item.label}
                className={`nav-item ${item.label === activeLabel ? 'active' : ''}`}
                aria-label={item.label}
                aria-current={item.label === activeLabel ? 'page' : undefined}
                onClick={() => openPage(item.label)}
                title={item.label}
              >
                <DesignIcon
                  name={
                    active === 'Messages' && index === 0
                      ? 'part2-03-imgDashboardIcon.svg'
                      : navigationIcons[index]
                  }
                />
                <span className="nav-text">{item.label}</span>
                {!api && item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="client-reminder textured">
            <div>
              <p>This week</p>
              <p>
                {api
                  ? 'Review your assigned clients and upcoming sessions.'
                  : 'You have one client without assigned content for over a week.'}
              </p>
              <button onClick={() => navigate('/clients')}>
                Client review
              </button>
            </div>
          </div>
          <button
            className="compact-reminder icon-button"
            aria-label="Client review"
            onClick={() => navigate('/clients')}
          >
            <DesignIcon name="part2-10-imgMaterialSymbolsLightEmergencyHome.svg" />
          </button>
          <button
            className={`profile-card textured ${active === 'Profile' ? 'active' : ''}`}
            aria-label="Open profile"
            aria-current={active === 'Profile' ? 'page' : undefined}
            onClick={() => navigate('/profile')}
          >
            {api ? (
              <span className="api-avatar" aria-hidden="true">
                {user?.name?.slice(0, 1) || '?'}
              </span>
            ) : (
              <img src={asset('dashboard-imgContainer.png')} alt="Dr. Issa Alhadad" />
            )}
            <span className="profile-copy">
              <strong>{api ? user?.name : 'Dr. Issa Alhadad'}</strong>
              <small>{api ? 'Therapist' : 'Certified Psychotherapist'}</small>
            </span>
            <DesignIcon name="part2-03-imgIcon.svg" />
          </button>
        </div>
      </aside>
      <main className="secondary-main">
        <header className="secondary-topbar">
          <div className="secondary-heading">
            <button
              className="icon-button secondary-mobile-menu"
              aria-label="Open navigation"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <DesignIcon name="part2-11-imgMenu.svg" />
            </button>
            <h1 className={mobileTitle ? 'desktop-page-title' : undefined}>{title}</h1>
            {mobileTitle && <h1 className="mobile-page-title">{mobileTitle}</h1>}
          </div>
          <div className="secondary-actions">
            <label className={`secondary-search ${searchOpen ? 'open' : ''}`}>
              <DesignIcon name="part2-03-imgSearch.svg" />
              <input
                aria-label={onSearch ? 'Search patients' : 'Search unavailable'}
                title={onSearch ? undefined : 'Search is not available on this page.'}
                disabled={!onSearch}
                placeholder="Search..."
                onChange={(event) => onSearch?.(event.target.value)}
              />
            </label>
            <button
              className="icon-button secondary-mobile-search"
              aria-label="Open search"
              aria-expanded={searchOpen}
              disabled={!onSearch}
              title={onSearch ? undefined : 'Search is not available on this page.'}
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <DesignIcon name="part2-03-imgSearch.svg" />
            </button>
            <button
              className="icon-button"
              aria-label="Notifications"
              aria-expanded={notificationOpen}
              onClick={() => setNotificationOpen(!notificationOpen)}
            >
              <DesignIcon name="part2-03-imgNotification.svg" />
            </button>
          </div>
        </header>
        {isOffline && (
          <div className="secondary-offline-banner" role="status">
            <span>⚠</span>You're offline. Some data may not be up to date.
          </div>
        )}
        {children}
      </main>
      {active === 'Messages' && (
        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {[...menu.map((item) => item.label), 'Profile'].map((label, index) => (
            <button
              key={label}
              className={label === activeLabel ? 'active' : ''}
              aria-label={label}
              aria-current={label === activeLabel ? 'page' : undefined}
              onClick={() => openPage(label)}
            >
              <DesignIcon name={mobileIcons[index]} />
            </button>
          ))}
        </nav>
      )}
      {notificationOpen && (
        <div
          className="notifications-panel secondary-notifications"
          role="region"
          aria-label="Notifications"
        >
          <header>
            <h2>Notifications</h2>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => setNotificationOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="notifications-list">
            {api && <LiveNotifications api={api} navigate={navigate} />}
            {notifications
              .filter((item) => !dismissed.includes(item.id))
              .map((item) => (
                <article key={item.id} className="notification-item">
                  <div className="notification-avatar">
                    <img src={asset(item.image)} alt="" />
                  </div>
                  <div className="notification-body">
                    <strong>{item.title}</strong> {item.detail}
                    <p>{item.description}</p>
                    <time>{item.time}</time>
                    {item.action && (
                      <button
                        className="soft-button"
                        onClick={() =>
                          item.action === 'Accept'
                            ? setDismissed([...dismissed, item.id])
                            : setNotice('Demo only: no notification service is connected.')
                        }
                      >
                        {item.action}
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
        </div>
      )}
      {notice && (
        <Modal
          title={api ? 'Feature unavailable' : 'Frontend demo'}
          className="part2-modal"
          onClose={() => setNotice('')}
        >
          <p>{notice}</p>
        </Modal>
      )}
    </div>
  )
}
