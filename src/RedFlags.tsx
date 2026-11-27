import { useState } from 'react'
import { ApiClient, ApiError, apiId } from './api'
import { useApiResource } from './api-hooks'
import { trackCareMutation } from './api-resource-refresh'
import { formatTimestamp } from './display-date'
import { Workspace } from './Workspace'
import './red-flags.css'

type Decision = 'reactivate' | 'keep_hold' | 'close'

const decisionLabels: Record<Decision, string> = {
  reactivate: 'إعادة تفعيل الحساب',
  keep_hold: 'إبقاء الحساب معلّقًا',
  close: 'إغلاق الحالة',
}

type RedFlag = {
  id: string
  patient_name: string
  patient_whatsapp?: string | null
  type: string
  source?: string | null
  description: string
  priority: 'high' | 'medium' | 'low'
  status: string
  created_at: string
  therapist_name?: string | null
  assessment_score?: number | null
  on_hold: boolean
  allowed_decisions?: Decision[]
  hold_since?: string | null
  reactivation_requested_at?: string | null
  action_taken?: string | null
}

type RedFlagResponse = {
  data: RedFlag[]
  pagination: { current_page: number; last_page: number; per_page: number; total: number }
}

const typeLabels: Record<string, string> = {
  low_mood: 'درجة اكتئاب أو قلق مرتفعة',
  non_compliance: 'عدم التزام بالخطة العلاجية',
}

function redFlagLabel(type: string, source?: string | null): string {
  if (type !== 'safety') return typeLabels[type] ?? 'تنبيه سريري'
  switch (source) {
    case 'assessment': return 'إشارة سلامة من تقييم'
    case 'manual_support': return 'طلب دعم عاجل من التطبيق'
    default: return 'بلاغ سلامة يحتاج إلى مراجعة'
  }
}

const priorityLabels: Record<RedFlag['priority'], string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
}

const demoFlags: RedFlag[] = [
  {
    id: 'demo-red-flag-001',
    patient_name: 'مريم صالح',
    patient_whatsapp: '+963944123456',
    type: 'safety',
    source: 'assessment',
    description: 'أشار المريض في السؤال التاسع من PHQ-9 إلى أفكار لإيذاء النفس.',
    priority: 'high',
    status: 'open',
    created_at: '2025-03-14T08:30:00+03:00',
    therapist_name: 'د. عيسى الحداد',
    assessment_score: 27,
    on_hold: true,
    allowed_decisions: ['reactivate', 'keep_hold'],
    hold_since: '2025-03-14T08:30:00+03:00',
    reactivation_requested_at: '2025-03-14T09:15:00+03:00',
    action_taken: 'تم إرسال طلب إعادة التفعيل. بانتظار مراجعة الفريق.',
  },
]

function phoneDigits(value: string | null | undefined): string {
  return value?.replace(/\D/g, '') ?? ''
}

