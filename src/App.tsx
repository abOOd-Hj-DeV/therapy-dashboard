import { useEffect, useState } from 'react'
import { Auth } from './Auth'
import { Dashboard } from './Dashboard'

export function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [verificationEmail, setVerificationEmail] = useState('henryford@Sakina.com')
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  function navigate(next: string) {
    window.history.pushState({}, '', next)
    setPath(next)
    window.scrollTo({ top: 0 })
  }
  if (path === '/dashboard' || path === '/dashboard/') return <Dashboard navigate={navigate} />
  const page = path === '/signup' ? 'signup' : path === '/verify' ? 'verify' : 'login'
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
    />
  )
}
