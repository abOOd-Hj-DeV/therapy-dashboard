import { useState, type FormEvent } from 'react'
import { apiId, type ApiClient } from './api'
import { useApiUser } from './api-hooks'
import { formatCalendarDate, formatTimestamp } from './display-date'
import { DesignIcon, Workspace } from './Workspace'
import {
  CareAvatar,
  MutationStatus,
  ResourceStatus,
  careDate,
  careInstant,
  useCareMutation,
  useCareResource,
  type CareClient,
  type CareContent,
  type CareSession,
} from './api-sessions-and-clinical-support'
import './visual-client-profile.css'

type ClientRead = {
  client: { id: string; full_name: string; age: number; gender: string; language: string }
  clinical: {
    assessment_score: number
    safety_flag: boolean
    compliance_level: string | null
    latest_assessment: { type: string; score: number; completed_at: string | null } | null
  }
  sessions: CareSession[]
  stats: { total_sessions: number; completed: number; cancelled: number }
}
type NotesRead = {
  notes: { id: string; body: string; created_at: string | null }[]
  session_reports: { session_id: string; session_date: string | null; summary: string }[]
}
type Tab = 'overview' | 'sessions' | 'notes' | 'content'
type Props = { api: ApiClient; navigate: (path: string) => void }

export function ClientProfile({ api, navigate }: Props) {
  const user = useApiUser(api)
  let patientId: string | null = null
  try {
    patientId = apiId(new URLSearchParams(window.location.search).get('id') || '')
  } catch {
    // Never use an untrusted route value in an API path.
  }
  if (!user || user.role !== 'therapist' || !user.is_active || !user.phone_verified_at)
    return <p role="alert">سجّل الدخول بحساب معالج نشط لعرض العملاء.</p>
  if (!patientId)
    return (
      <Workspace title="إدارة العملاء / الملفات" active="Clients" api={api} navigate={navigate}>
        <p role="alert" className="client-profile-invalid">اختر عميلاً من قائمة عملائك.</p>
      </Workspace>
    )
  return (
    <ClientProfileContent
      key={`${api.getSessionKey()}:${patientId}`}
      api={api}
      navigate={navigate}
      patientId={patientId}
    />
  )
}

