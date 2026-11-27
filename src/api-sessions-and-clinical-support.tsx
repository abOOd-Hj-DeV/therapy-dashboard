import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClient, ApiError, apiErrorMessage, safeExternalUrl } from './api'
import { isCareMutationInFlight, trackCareMutation } from './api-resource-refresh'
import { formatTimestamp, formatWallDateTime } from './display-date'
import './visual-sessions-clinical.css'

export type CareSession = {
  id: string
  patient_id: string
  therapist_id: string
  session_date: string | null
  session_time: string
  starts_at: string | null
  local: { date: string; time: string; timezone: string } | null
  medium: 'zoom' | 'meet' | 'whatsapp'
  price: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
  is_initial: boolean
  payment_status: 'paid' | 'pending' | 'free'
  link: string | null
  summary: string | null
  report_revision: number | null
  attendance_confirmed_at: string | null
  reschedule: {
    date: string
    time: string
    local: CareSession['local']
    requested_at: string | null
  } | null
  cancellation: { pending: boolean; requested_at: string | null; forfeited: boolean } | null
}
export type CareClient = {
  id: string
  full_name: string
  age: number
  gender: string
  language: string
  status: 'active' | 'past'
  completed_sessions_count: number
}
export type CareContent = {
  id: string
  title: string
  content_type: 'text' | 'video' | 'link'
  body: string | null
  url: string | null
  assigned_patients: { id: string; name: string; assigned_at: string | null }[] | null
}
export type CareResource<T> = {
  data: T | null
  loading: boolean
  error: unknown | null
  reload: () => void
}
type Shape = 'single' | 'pages' | 'content'
type ResourceOptions = {
  interval?: number
  shouldSkipBackground?: () => boolean
}

export function useCareResource<T>(
  api: ApiClient,
  path: string | null,
  shape: Shape = 'single',
  { interval = 30_000, shouldSkipBackground }: ResourceOptions = {},
): CareResource<T> {
  const [state, setState] = useState<{
    actor: number
    shape: Shape
    path: string | null
    data: T | null
    loading: boolean
    error: unknown | null
  }>({ actor: api.getSessionKey(), shape, path, data: null, loading: !!path, error: null })
  const activeRequest = useRef<AbortController | null>(null)
  const requestId = useRef(0)
  const mounted = useRef(false)
  const runRef = useRef<(background: boolean) => void>(() => {})
  const actor = api.getSessionKey()

  runRef.current = (background) => {
    if (!path) return
    if (background && (
      navigator.onLine === false ||
      shouldSkipBackground?.() ||
      isCareMutationInFlight(api) ||
      activeRequest.current
    )) return
    const resourcePath = path

    const id = ++requestId.current
    activeRequest.current?.abort()
    const controller = new AbortController()
    activeRequest.current = controller

    // Reload keeps real data/drafts mounted, but marks it stale and disables writes.
    setState((current) => {
      const currentData = current.path === path && current.actor === actor && current.shape === shape
        ? current.data
        : null
      return {
        path,
        actor,
        shape,
        data: currentData,
        loading: background ? current.loading : true,
        error: current.path === path && current.actor === actor && current.shape === shape
          ? current.error
          : null,
      }
    })

    async function load(): Promise<T> {
      if (shape === 'single') return api.get<T>(resourcePath, controller.signal)
      const items: unknown[] = []
      let lastPage = 1
      for (let page = 1; page <= lastPage; page++) {
        const result = await api.get<{
          data: unknown[] | { data: unknown[]; last_page: number }
          pagination?: { last_page: number }
        }>(
          `${resourcePath}${resourcePath.includes('?') ? '&' : '?'}page=${page}`,
          controller.signal,
        )
        const paginator =
          shape === 'content' ? (result.data as { data: unknown[]; last_page: number }) : null
        const rows = paginator ? paginator.data : result.data
        lastPage = paginator ? paginator.last_page : (result.pagination?.last_page ?? 0)
        if (!Array.isArray(rows) || !Number.isInteger(lastPage) || lastPage < 1 || lastPage > 1000)
          throw new ApiError(502)
        items.push(...rows)
      }
      return items as unknown as T
    }

    const current = () =>
      mounted.current &&
      id === requestId.current &&
      !controller.signal.aborted &&
      api.getSessionKey() === actor

    void load()
      .then((data) => {
        if (current()) setState({ actor, shape, path, data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!current()) return
        const apiError = error instanceof ApiError ? error : new ApiError(0)
        if (
          background &&
          (apiError.status === 0 ||
            apiError.status === 408 ||
            apiError.status === 429 ||
            apiError.status >= 500)
        ) return
        setState((currentState) => {
          const inScope =
            currentState.path === path &&
            currentState.actor === actor &&
            currentState.shape === shape
          return {
            actor,
            shape,
            path,
            data: inScope && !(apiError.status >= 400 && apiError.status < 500)
              ? currentState.data
              : null,
            loading: false,
            error: apiError,
          }
        })
      })
      .finally(() => {
        if (activeRequest.current === controller) activeRequest.current = null
      })
  }

  const reload = useCallback(() => runRef.current(false), [])

  useEffect(() => {
    if (!path) return
    let active = true
    mounted.current = true
    const onRefresh = () => {
      if (active && document.visibilityState === 'visible') runRef.current(true)
    }
    const onOnline = () => {
      if (active && document.visibilityState === 'visible') runRef.current(true)
    }
    window.addEventListener('focus', onRefresh)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onRefresh)
    const timer = interval > 0 ? window.setInterval(onRefresh, interval) : undefined
    runRef.current(false)

    return () => {
      active = false
      requestId.current += 1
      activeRequest.current?.abort()
      activeRequest.current = null
      mounted.current = false
      window.removeEventListener('focus', onRefresh)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onRefresh)
      if (timer !== undefined) window.clearInterval(timer)
    }
  }, [api, path, shape, actor, interval])
  return {
    ...(state.path === path && state.actor === actor && state.shape === shape
      ? state
      : { data: null, loading: !!path, error: null }),
    reload,
  }
}

