import { useEffect, useState } from 'react'
import { Auth, type AuthPage } from './Auth'
import { AuthCardShell } from './AuthCardShell'
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
import { hasKnownTherapistLifecycle, therapistLifecycle, therapistProfilePath, type TherapistProfileResponse } from './therapist-profile-review'

export function App() {
  const user = useApiUser(api)
  const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
  const client = demo ? undefined : api
  const [restoring, setRestoring] = useState(() => !!client?.hasStoredSession() && !user)
  const approval = useApiResource<TherapistProfileResponse>(client, user ? therapistProfilePath : null, { validate: hasKnownTherapistLifecycle })
  const [location, setLocation] = useState(window.location.pathname + window.location.search)
  const [draftSession, setDraftSession] = useState<number | null>(null)
  const requestedPath = location.split('?')[0]
  const review = approval.data?.data
  const lifecycle = review && therapistLifecycle(review)
  const lastApproved = lifecycle === 'approved' || lifecycle === 'update_pending'
  const approved = lastApproved && !approval.error
  const finishingDraft = lastApproved && draftSession === client?.getSessionKey()
  const activatedEntry = !!(client && user && ['/activate', '/signup'].includes(requestedPath))
  const approvedOnboardingPath =
    approved && !finishingDraft && (activatedEntry || requestedPath === '/profile/approval')
  const redirectPath = approvedOnboardingPath ? '/dashboard' : activatedEntry ? '/profile/approval' : null
  const path = redirectPath ?? (client && user && ['/', '/login'].includes(requestedPath) ? '/dashboard' : requestedPath)
  const keepsProfileDraft = lastApproved && ['/profile', '/profile/settings', '/profile/help'].includes(path)
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
    if (!redirectPath) return
    window.history.replaceState({}, '', redirectPath)
    setLocation(redirectPath)
  }, [redirectPath])
  useEffect(() => {
    if (lifecycle === 'invited' || lifecycle === 'suspended' || (!review && approval.error))
      setDraftSession(null)
  }, [approval.error, lifecycle, review])
  function navigate(next: string) {
    window.history.pushState({}, '', next)
    setLocation(window.location.pathname + window.location.search)
    window.scrollTo({ top: 0 })
  }
  async function logout(next = '/login') {
    try {
      await client?.logout()
      navigate(next)
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
  if (restoring) return <AuthCardShell arabic title="سكينة"><p role="status">جارٍ استعادة جلستك…</p></AuthCardShell>
  if (client && user && protectedPage && !keepsProfileDraft && (!approved || finishingDraft || path === '/profile/documents')) {
    if (review && lifecycle && (!approval.error || draftSession === client.getSessionKey() || !lastApproved)) {
      return (
        <TherapistOnboarding
          key={client.getSessionKey()}
          api={client}
          path={path}
          review={review}
          saved={approval.replace}
          navigate={navigate}
          lifecycle={lifecycle}
          finishingDraft={finishingDraft}
          onDraftChange={(dirty) => setDraftSession(dirty ? client.getSessionKey() : null)}
          logout={() => logout()}
          activate={() => logout('/activate')}
          approvalCheckFailed={!!approval.error}
          checkApproval={approval.reload}
        />
      )
    }
    return (
      <AuthCardShell arabic title="الملف المهني">
        {approval.loading ? (
          <p role="status">جارٍ التحقق من حالة الموافقة…</p>
        ) : (
          <>
            <p role="alert">تعذّر التحقق من حالة الموافقة. حاول مرة أخرى.</p>
            <div className="remaining-form-actions">
              <button type="button" className="remaining-primary" onClick={approval.reload}>
                إعادة المحاولة
              </button>
              <button type="button" className="remaining-cancel" onClick={() => void logout()}>
                تسجيل الخروج
              </button>
            </div>
          </>
        )}
      </AuthCardShell>
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
      <>
        {client && !approved && (
          <AuthCardShell arabic title="الملف المهني">
            <p role="alert">تعذّر التحقق من حالة الموافقة. حاول مرة أخرى.</p>
            <button type="button" onClick={approval.reload}>إعادة المحاولة</button>
          </AuthCardShell>
        )}
        <div hidden={!!client && !approved} inert={!!client && !approved}>
          <Profile
            key="profile"
            page={path.endsWith('/settings') ? 'settings' : path.endsWith('/help') ? 'help' : 'profile'}
            navigate={navigate}
            api={client}
          />
        </div>
      </>
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