export function RedFlags({
  api,
  navigate,
}: {
  api?: ApiClient
  navigate: (path: string) => void
}) {
  const demo = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true' && !api
  const timezone = api?.getUser()?.timezone || 'Asia/Damascus'
  const actor = api?.getSessionKey()
  const [navigation, setNavigation] = useState({ api, actor, page: 1 })
  const page = navigation.api === api && navigation.actor === actor ? navigation.page : 1
  const changePage = (next: number) => setNavigation({ api, actor, page: next })
  const resource = useApiResource<RedFlagResponse>(
    api,
    demo ? null : page === 1 ? '/therapists/red-flags' : `/therapists/red-flags?page=${page}`,
    { interval: 15_000 },
  )
  const flags = demo ? demoFlags : resource.data?.data ?? []
  const pagination = resource.data?.pagination
  const loading = resource.loading
  const error = resource.error
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [success, setSuccess] = useState('')

  function selectedDecisionFor(flag: RedFlag) {
    const allowed = flag.allowed_decisions ?? []
    const selected = decisions[flag.id]
    return allowed.includes(selected) ? selected : allowed[0]
  }

  async function submitDecision(flag: RedFlag) {
    const note = (notes[flag.id] ?? '').trim()
    const decision = selectedDecisionFor(flag)
    if (demo || !api || !decision || note.length < 3 || submitting[flag.id]) return

    setSubmitting((current) => ({ ...current, [flag.id]: true }))
    setErrors((current) => ({ ...current, [flag.id]: '' }))
    setSuccess('')
    trackCareMutation(api, 1)
    try {
      await api.mutate(`/therapists/red-flags/${apiId(flag.id)}/decision`, {
        decision,
        note,
      })
      setSuccess('تم حفظ القرار وتحديث الحالات.')
      resource.reload()
    } catch (cause) {
      const conflict = cause instanceof ApiError && cause.status === 409
      setErrors((current) => ({ ...current, [flag.id]: conflict ? 'تغيّرت حالة البلاغ. تحقّق من الخيارات المحدّثة.' : 'تعذر حفظ القرار. حاول مرة أخرى.' }))
      if (conflict) resource.reload()
    } finally {
      trackCareMutation(api, -1)
      setSubmitting((current) => ({ ...current, [flag.id]: false }))
    }
  }

  return (
    <Workspace title="حالات الخطر" active="RedFlags" navigate={navigate} api={api}>
      <section className="red-flags-page" aria-label="حالات الخطر">
        {demo && <p className="red-flags-demo-notice">عرض تجريبي — لا تُرسل الإجراءات إلى الخادم.</p>}
        {!demo && loading && <p role="status">جارٍ تحميل حالات الخطر...</p>}
        {!demo && error && (
          <p className="red-flags-error" role="alert">
            {page > 1 ? `تعذر تحميل الصفحة ${page}؛ البلاغات المتاحة غير مكتملة.` : 'تعذر تحميل حالات الخطر.'}
            <button type="button" onClick={resource.reload}>إعادة المحاولة</button>
          </p>
        )}
        {success && <p className="red-flags-success" role="status">{success}</p>}
        {!demo && !loading && !error && pagination?.total === 0 && (
          <p className="red-flags-empty">لا توجد حالات خطر مفتوحة لمرضاك.</p>
        )}
        {!demo && !loading && !error && pagination && pagination.total > 0 && flags.length === 0 && (
          <p className="red-flags-empty">لا توجد بلاغات في هذه الصفحة.</p>
        )}
        {flags.map((flag) => {
          const digits = phoneDigits(flag.patient_whatsapp)
          const note = notes[flag.id] ?? ''
          const allowedDecisions = flag.allowed_decisions ?? []
          const selectedDecision = selectedDecisionFor(flag)
          const isSubmitting = submitting[flag.id] ?? false

          return (
            <article className="red-flag-card" key={flag.id}>
              <header className="red-flag-card-header">
                <h2>{flag.patient_name}</h2>
                <div className="red-flag-badges" aria-label="مستوى الحالة">
                  <span className={`red-flag-priority priority-${flag.priority}`}>
                    أولوية {priorityLabels[flag.priority]}
                  </span>
                  {flag.on_hold && <span className="red-flag-hold">الحساب معلّق</span>}
                  {flag.reactivation_requested_at && (
                    <span className="red-flag-request">
                      طلب إعادة تفعيل · <time dateTime={flag.reactivation_requested_at}>{formatTimestamp(flag.reactivation_requested_at, timezone, 'ar-SY-u-nu-latn') || '—'}</time>
                    </span>
                  )}
                </div>
              </header>

              <div className="red-flag-reason">
                <strong>{redFlagLabel(flag.type, flag.source)}</strong>
                <p>{flag.description}</p>
                {flag.assessment_score != null && <p>الدرجة: {flag.assessment_score}</p>}
              </div>

              <p className="red-flag-meta">
                المعالج: {flag.therapist_name ?? 'غير معيّن'} · {formatTimestamp(flag.created_at, timezone, 'ar-SY-u-nu-latn') || '—'}
              </p>

              {flag.action_taken && <p className="red-flag-history">{flag.action_taken}</p>}

              <div className="red-flag-actions">
                {digits && (demo ? (
                  <button className="red-flag-whatsapp" type="button" disabled>
                    تواصل عبر واتساب
                  </button>
                ) : (
                  <a className="red-flag-whatsapp" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
                    تواصل عبر واتساب
                  </a>
                ))}

                {selectedDecision && <form className="red-flag-decision" onSubmit={(event) => {
                  event.preventDefault()
                  void submitDecision(flag)
                }}>
                  {allowedDecisions.length > 1 ? (
                    <fieldset disabled={demo || isSubmitting}>
                      <legend>قرار الحالة</legend>
                      {allowedDecisions.map(option => (
                        <label key={option}>
                          <input
                            type="radio"
                            name={`decision-${flag.id}`}
                            value={option}
                            checked={selectedDecision === option}
                            onChange={() => setDecisions((current) => ({ ...current, [flag.id]: option }))}
                          />
                          {decisionLabels[option]}
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className="red-flag-close-label">{decisionLabels[selectedDecision]}</p>
                  )}
                  <label className="red-flag-note-label">
                    ملاحظة القرار
                    <textarea
                      value={note}
                      maxLength={1900}
                      disabled={demo || isSubmitting}
                      onChange={(event) => setNotes((current) => ({ ...current, [flag.id]: event.target.value }))}
                    />
                  </label>
                  <p className="red-flag-note-help">سجّل ما تم في التواصل مع المريض. تُحفظ الملاحظة في السجل.</p>
                  <button
                    className="red-flag-submit"
                    type="submit"
                    disabled={demo || isSubmitting || note.trim().length < 3}
                  >
                    {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ القرار'}
                  </button>
                </form>}
                {errors[flag.id] && <p className="red-flags-error" role="alert">{errors[flag.id]}</p>}
              </div>
            </article>
          )
        })}
        {!demo && (page > 1 || (pagination?.last_page ?? 1) > 1) && (
          <nav aria-label="صفحات البلاغات">
            <button type="button" disabled={page === 1} onClick={() => changePage(page - 1)}>الصفحة السابقة</button>
            {pagination && page <= pagination.last_page && (
              <span>الصفحة {page} من {pagination.last_page} · إجمالي البلاغات: {pagination.total}</span>
            )}
            <button type="button" disabled={!pagination || page >= pagination.last_page} onClick={() => changePage(page + 1)}>الصفحة التالية</button>
          </nav>
        )}
      </section>
    </Workspace>
  )
}