export function ResourceStatus({
  resource,
  label,
}: {
  resource: CareResource<unknown>
  label: string
}) {
  return (
    <>
      {resource.loading && <p role="status">Loading {label}…</p>}
      {resource.error != null && (
        <div role="alert">
          <p>{apiErrorMessage(resource.error)}</p>
          <p>Previously loaded {label}, if shown, may be out of date.</p>
          <button className="soft-button" onClick={resource.reload}>
            Retry {label}
          </button>
        </div>
      )}
    </>
  )
}

export function useCareOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

// One in-flight write per editor, with synchronous duplicate-submit protection.
// Unsupported replay routes are never automatically retried after unknown results.
export function useCareMutation(api: ApiClient, refresh: () => void) {
  const pending = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const retryIntent = useRef<{ fingerprint: string; key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [review, setReview] = useState(false)
  const [retryAt, setRetryAt] = useState(0)
  const [, setTick] = useState(0)
  const actor = api.getUser()?.id
  const online = useCareOnline()
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      pending.current?.abort()
    }
  }, [api])
  useEffect(() => {
    if (retryAt <= Date.now()) return
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])
  const wait = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
  async function run(
    path: string,
    body?: unknown,
    options: {
      method?: string
      idempotent?: boolean
      onSuccess?: () => void
      success?: string
    } = {},
  ) {
    if (pending.current || !online || review || wait > 0 || !actor || api.getUser()?.id !== actor)
      return false
    const controller = new AbortController()
    pending.current = controller
    trackCareMutation(api, 1)
    setBusy(true)
    setError('')
    setNotice('')
    let key: string | undefined
    if (options.idempotent) {
      const fingerprint = JSON.stringify([path, options.method ?? 'POST', body])
      if (retryIntent.current?.fingerprint !== fingerprint)
        retryIntent.current = { fingerprint, key: crypto.randomUUID() }
      key = retryIntent.current.key
    }
    const current = () =>
      mounted.current && !controller.signal.aborted && api.getUser()?.id === actor
    try {
      await api.mutate(
        path,
        body,
        { signal: controller.signal, idempotencyKey: key },
        options.method ?? 'POST',
      )
      if (!current()) return false
      retryIntent.current = null
      options.onSuccess?.()
      setNotice(options.success ?? 'Saved on the server.')
      refresh()
      return true
    } catch (failure) {
      if (!current()) return false
      // Use only fixed messages, never raw exception or validation field content.
      const fields = failure instanceof ApiError ? Object.keys(failure.fields) : []
      const hints = fields.filter((field) =>
        [
          'body',
          'session_id',
          'status',
          'attendance',
          'payment_status',
          'link',
          'summary',
          'note',
          'title',
          'content_type',
          'url',
          'patient_ids',
          'module',
          'session_date',
          'session_time',
          'subscription',
        ].includes(field),
      )
      setError(`${apiErrorMessage(failure)}${hints.length ? ` Check: ${hints.join(', ')}.` : ''}`)
      if (failure instanceof ApiError && failure.retryAfter)
        setRetryAt(Date.now() + failure.retryAfter * 1000)
      if (failure instanceof ApiError && [403, 404].includes(failure.status)) refresh()
      if (
        !(failure instanceof ApiError) ||
        failure.status === 0 ||
        failure.status === 409 ||
        failure.status >= 500
      ) {
        refresh()
        if (!options.idempotent) setReview(true)
      }
      return false
    } finally {
      trackCareMutation(api, -1)
      if (pending.current === controller) pending.current = null
      if (current()) setBusy(false)
    }
  }
  return {
    run,
    busy,
    error,
    notice,
    review,
    wait,
    disabled: busy || !online || review || wait > 0,
    acknowledge: () => {
      setReview(false)
      setError('')
    },
  }
}
export type CareMutation = ReturnType<typeof useCareMutation>
export function MutationStatus({
  mutation,
  refreshed = true,
}: {
  mutation: CareMutation
  refreshed?: boolean
}) {
  return (
    <>
      {mutation.error && <p role="alert">{mutation.error}</p>}
      {mutation.wait > 0 && <p role="status">Wait {mutation.wait} seconds before retrying.</p>}
      {mutation.notice && <p role="status">{mutation.notice}</p>}
      {mutation.review && (
        <div role="alert">
          <p>
            The result may be unknown or conflicted. Review refreshed records before deciding
            whether another write is needed. A new attempt may duplicate a note or revision.
          </p>
          <button className="soft-button" disabled={!refreshed} onClick={mutation.acknowledge}>
            I reviewed the refreshed records
          </button>
        </div>
      )}
    </>
  )
}