function ClientProfileContent({ api, navigate, patientId }: Props & { patientId: string }) {
  const timezone = api.getUser()?.timezone || 'UTC'
  const [tab, setTab] = useState<Tab>('overview')
  const [filter, setFilter] = useState('All')
  const [note, setNote] = useState('')
  const clients = useCareResource<CareClient[]>(api, '/therapists/clients?per_page=100', 'pages')
  const relationship = clients.data?.find((item) => item.id === patientId)
  const active = relationship?.status === 'active' && !clients.loading && !clients.error
  const base = `/therapists/clients/${patientId}`
  const profile = useCareResource<ClientRead>(api, active ? base : null)
  const notes = useCareResource<NotesRead>(api, active && tab === 'notes' ? `${base}/notes` : null)
  const content = useCareResource<CareContent[]>(
    api,
    active && tab === 'content' ? `/therapists/content?patient_id=${patientId}&per_page=100` : null,
    'content',
  )
  const mutation = useCareMutation(api, notes.reload)
  const sameClient = !profile.data || profile.data.client.id === patientId
  const ready = active && sameClient && !!profile.data && !profile.loading && !profile.error
  const notesReady = !!notes.data && !notes.loading && !notes.error
  const sessions = profile.data?.sessions ?? []
  const today = Date.now()
  const sessionRows = sessions.filter((item) => {
    if (filter === 'All') return true
    if (filter === 'Completed') return item.status === 'completed'
    if (filter === 'Cancelled') return item.status === 'cancelled'
    return ['pending', 'confirmed'].includes(item.status) && (careInstant(item) ?? 0) >= today
  })
  async function addNote(event: FormEvent) {
    event.preventDefault()
    if (!ready || !notesReady || mutation.disabled || note.trim().length < 3 || note.trim().length > 5000) return
    await mutation.run(`${base}/notes`, { body: note.trim() }, {
      onSuccess: () => setNote(''),
      success: 'أُضيفت ملاحظة المعالج الخاصة على الخادم.',
    })
  }
  return (
    <Workspace
      title="إدارة العملاء / الملفات"
      mobileTitle="إدارة العملاء / الملف"
      active="Clients"
      api={api}
      navigate={navigate}
    >
      <div className="client-profile-layout">
        <aside className="client-profile-summary">
          <div className="client-profile-identity">
            <CareAvatar name={relationship?.full_name || 'Client'} detail />
            <div>
              <h2>{relationship?.full_name || 'Client'}</h2>
              {ready && <p>Age {profile.data?.client.age} · {profile.data?.client.gender}</p>}
            </div>
          </div>
          <button
            className="teal-button client-profile-contact"
            disabled={!active}
            onClick={() => navigate(`/chats?client=${patientId}`)}
          >
            Contact patient
          </button>
          <div className="client-profile-actions">
            <button className="soft-button" disabled title="حجز المعالج غير مدعوم في API">
              Schedule
            </button>
            <button className="soft-button" disabled title="الاتصال غير متاح في API">
              Call
            </button>
          </div>
          <h3>معلومات التواصل</h3>
          <p className="client-profile-unavailable">Contact details are not supplied by the therapist API.</p>
          <h3>Subscription</h3>
          <p className="client-profile-unavailable">Subscription details are not supplied by the therapist API.</p>
        </aside>
        <div className="client-profile-content">
          <div className="client-profile-tabs" role="tablist" aria-label="Client profile sections">
            {([
              ['overview', 'Overview'],
              ['sessions', 'Sessions'],
              ['notes', 'Notes'],
              ['content', 'محتوى مخصص'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                aria-selected={tab === value}
                className={tab === value ? 'selected' : ''}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <ResourceStatus resource={clients} label="clients" />
          {!clients.loading && !clients.error && !relationship && (
            <p role="alert">هذا العميل ليس في قائمة عملائك الحالية.</p>
          )}
          {relationship?.status === 'past' && (
            <p role="alert">المعلومات الإكلينيكية الحالية غير متاحة لعميل سابق.</p>
          )}
          <ResourceStatus resource={profile} label="ملف العميل" />
          {!sameClient && <p role="alert">الملف المعاد لا يطابق هذا العميل.</p>}
          {ready && tab === 'overview' && profile.data && (
            <div className="client-profile-overview">
              <div className="client-profile-stats">
                <div><strong>{profile.data.stats.total_sessions}</strong><span>إجمالي الجلسات</span></div>
                <div><strong>{profile.data.stats.completed}</strong><span>الجلسات المكتملة</span></div>
                <div><strong>{profile.data.stats.cancelled}</strong><span>الجلسات الملغاة</span></div>
              </div>
              <div className="client-profile-clinical">
                <div><span>درجة التقييم</span><strong>{profile.data.clinical.assessment_score}</strong></div>
                <div><span>Compliance</span><strong>{profile.data.clinical.compliance_level || 'Unavailable'}</strong></div>
                <div><span>علامة السلامة</span><strong>{profile.data.clinical.safety_flag ? 'Flagged' : 'بدون علامة'}</strong></div>
                {profile.data.clinical.latest_assessment && (
                  <div><span>Latest assessment · {profile.data.clinical.latest_assessment.type}</span><strong>{profile.data.clinical.latest_assessment.score}</strong></div>
                )}
                <p>لا يوفّر API مخططات التقدم أو الاستنتاجات الإكلينيكية.</p>
              </div>
            </div>
          )}
          {ready && tab === 'sessions' && (
            <div className="client-profile-sessions">
              <div className="client-profile-session-controls">
                <div role="group" aria-label="تصفية جلسات العميل">
                  {['All', 'Upcoming', 'Completed', 'Cancelled'].map((value) => (
                    <button key={value} className={filter === value ? 'selected' : ''} onClick={() => setFilter(value)}>{value}</button>
                  ))}
                </div>
                <button className="teal-button" disabled title="حجز المعالج غير مدعوم في API">Schedule session</button>
              </div>
              {!sessionRows.length && <p className="client-profile-empty">No {filter.toLowerCase()} sessions available.</p>}
              {sessionRows.map((session) => (
                <button
                  key={session.id}
                  className={`client-profile-session client-profile-session-${session.status}`}
                  onClick={() => navigate(`/sessions/upcoming?id=${apiId(session.id)}`)}
                >
                  <span className="client-profile-session-mark" aria-hidden="true"><DesignIcon name="part2-07-imgCalendarAlt.svg" /></span>
                  <span className="client-profile-session-copy"><strong>{session.is_initial ? 'استشارة أولية' : 'جلسة علاج'}</strong><small>{careDate(session, timezone)} · {session.medium}</small></span>
                  <span className="client-profile-session-status">{session.status}</span>
                </button>
              ))}
            </div>
          )}
          {active && tab === 'notes' && (
            <div className="client-profile-notes">
              <ResourceStatus resource={notes} label="ملاحظات خاصة" />
              <form onSubmit={(event) => void addNote(event)} className="client-profile-note-form">
                <label htmlFor="client-note">New Note</label>
                <textarea
                  id="client-note"
                  placeholder="اكتب ملاحظتك هنا..."
                  value={note}
                  maxLength={5000}
                  onChange={(event) => setNote(event.target.value)}
                />
                <button className="teal-button" disabled={!ready || !notesReady || mutation.disabled || note.trim().length < 3}>Add Note</button>
              </form>
              <MutationStatus mutation={mutation} refreshed={notesReady} />
              <h3>الملاحظات السابقة</h3>
              {notesReady && !notes.data?.notes.length && <p>لا توجد ملاحظات خاصة بعد.</p>}
              {notes.data?.notes.map((item) => {
                const date = formatTimestamp(item.created_at, timezone)
                return (
                  <article className="client-profile-note" key={item.id}>
                    <strong>ملاحظة المعالج الخاصة</strong>
                    {date && <time dateTime={item.created_at ?? undefined}>{date}</time>}
                    <p>{item.body}</p>
                  </article>
                )
              })}
              {!!notes.data?.session_reports.length && <h3>تقارير الجلسات (مرئية للمريض)</h3>}
              {notes.data?.session_reports.map((item) => {
                const date = formatCalendarDate(item.session_date)
                return (
                  <article className="client-profile-note" key={item.session_id}>
                    <strong>تقرير الجلسة</strong>
                    {date && <time dateTime={item.session_date ?? undefined}>{date}</time>}
                    <p>{item.summary}</p>
                  </article>
                )
              })}
            </div>
          )}
          {active && tab === 'content' && (
            <div className="client-profile-content-list">
              <ResourceStatus resource={content} label="محتوى مسند" />
              <h3>محتوى مخصص</h3>
              {!content.loading && !content.error && !content.data?.length && <p>لا يوجد محتوى مسند بعد.</p>}
              {content.data?.map((item) => <article key={item.id} className="client-profile-note"><strong>{item.title}</strong><p>{item.content_type}</p></article>)}
            </div>
          )}
        </div>
      </div>
    </Workspace>
  )
}
