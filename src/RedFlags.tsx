import { useEffect, useRef, useState } from 'react'
import { ApiClient, apiId } from './api'
import { useApiResource } from './api-hooks'
import { trackCareMutation } from './api-resource-refresh'
import { Workspace } from './Workspace'
import './red-flags.css'

type Decision = 'reactivate' | 'keep_hold' | 'close'

type RedFlag = {
  id: string
  patient_name: string
  patient_whatsapp?: string | null
  type: string
  description: string
  priority: 'high' | 'medium' | 'low'
  status: string
  created_at: string
  therapist_name?: string | null
  assessment_score?: number | null
  on_hold: boolean
  hold_since?: string | null
  reactivation_requested_at?: string | null
  action_taken?: string | null
}

type RedFlagResponse = {
  data: RedFlag[]
  pagination: { current_page: number; last_page: number; per_page: number; total: number }
}

async function loadRemainingPages(
  api: ApiClient,
  firstPage: RedFlagResponse,
  signal: AbortSignal,
): Promise<RedFlag[]> {
  const flags = [...firstPage.data]
  let currentPage = firstPage.pagination.current_page
  let lastPage = firstPage.pagination.last_page
  let requestedPages = 1

  while (currentPage < lastPage && requestedPages < 20) {
    const page = await api.get<RedFlagResponse>(
      `/therapists/red-flags?page=${currentPage + 1}`,
      signal,
    )
    flags.push(...page.data)
    currentPage = page.pagination.current_page
    lastPage = page.pagination.last_page
    requestedPages++
  }

  return flags
}

const dateFormatter = new Intl.DateTimeFormat('ar-SY-u-nu-latn', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Damascus',
})

