import { useState, type FormEvent, type MouseEvent } from 'react'
import { ApiClient, apiErrorMessage, apiId } from './api'
import { useApiResource } from './api-hooks'

type Status = 'pending' | 'rejected' | 'suspended'
type Document = {
  id: string
  doc_type: string
  status: string
  reason: string | null
  review_note: string | null
  accepts_upload: boolean
}

const sections = {
  '/profile/settings': 'Profile settings',
  '/profile/approval': 'Submit for approval',
  '/profile/documents': 'Requested documents',
}
const copy = {
  pending: {
    title: 'Your account is awaiting admin approval',
    next: 'Complete your profile and submit your license for review. An administrator will review your application before you can access the dashboard, sessions, or clients.',
  },
  rejected: {
    title: 'Your account was not approved',
    next: 'Review your profile and any document requests. Contact your administrator if you have questions, then resubmit your profile for review.',
  },
  suspended: {
    title: 'Your account is suspended',
    next: 'Contact your administrator to learn what is needed to restore dashboard access.',
  },
}

export function TherapistOnboarding({
  api,
  path,
  status,
  navigate,
  checkApproval,
}: {
  api: ApiClient
  path: string
  status: Status
  navigate: (path: string) => void
  checkApproval: () => void
}) {
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ error?: string; success?: string }>({})
  const documents = useApiResource<{ data: Document[] }>(
    api,
    path === '/profile/documents' ? '/therapists/me/documents' : null,
  )
  const current = submitted && status === 'rejected' ? 'pending' : status

  function link(event: MouseEvent<HTMLAnchorElement>, next: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    setNotice({})
    navigate(next)
  }

  async function save(event: FormEvent<HTMLFormElement>, document?: Document) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const data = new FormData(form)
    setNotice({})
    setBusy(true)
    try {
      if (document) {
        await api.mutate(`/therapists/me/documents/${apiId(document.id)}/upload`, data)
        form.reset()
        documents.reload()
        setNotice({ success: 'Document submitted for review.' })
      } else if (path === '/profile/approval') {
        const license = data.get('license')
        if (license instanceof File && !license.size) data.delete('license')
        await api.mutate('/therapists/me/approval', data)
        form.reset()
        setSubmitted(true)
        setNotice({ success: 'Profile submitted for approval.' })
      } else {
        const specialty = String(data.get('specialty')).trim()
        const country = String(data.get('country')).trim()
        const languages = String(data.get('languages'))
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        const bio = String(data.get('bio')).trim()
        const body = {
          ...(specialty && { specialty }),
          ...(country && { country }),
          ...(languages.length && { languages }),
          ...(bio && { bio }),
        }
        if (!Object.keys(body).length) {
          setNotice({ error: 'Enter at least one profile detail to update.' })
          return
        }
        await api.request('/therapists/me/settings', 'PUT', { body })
        setNotice({ success: 'Profile settings saved.' })
      }
    } catch (error) {
      setNotice({ error: apiErrorMessage(error) })
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await api.logout()
      navigate('/login')
    } catch {
      navigate('/login?logout=revocation-unknown')
    }
  }

  return (
    <main className="approval-page">
      <h1>{copy[current].title}</h1>
      <p>Status: {current}</p>
      <p>{copy[current].next}</p>
      <nav aria-label="Therapist onboarding">
        {Object.entries(sections).map(([href, label]) => (
          <a
            key={href}
            href={href}
            aria-current={path === href ? 'page' : undefined}
            onClick={(event) => link(event, href)}
          >
            {label}
          </a>
        ))}
      </nav>
      {path === '/profile/settings' && (
        <form className="auth-form" onSubmit={save}>
          <h2>Profile settings</h2>
          <p>Enter only the details you want to update.</p>
          <fieldset disabled={busy}>
            <label>
              Specialty
              <input name="specialty" maxLength={255} />
            </label>
            <label>
              Country
              <input name="country" maxLength={100} />
            </label>
            <label>
              Language codes (comma-separated)
              <input name="languages" />
            </label>
            <label>
              Bio
              <textarea name="bio" maxLength={2000} />
            </label>
            <button className="primary-button" type="submit">
              Save profile settings
            </button>
          </fieldset>
        </form>
      )}
      {path === '/profile/approval' && (
        <form className="auth-form" onSubmit={save}>
          <h2>Submit for approval</h2>
          <p>Upload a license (JPG, PNG, or PDF, up to 5 MB) if one is not already on file.</p>
          <fieldset disabled={busy}>
            <label>
              License
              <input name="license" type="file" accept="image/jpeg,image/png,application/pdf" />
            </label>
            <button className="primary-button" type="submit">
              Submit profile for review
            </button>
          </fieldset>
        </form>
      )}
      {path === '/profile/documents' && (
        <section>
          <h2>Requested documents</h2>
          {documents.loading && <p role="status">Loading requests…</p>}
          {documents.error && <p role="alert">{apiErrorMessage(documents.error)}</p>}
          {documents.data?.data.length === 0 && <p>No documents have been requested.</p>}
          {documents.data?.data.map((document) => (
            <article key={document.id}>
              <h3>{document.doc_type}</h3>
              <p>Status: {document.status}</p>
              {document.reason && <p>{document.reason}</p>}
              {document.review_note && <p>{document.review_note}</p>}
              {document.accepts_upload && (
                <form onSubmit={(event) => void save(event, document)}>
                  <label>
                    Document for {document.doc_type}
                    <input
                      name="file"
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      required
                      disabled={busy}
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    Upload document
                  </button>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {notice.error && <p role="alert">{notice.error}</p>}
      {notice.success && <p role="status">{notice.success}</p>}
      <div className="approval-actions">
        <button type="button" className="soft-button" disabled={busy} onClick={checkApproval}>
          Check approval status
        </button>
        <button type="button" className="soft-button" onClick={logout}>
          Log out
        </button>
      </div>
    </main>
  )
}
