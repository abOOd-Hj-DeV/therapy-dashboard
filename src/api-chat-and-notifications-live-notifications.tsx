import { useEffect, useRef, useState } from 'react'
import { ApiClient, apiErrorMessage, apiId } from './api'
import { useApiUser } from './api-hooks'
import { asset } from './assets'
import { formatTimestamp } from './display-date'
import {
  useChatConnectivity,
  useChatLifetime,
  useChatPolling,
} from './api-chat-and-notifications-polling'

type StoredNotification = {
  id: string
  data: Record<string, unknown>
  read_at: string | null
  created_at: string | null
}
type NotificationPage = {
  data: StoredNotification[]
  unread_count: number
  pagination: { current_page: number; last_page: number; total: number }
}
type Props = {
  api?: ApiClient
  navigate?: (path: string) => void
  onUnreadCount?: (count: number) => void
}
const LABELS: Record<string, string> = {
  chat_message_received: 'رسالة رعاية جديدة',
  session_booked: 'حُجزت جلسة',
  session_reminder: 'تذكير بجلسة',
  session_status_changed: 'تغيّرت حالة الجلسة',
  reschedule_requested: 'طُلبت إعادة جدولة الجلسة',
  reschedule_approved: 'اعتُمدت إعادة الجدولة',
  reschedule_rejected: 'رُفضت إعادة الجدولة',
  cancellation_requested: 'طُلب إلغاء الجلسة',
  cancellation_approved: 'اعتُمد إلغاء الجلسة',
  cancellation_rejected: 'رُفض إلغاء الجلسة',
  assessment_completed: 'اكتمل التقييم',
  red_flag_raised: 'رُفعت علامة رعاية',
  red_flag_priority_raised: 'رُفعت أولوية علامة الرعاية',
  red_flag_escalated: 'صُعّدت علامة الرعاية',
  payment_proof_pending: 'إثبات دفع معلّق',
  payment_review_overdue: 'مراجعة دفع متأخرة',
  payment_reviewed: 'رُوجع الدفع',
  therapist_approval: 'تحديث اعتماد المعالج',
  therapist_switch: 'تحديث إسناد المعالج',
  patient_transferred: 'نُقل العميل',
  document_requested: 'طُلب مستند',
  document_submitted: 'سُلّم مستند',
  document_reviewed: 'رُوجع المستند',
  session_recommendation: 'تتوفر توصية جلسة',
  support_reply: 'يتوفر رد من الدعم',
  parallel_layer_updated: 'حُدّثت خطة الرعاية',
  emergency_contact_requested: 'طُلب تواصل طارئ',
}
function notificationKind(item: StoredNotification) {
  return item.data && typeof item.data.kind === 'string' ? item.data.kind : ''
}
function destination(item: StoredNotification): string | null {
  const kind = notificationKind(item)
  if (kind === 'chat_message_received') {
    // conversation_id is NOT the counterpart route parameter.
    try {
      return typeof item.data.sender_id === 'string'
        ? `/chats?client=${apiId(item.data.sender_id)}`
        : null
    } catch {
      return null
    }
  }
  if (
    [
      'session_booked',
      'session_reminder',
      'session_status_changed',
      'reschedule_requested',
      'reschedule_approved',
      'reschedule_rejected',
      'cancellation_requested',
      'cancellation_approved',
      'cancellation_rejected',
      'session_recommendation',
    ].includes(kind)
  )
    return '/sessions'
  if (
    [
      'assessment_completed',
      'red_flag_raised',
      'red_flag_priority_raised',
      'red_flag_escalated',
      'therapist_switch',
      'patient_transferred',
      'parallel_layer_updated',
      'emergency_contact_requested',
    ].includes(kind)
  )
    return '/clients'
  if (
    kind === 'therapist_approval' ||
    ['document_requested', 'document_submitted', 'document_reviewed'].includes(kind)
  )
    return '/profile'
  if (kind === 'support_reply') return '/contact'
  // Staff payment review actions are deliberately not offered to a therapist.
  return null
}

