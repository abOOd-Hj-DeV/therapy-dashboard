import { useEffect, useState } from 'react'
import { Auth, type AuthPage } from './Auth'
import { Dashboard } from './Dashboard'
import { Chats } from './Chats'
import { Sessions } from './Sessions'
import { SessionDetails } from './SessionDetails'
import { Profile } from './Profile'
import { Wallet } from './Wallet'
import { api } from './api'
import { useApiUser } from './api-hooks'
import { Clients } from './Clients'

export function App() {
  const user = useApiUser(api)
  const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
  const client = demo ? undefined : api
  const [path, setPath] = useState(window.location.pathname)
  const [verificationEmail, setVerificationEmail] = useState('henryford@Sakina.com')
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  function navigate(next: string) {
    window.history.pushState({}, '', next)
    setPath(window.location.pathname)
    window.scrollTo({ top: 0 })
  }
  const protectedPage = ![
    '/',
    '/login',
    '/signup',
    '/activate',
    '/verify',
    '/forgot-password',
    '/reset-password',
  ].includes(path)
  if (!demo && protectedPage && !user)
    return (
      <Auth
        page="login"
        navigate={navigate}
        verificationEmail=""
        onCreateAccount={() => undefined}
        api={client}
      />
    )
  if (path === '/dashboard' || path === '/dashboard/')
    return <Dashboard navigate={navigate} api={client} />
  if (path === '/chats' || path === '/messages')
    return <Chats key={path} navigate={navigate} api={client} />
  if (path === '/sessions/upcoming') return <SessionDetails navigate={navigate} api={client} />
  if (path === '/sessions') return <Sessions navigate={navigate} api={client} />
  if (path === '/profile' || path === '/profile/settings' || path === '/profile/help')
    return (
      <Profile
        key="profile"
        page={path.endsWith('/settings') ? 'settings' : path.endsWith('/help') ? 'help' : 'profile'}
        navigate={navigate}
        api={client}
      />
    )
  if (path === '/wallet') return <Wallet navigate={navigate} api={client} />
  if (path === '/clients' && client) return <Clients api={client} navigate={navigate} />
  const authPages: Record<string, AuthPage> = {
    '/signup': 'signup',
    '/activate': 'activate',
    '/verify': 'verify',
    '/forgot-password': 'forgot-password',
    '/reset-password': 'reset-password',
  }
  const page = authPages[path] ?? 'login'
  return (
    <Auth
      key={page}
      page={page}
      navigate={navigate}
      verificationEmail={verificationEmail}
      onCreateAccount={(email) => {
        setVerificationEmail(email)
        navigate('/verify')
      }}
      api={client}
    />
  )
}
