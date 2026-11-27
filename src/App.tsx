import { useEffect, useState } from 'react'
import { Auth, type AuthPage } from './Auth'
import { Dashboard } from './Dashboard'
import { Chats } from './Chats'
import { Sessions } from './Sessions'
import { SessionDetails } from './SessionDetails'
import { Profile } from './Profile'
import { Wallet } from './Wallet'
import { api } from './api'
import { useApiResource, useApiUser } from './api-hooks'
import { TherapistOnboarding } from './TherapistOnboarding'
import { Clients } from './Clients'
import { ClientProfile } from './ClientProfile'
import { DemoClients } from './DemoClients'
import { DemoClientProfile } from './DemoClientProfile'
import { HomeworkLibrary } from './HomeworkLibrary'
import { HomeworkWizard } from './HomeworkWizard'
import { CarePlanInsertion } from './CarePlanInsertion'
import { RedFlags } from './RedFlags'
import { therapistProfilePath, type TherapistProfileResponse } from './therapist-profile-review'

export function App() {
  const user = useApiUser(api)
  const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
  const client = demo ? undefined : api
  const [restoring, setRestoring] = useState(() => !!client?.hasStoredSession() && !user)
  const approval = useApiResource<TherapistProfileResponse>(client, user ? therapistProfilePath : null)
  const [location, setLocation] = useState(window.location.pathname + window.location.search)
  const requestedPath = location.split('?')[0]
  const review = approval.data?.data
  const approved = !approval.error && review?.approval_status === 'approved'
  const approvedOnboardingPath =
    approved && requestedPath === '/profile/approval'
  const path =
    approvedOnboardingPath ||
    (client && user && ['/', '/login', '/activate', '/signup'].includes(requestedPath))
      ? '/dashboard'
      : requestedPath
  const [verificationEmail, setVerificationEmail] = useState('henryford@Sakina.com')
  useEffect(() => {
    const onPopState = () => setLocation(window.location.pathname + window.location.search)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    if (!restoring || !client) return
    let active = true
    void client.restore().finally(() => {
      if (active) setRestoring(false)
    })
    return () => {
      active = false
    }
  }, [client, restoring])
  useEffect(() => {
    if (!approvedOnboardingPath) return
    window.history.replaceState({}, '', '/dashboard')
    setLocation('/dashboard')
  }, [approvedOnboardingPath])
  function navigate(next: string) {
    window.history.pushState({}, '', next)
    setLocation(window.location.pathname + window.location.search)
    window.scrollTo({ top: 0 })
  }
  async function logout() {
    try {
      await client?.logout()
      navigate('/login')
    } catch {
      navigate('/login?logout=revocation-unknown')
    }
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
  if (restoring) return <main lang="ar" dir="rtl" role="status">جارٍ استعادة جلستك…</main>
  if (client && user && protectedPage && (!approved || path === '/profile/documents')) {
    if (review && (!approval.error || review.approval_status !== 'approved')) {
      return (
        <TherapistOnboarding
          key={client.getSessionKey()}
          api={client}
          path={path}
          review={review}
          saved={approval.replace}
          navigate={navigate}
          logout={logout}
          checkingApproval={approval.loading}
          approvalCheckFailed={!!approval.error}
          checkApproval={approval.reload}
        />
      )
    }
    return (
      <main className="approval-page" lang="ar" dir="rtl">
        {approval.loading ? (
          <p role="status">جارٍ التحقق من حالة الموافقة…</p>
        ) : (
          <>
            <p role="alert">تعذّر التحقق من حالة الموافقة. حاول مرة أخرى.</p>
            <div className="approval-actions">
              <button type="button" className="soft-button" onClick={approval.reload}>
                إعادة المحاولة
              </button>
              <button type="button" className="soft-button" onClick={logout}>
                تسجيل الخروج
              </button>
            </div>
          </>
        )}
      </main>
    )
  }
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
  if (path === '/homework') return <HomeworkLibrary navigate={navigate} api={client} />
  if (path === '/homework/create') return <HomeworkWizard navigate={navigate} api={client} />
  if (path === '/homework/insert') return <CarePlanInsertion navigate={navigate} api={client} />
  if (path === '/red-flags') return <RedFlags navigate={navigate} api={client} />
  if (demo && path === '/clients') return <DemoClients navigate={navigate} />
  if (demo && path === '/clients/profile') return <DemoClientProfile navigate={navigate} />
  if (path === '/clients' && client) return <Clients api={client} navigate={navigate} />
  if (path === '/clients/profile' && client)
    return <ClientProfile api={client} navigate={navigate} />
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
