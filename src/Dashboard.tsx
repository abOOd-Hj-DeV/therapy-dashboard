import { useEffect, useRef, useState } from 'react'
import { menu, metrics, notifications, sessions, type Session } from './data'
import { Icon, Logo, Modal } from './ui'
import { asset } from './assets'

type DashboardProps = { navigate: (path: string) => void }
type Overlay = 'meeting' | 'notifications' | 'unavailable' | 'profile' | 'patient' | null

export function Dashboard({ navigate }: DashboardProps) {
  const params = new URLSearchParams(window.location.search)
  const initial = params.get('state')
  const [collapsed, setCollapsed] = useState(initial === 'collapsed')
  const [expanded, setExpanded] = useState(initial === 'expanded')
  const [overlay, setOverlay] = useState<Overlay>(
    initial === 'meeting' || initial === 'notifications' ? initial : null,
  )
  const [searchOpen, setSearchOpen] = useState(initial === 'search')
  const [query, setQuery] = useState(initial === 'search' ? 'Fa' : '')
  const [online, setOnline] = useState(navigator.onLine)
  const [selected, setSelected] = useState('')
  const [status, setStatus] = useState('')
  const [dismissed, setDismissed] = useState<number[]>([])
  const searchRef = useRef<HTMLInputElement>(null)
  const searchArea = useRef<HTMLDivElement>(null)
  const notificationArea = useRef<HTMLDivElement>(null)
  const notificationButton = useRef<HTMLButtonElement>(null)
  const offline = !online || initial === 'offline'

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!searchArea.current?.contains(event.target as Node)) setSearchOpen(false)
      if (
        !notificationArea.current?.contains(event.target as Node) &&
        !notificationButton.current?.contains(event.target as Node)
      )
        setOverlay((current) => (current === 'notifications' ? null : current))
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setExpanded(false)
        setOverlay((current) => (current === 'notifications' ? null : current))
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [])

  function unavailable(label: string) {
    setSelected(label)
    setOverlay('unavailable')
    setExpanded(false)
  }
  const results = [
    ...sessions,
    { name: 'Fatima', image: 'dashboard-imgContainer3.png' },
    { name: 'Fadi', image: 'dashboard-imgContainer4.png', crop: 'khaled' },
  ].filter((patient) => patient.name.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div
      className={`workspace ${collapsed ? 'is-collapsed' : ''} ${expanded ? 'is-expanded' : ''} ${offline ? 'is-offline' : ''}`}
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
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              onClick={() => {
                setCollapsed(!collapsed)
                setExpanded(false)
              }}
            >
              <Icon name="dashboard-imgCaretDoubleHorizontal.svg" />
            </button>
          </header>
          <nav className="navigation">
            <p className="nav-label">MAIN MENU</p>
            {menu.map((item) => (
              <button
                key={item.label}
                className={`nav-item ${item.label === 'Dashboard' ? 'active' : ''}`}
                title={item.label}
                aria-label={item.label}
                aria-current={item.label === 'Dashboard' ? 'page' : undefined}
                onClick={() =>
                  item.label === 'Dashboard'
                    ? setExpanded(false)
                    : item.label === 'Messages'
                      ? navigate('/chats')
                      : item.label === 'Sessions'
                        ? navigate('/sessions')
                        : unavailable(item.label)
                }
              >
                <Icon name={item.icon} />
                <span className="nav-text">{item.label}</span>
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </button>
            ))}
          </nav>
        </div>
        <div className="sidebar-footer">
          <div className="client-reminder textured">
            <div>
              <p>This week</p>
              <p>You have one client without assigned content for over a week.</p>
              <button onClick={() => navigate('/sessions/upcoming')}>Client review</button>
            </div>
          </div>
          <button
            className="compact-reminder icon-button"
            aria-label="Client review"
            onClick={() => navigate('/sessions/upcoming')}
          >
            <Icon name="dashboard-imgStars.svg" />
            <i />
          </button>
          <button
            className="profile-card textured"
            aria-label="Open profile"
            onClick={() => setOverlay('profile')}
          >
            <img src={asset('dashboard-imgContainer.png')} alt="Dr. Issa Alhadad" />
            <span className="profile-copy">
              <strong>Dr. Issa Alhadad</strong>
              <small>Certified Psychotherapist</small>
            </span>
            <Icon name="dashboard-imgIcon.svg" />
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              aria-expanded={expanded}
              onClick={() => {
                setExpanded(!expanded)
                setCollapsed(false)
              }}
            >
              <span className="hamburger">☰</span>
            </button>
            <h1>Dashboard</h1>
          </div>
          <div className="topbar-actions">
            <div className={`search-area ${searchOpen ? 'search-open' : ''}`} ref={searchArea}>
              <button
                className="icon-button mobile-search"
                aria-label="Open search"
                onClick={() => {
                  setSearchOpen(!searchOpen)
                  setOverlay(null)
                  requestAnimationFrame(() => searchRef.current?.focus())
                }}
              >
                <Icon name="dashboard-imgSearch.svg" />
              </button>
              <label className="search-field">
                <Icon name="dashboard-imgSearch.svg" />
                <input
                  ref={searchRef}
                  aria-label="Search patients"
                  placeholder="Search..."
                  value={query}
                  onFocus={() => {
                    setSearchOpen(true)
                    setOverlay(null)
                  }}
                  onChange={(event) => setQuery(event.target.value)}
                  autoComplete="off"
                />
              </label>
              {searchOpen && query.trim() && (
                <div className="search-results" aria-label="Search results">
                  {results.length ? (
                    results.map((patient) => (
                      <button
                        key={patient.name}
                        onClick={() => {
                          setSelected(patient.name)
                          setOverlay('patient')
                          setSearchOpen(false)
                        }}
                      >
                        <Avatar patient={patient} />
                        <span>{patient.name}</span>
                      </button>
                    ))
                  ) : (
                    <p>No patients found</p>
                  )}
                </div>
              )}
            </div>
            <button
              ref={notificationButton}
              className="icon-button notification-button"
              aria-label="Notifications"
              aria-expanded={overlay === 'notifications'}
              aria-controls="notifications-panel"
              onClick={() => {
                setOverlay(overlay === 'notifications' ? null : 'notifications')
                setSearchOpen(false)
              }}
            >
              <Icon name="dashboard-imgNotification.svg" />
            </button>
          </div>
        </header>
        {offline && (
          <div className="offline-banner" role="status">
            <span aria-hidden="true">⌁</span>You’re offline. Some data may not be up to date.
          </div>
        )}
        <div className="hero-section">
          <section className="dashboard-hero textured" aria-label="Today’s overview">
            <div className="hero-copy">
              <div className="greeting">
                <p>Good morning!</p>
                <h2>Dr. khaled Alshamy</h2>
                <p>you have 3 sessions for today!</p>
              </div>
              <div className="hero-rating">
                <span>
                  Rating: <b aria-label="5 stars">★★★★★</b>
                </span>
                <span>Attendance Rate: 95%</span>
              </div>
            </div>
            <div className="next-session">
              <p className="eyebrow">YOUR NEXT SESSION</p>
              <div className="next-patient">
                <div className="initials">AM</div>
                <div>
                  <h3>Ahmed Mohamed</h3>
                  <p>One-on-one session · Today 10:00 AM</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setStatus('')
                  setOverlay('meeting')
                }}
                disabled={offline}
              >
                <Icon name="dashboard-imgIcon2.svg" />
                Start session
              </button>
            </div>
            <img className="hero-illustration" src={asset('dashboard-imgImage1988.png')} alt="" />
          </section>
        </div>
        <section className="metrics" aria-label="Practice statistics">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span className={`featured-icon ${metric.glass ? 'has-glass' : ''}`}>
                <span>
                  <Icon name={metric.icon} />
                </span>
              </span>
              <div className="metric-data">
                <h2>{metric.label}</h2>
                <div>
                  <strong>{metric.value}</strong>
                  <span className={`metric-change ${metric.negative ? 'negative' : ''}`}>
                    <Icon
                      name={
                        metric.negative
                          ? 'dashboard-imgTrendUpIcon1.svg'
                          : 'dashboard-imgTrendUpIcon.svg'
                      }
                    />
                    {metric.change}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
        <section className="sessions-section" aria-labelledby="sessions-heading">
          <div className="sessions-card">
            <header>
              <h2 id="sessions-heading">Upcoming Sessions</h2>
              <button className="see-all" onClick={() => navigate('/sessions')}>
                See all
                <Icon name="dashboard-imgIcon5.svg" />
              </button>
            </header>
            <table>
              <thead>
                <tr>
                  <th scope="col">Patient Name</th>
                  <th scope="col">Date</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((patient) => (
                  <tr key={patient.name}>
                    <td>
                      <button
                        className="patient-cell"
                        onClick={() => {
                          setSelected(patient.name)
                          setOverlay('patient')
                        }}
                      >
                        <Avatar patient={patient} />
                        <span>
                          <span className="patient-name">{patient.name}</span>
                          <small>Private Session</small>
                        </span>
                      </button>
                    </td>
                    <td className="session-date">
                      {patient.date}, {patient.time}
                    </td>
                    <td>
                      <span className={`session-status ${patient.status}`}>
                        {patient.status === 'ready'
                          ? 'Is ready'
                          : patient.status === 'canceled'
                            ? 'Canceled'
                            : 'Not sure'}
                        <Icon
                          name={
                            patient.status === 'ready'
                              ? 'dashboard-imgStatusIcon.svg'
                              : patient.status === 'canceled'
                                ? 'dashboard-imgIcon6.svg'
                                : 'dashboard-imgLoaderIcon.svg'
                          }
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {overlay === 'notifications' && (
        <div
          ref={notificationArea}
          className="notifications-panel"
          id="notifications-panel"
          role="region"
          aria-label="Notifications"
        >
          <header>
            <h2>Notifications</h2>
            <button
              className="icon-button"
              aria-label="Close notifications"
              onClick={() => {
                setOverlay(null)
                notificationButton.current?.focus()
              }}
            >
              ×
            </button>
          </header>
          <div className="notifications-list">
            {notifications
              .filter((item) => !dismissed.includes(item.id))
              .map((item) => (
                <article className="notification-item" key={item.id}>
                  <div className="notification-avatar">
                    <img src={asset(item.image)} alt="" />
                    <span>
                      <Icon name={item.icon} />
                    </span>
                  </div>
                  <div className="notification-body">
                    <div className="notification-title">
                      <p>
                        <strong>{item.title}</strong> {item.detail}
                      </p>
                      <time>{item.time}</time>
                    </div>
                    <p>{item.description}</p>
                    {item.action && (
                      <div className="notification-actions">
                        <button
                          onClick={() => {
                            if (item.action === 'Accept') setDismissed([...dismissed, item.id])
                            else unavailable(item.action!)
                            setStatus(item.action === 'Accept' ? 'Demo invitation accepted.' : '')
                          }}
                        >
                          {item.action}
                        </button>
                        {item.action === 'Accept' && (
                          <button onClick={() => setDismissed([...dismissed, item.id])}>
                            Decline
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
          </div>
          <footer>
            Powered by <img src={asset('notification-imgLogo.svg')} alt="Sakina" />
          </footer>
          {status && (
            <p role="status" className="notification-feedback">
              {status}
            </p>
          )}
        </div>
      )}
      {overlay === 'meeting' && (
        <Modal title="let’s join the Meeting!" onClose={() => setOverlay(null)}>
          <label className="meeting-label">
            Meeting URL
            <div className="meeting-url">
              <input
                aria-label="Meeting URL"
                readOnly
                value="https://meet.google.com/xxx-eyzx-dew?author=0"
              />
              <button
                className="icon-button"
                aria-label="Copy meeting URL"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      'https://meet.google.com/xxx-eyzx-dew?author=0',
                    )
                    setStatus('Demo URL copied.')
                  } catch {
                    setStatus('Copy is unavailable. Select the URL and copy it manually.')
                  }
                }}
              >
                ▢
              </button>
            </div>
          </label>
          <button
            className="primary-button"
            onClick={() => setStatus('Demo only: no live meeting service is connected.')}
          >
            Join meeting
          </button>
          {status && (
            <p className="modal-status" role="status">
              {status}
            </p>
          )}
        </Modal>
      )}
      {overlay === 'unavailable' && (
        <Modal title={selected} onClose={() => setOverlay(null)}>
          <p>
            This page is not in the first Figma file. It will be added when the remaining designs
            are provided.
          </p>
        </Modal>
      )}
      {overlay === 'patient' && (
        <Modal title={selected} onClose={() => setOverlay(null)}>
          <p>Private Session · Demo patient record</p>
          <p>The full patient page is not included in the first design file.</p>
        </Modal>
      )}
      {overlay === 'profile' && (
        <Modal title="Dr. Issa Alhadad" onClose={() => setOverlay(null)}>
          <p>Certified Psychotherapist</p>
          <p>This is a frontend demo. No authenticated session is stored.</p>
          <button className="primary-button" onClick={() => navigate('/login')}>
            Back to login
          </button>
        </Modal>
      )}
    </div>
  )
}

export function Avatar({ patient }: { patient: Pick<Session, 'name' | 'image' | 'crop'> }) {
  return (
    <span className={`avatar ${patient.crop ?? ''}`}>
      <img src={asset(patient.image)} alt="" />
    </span>
  )
}