export function careInstant(
  session: Pick<CareSession, 'starts_at' | 'session_date' | 'session_time'>,
): number | null {
  const value =
    session.starts_at ||
    (session.session_date && session.session_time
      ? `${session.session_date.slice(0, 10)}T${session.session_time.length === 5 ? `${session.session_time}:00` : session.session_time}Z`
      : '')
  const instant = Date.parse(value || '')
  return Number.isFinite(instant) ? instant : null
}
function dateInZone(instant: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  return ['year', 'month', 'day']
    .map((part) => parts.find((value) => value.type === part)?.value)
    .join('-')
}
export function careCategory(session: CareSession, timezone: string, now = Date.now()) {
  if (session.status === 'completed' || session.status === 'cancelled') return 'Previous'
  const instant = careInstant(session)
  if (instant === null) return 'Unknown'
  try {
    if (dateInZone(instant, timezone) === dateInZone(now, timezone)) return 'Today'
  } catch {
    return 'Unknown'
  }
  return instant > now ? 'Upcoming' : 'Previous'
}
export function careDate(
  session: Pick<CareSession, 'starts_at' | 'session_date' | 'session_time' | 'local'>,
  timezone: string,
): string {
  const instant = careInstant(session)
  if (instant !== null) {
    const label = formatTimestamp(instant, timezone)
    if (label) return `${label} · ${timezone}`
  }
  if (session.local) {
    const label = formatWallDateTime(session.local.date, session.local.time)
    if (label) return `${label} · ${session.local.timezone}`
  }
  const label = formatWallDateTime(session.session_date?.slice(0, 10) ?? null, session.session_time)
  return label ? `${label} · UTC` : 'Schedule unavailable'
}
export function careMeetingUrl(session: CareSession): string | null {
  if (session.status !== 'confirmed') return null
  const url = safeExternalUrl(session.link)
  if (!url) return null
  const hostname = new URL(url).hostname.toLowerCase()
  const domains =
    session.medium === 'zoom'
      ? ['zoom.us']
      : session.medium === 'meet'
        ? ['meet.google.com']
        : session.medium === 'whatsapp'
          ? ['wa.me', 'chat.whatsapp.com', 'whatsapp.com']
          : []
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ? url
    : null
}
export function CareAvatar({
  name,
  detail = false,
  hero = false,
}: {
  name: string
  detail?: boolean
  hero?: boolean
}) {
  return (
    <span
      className={hero ? 'initials' : `care-avatar ${detail ? 'detail-avatar' : 'avatar'}`}
      aria-hidden="true"
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join('') || '?'}
    </span>
  )
}
export function CareStatus({ status }: { status: CareSession['status'] }) {
  return (
    <span
      className={`session-status ${status === 'confirmed' ? 'ready' : status === 'cancelled' ? 'canceled' : status === 'pending' ? 'unsure' : ''}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