const typeLabels: Record<string, string> = {
  safety: 'أفكار لإيذاء النفس',
  low_mood: 'درجة اكتئاب أو قلق مرتفعة',
  non_compliance: 'عدم التزام بالخطة العلاجية',
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
    description: 'أشار المريض في السؤال التاسع من PHQ-9 إلى أفكار لإيذاء النفس.',
    priority: 'high',
    status: 'open',
    created_at: '2025-03-14T08:30:00+03:00',
    therapist_name: 'د. عيسى الحداد',
    assessment_score: 27,
    on_hold: true,
    hold_since: '2025-03-14T08:30:00+03:00',
    reactivation_requested_at: '2025-03-14T09:15:00+03:00',
    action_taken: 'تم إرسال طلب إعادة التفعيل. بانتظار مراجعة الفريق.',
  },
]

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormatter.format(date)
}

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
  const paginationLoadingRef = useRef(false)
  const resource = useApiResource<RedFlagResponse>(
    api,
    demo ? null : '/therapists/red-flags',
    { interval: 15_000, shouldSkipBackground: () => paginationLoadingRef.current },
  )
  const [allFlags, setAllFlags] = useState<RedFlag[] | null>(null)
  const [paginationLoading, setPaginationLoading] = useState(false)
  const [paginationError, setPaginationError] = useState(false)
  useEffect(() => {
    const firstPage = resource.data
    if (!api || demo || !firstPage) {
      paginationLoadingRef.current = false
      setAllFlags(null)
      setPaginationLoading(false)
      setPaginationError(false)
      return
    }
    const controller = new AbortController()
    let active = true
    paginationLoadingRef.current = false
    setPaginationError(false)
    setPaginationLoading(false)
    if (firstPage.pagination.current_page >= firstPage.pagination.last_page) {
      setAllFlags(firstPage.data)
      return () => controller.abort()
    }
    paginationLoadingRef.current = true
    setPaginationLoading(true)
    void loadRemainingPages(api, firstPage, controller.signal)
      .then((flags) => {
        if (active) setAllFlags(flags)
      })
      .catch(() => {
        if (active && !controller.signal.aborted) setPaginationError(true)
      })
      .finally(() => {
        if (active) {
          paginationLoadingRef.current = false
          setPaginationLoading(false)
        }
      })
    return () => {
      active = false
      paginationLoadingRef.current = false
      controller.abort()
    }
  }, [api, demo, resource.data])
  const flags = demo ? demoFlags : allFlags ?? resource.data?.data ?? []
  const loading = resource.loading || (paginationLoading && allFlags === null)
  const error = resource.error || paginationError
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})
  const [success, setSuccess] = useState('')

  async function submitDecision(flag: RedFlag) {
    const note = (notes[flag.id] ?? '').trim()
    if (demo || !api || note.length < 3 || submitting[flag.id]) return

    setSubmitting((current) => ({ ...current, [flag.id]: true }))
    setErrors((current) => ({ ...current, [flag.id]: '' }))
    setSuccess('')
    trackCareMutation(api, 1)
    try {
      await api.mutate(`/therapists/red-flags/${apiId(flag.id)}/decision`, {
        decision: flag.on_hold ? (decisions[flag.id] ?? 'reactivate') : 'close',
        note,
      })
      setSuccess('تم حفظ القرار وتحديث الحالات.')
      resource.reload()
    } catch {
      setErrors((current) => ({ ...current, [flag.id]: 'تعذر حفظ القرار. حاول مرة أخرى.' }))
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
            تعذر تحميل حالات الخطر.
            <button type="button" onClick={resource.reload}>إعادة المحاولة</button>
          </p>
        )}
        {success && <p className="red-flags-success" role="status">{success}</p>}
        {!demo && !loading && !error && flags.length === 0 && (
          <p className="red-flags-empty">لا توجد حالات خطر مفتوحة لمرضاك.</p>
        )}
        {flags.map((flag) => {
          const digits = phoneDigits(flag.patient_whatsapp)
          const note = notes[flag.id] ?? ''
          const selectedDecision = decisions[flag.id] ?? 'reactivate'
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
                      طلب إعادة تفعيل · <time dateTime={flag.reactivation_requested_at}>{formatDate(flag.reactivation_requested_at)}</time>
                    </span>
                  )}
                </div>
              </header>

              <div className="red-flag-reason">
                <strong>{typeLabels[flag.type] ?? 'حالة للمراجعة'}</strong>
                <p>{flag.description}</p>
                {flag.assessment_score != null && <p>الدرجة: {flag.assessment_score}</p>}
              </div>

              <p className="red-flag-meta">
                المعالج: {flag.therapist_name ?? 'غير معيّن'} · {formatDate(flag.created_at)}
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

                <form className="red-flag-decision" onSubmit={(event) => {
                  event.preventDefault()
                  void submitDecision(flag)
                }}>
                  {flag.on_hold ? (
                    <fieldset disabled={demo || isSubmitting}>
                      <legend>قرار الحالة</legend>
                      <label>
                        <input
                          type="radio"
                          name={`decision-${flag.id}`}
                          value="reactivate"
                          checked={selectedDecision === 'reactivate'}
                          onChange={() => setDecisions((current) => ({ ...current, [flag.id]: 'reactivate' }))}
                        />
                        إعادة تفعيل الحساب
                      </label>
                      <label>
                        <input
                          type="radio"
                          name={`decision-${flag.id}`}
                          value="keep_hold"
                          checked={selectedDecision === 'keep_hold'}
                          onChange={() => setDecisions((current) => ({ ...current, [flag.id]: 'keep_hold' }))}
                        />
                        إبقاء الحساب معلّقًا
                      </label>
                    </fieldset>
                  ) : (
                    <p className="red-flag-close-label">إغلاق الحالة</p>
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
                  {errors[flag.id] && <p className="red-flags-error" role="alert">{errors[flag.id]}</p>}
                  <button
                    className="red-flag-submit"
                    type="submit"
                    disabled={demo || isSubmitting || note.trim().length < 3}
                  >
                    {isSubmitting ? 'جارٍ الحفظ...' : 'حفظ القرار'}
                  </button>
                </form>
              </div>
            </article>
          )
        })}
      </section>
    </Workspace>
  )
}