// Drop-in replacement for Workspace's API notification body. The parent owns the
// panel shell/badge; this component never invents actions or renders stored notes.
export function LiveNotifications(props: Props) {
  return props.api ? <AuthenticatedNotifications {...props} api={props.api} /> : null
}
function AuthenticatedNotifications(props: Props & { api: ApiClient }) {
  const user = useApiUser(props.api)
  return user ? (
    <ActorNotifications key={props.api.getSessionKey()} {...props} />
  ) : (
    <p role="alert">انتهت جلستك. يرجى تسجيل الدخول مجدداً.</p>
  )
}
function ActorNotifications({ api, navigate, onUnreadCount }: Props & { api: ApiClient }) {
  const [page, setPage] = useState(1)
  const resource = useChatPolling<NotificationPage>(
    api,
    `/notifications?page=${page}&per_page=20`,
    30000,
  )
  const lifetime = useChatLifetime()
  const online = useChatConnectivity()
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (resource.data) onUnreadCount?.(resource.data.unread_count)
  }, [resource.data, onUnreadCount])
  async function read(id?: string) {
    if (lock.current || !resource.canRequest() || !resource.data) return
    lock.current = true
    setBusy(true)
    setError('')
    const controller = new AbortController()
    lifetime.current.controllers.add(controller)
    try {
      await api.mutate(
        id ? `/notifications/${apiId(id)}/read` : '/notifications/read-all',
        undefined,
        { signal: controller.signal },
      )
      if (!lifetime.current.alive || controller.signal.aborted) return
      // Read is not delete, and unread_count is not returned by these mutations.
      resource.reload()
    } catch (failure) {
      if (lifetime.current.alive && !controller.signal.aborted) {
        resource.defer(failure)
        setError(apiErrorMessage(failure))
      }
    } finally {
      lifetime.current.controllers.delete(controller)
      lock.current = false
      if (lifetime.current.alive && !controller.signal.aborted) setBusy(false)
    }
  }
  return (
    <div className="live-notifications">
      {resource.loading && <p role="status">جارٍ تحميل الإشعارات…</p>}
      {(error || resource.error) && (
        <p role="alert">
          {error || apiErrorMessage(resource.error)}{' '}
          <button disabled={!!resource.retryAt || !online} onClick={resource.reload}>
            Retry notifications
          </button>
        </p>
      )}
      {!!resource.retryAt && <p role="status">بانتظار إعادة المحاولة على الخادم.</p>}
      {resource.data && (
        <>
          <p className="notification-count">{resource.data.unread_count} unread notifications</p>
          <button
            className="soft-button notification-mark-all"
            disabled={busy || !online || !!resource.retryAt || !resource.data.unread_count}
            onClick={() => void read()}
          >
            Mark all read
          </button>
          {resource.data.data.length === 0 && !resource.error && <p>No notifications.</p>}
          {resource.data.data.map((item) => {
            const route = destination(item)
            const created = formatTimestamp(item.created_at, api.getUser()?.timezone || 'UTC')
            return (
              <article
                key={item.id}
                className={`notification-item ${item.read_at ? 'is-read' : 'is-unread'}`}
              >
                <span className="notification-kind-icon" aria-hidden="true">
                  <img
                    src={asset(
                      notificationKind(item) === 'chat_message_received'
                        ? 'part2-03-imgMessageCircleLinesAlt.svg'
                        : 'dashboard-imgNotification.svg',
                    )}
                    alt=""
                  />
                </span>
                <div className="notification-body">
                  <div className="notification-title">
                    <strong>
                      {Object.hasOwn(LABELS, notificationKind(item))
                        ? LABELS[notificationKind(item)]
                        : 'تحديث الحساب'}
                    </strong>
                    <time dateTime={item.created_at && created ? item.created_at : undefined}>
                      {created}
                    </time>
                  </div>
                  <p>افتح الصفحة المعنية لعرض المعلومات المصرّح بها حالياً.</p>
                  <span className="notification-read-state">{item.read_at ? 'Read' : 'Unread'}</span>
                  <div className="notification-actions">
                    <button
                      disabled={busy || !online || !!resource.retryAt || !!item.read_at}
                      onClick={() => void read(item.id)}
                    >
                      {item.read_at ? 'Read' : 'وضع كمقروء'}
                    </button>
                    {route && navigate && (
                      <button
                        onClick={() => {
                          navigate(route)
                          // pushState alone does not notify an already mounted chat page.
                          if (route.startsWith('/chats?'))
                            window.dispatchEvent(new PopStateEvent('popstate'))
                        }}
                      >
                        {notificationKind(item) === 'chat_message_received'
                          ? 'فتح المحادثة'
                          : 'فتح الصفحة المعنية'}
                      </button>
                    )}
                  </div>
                </div>
                {!item.read_at && <span className="notification-unread-dot" aria-hidden="true" />}
              </article>
            )
          })}
          <nav aria-label="صفحات الإشعارات">
            <button
              disabled={page <= 1 || resource.loading || busy || !!resource.retryAt}
              onClick={() => setPage(page - 1)}
            >
              Previous notifications
            </button>
            <span>
              Page {page} of {resource.data.pagination.last_page}
            </span>
            <button
              disabled={
                page >= resource.data.pagination.last_page ||
                resource.loading ||
                busy ||
                !!resource.retryAt
              }
              onClick={() => setPage(page + 1)}
            >
              Next notifications
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
