import { useState, type FormEvent, type MouseEvent } from 'react'
import { apiId, type ApiClient } from './api'
import { useApiResource } from './api-hooks'
import { useMutation } from './api-mutation'
import { AuthCardShell } from './AuthCardShell'
import { documentFileError, documentFileTypes, documentError } from './therapist-approval'
import { useTherapistOptions } from './therapist-options'
import { TherapistProfileForm, TherapistProfileSummary } from './TherapistProfileForm'
import type { TherapistLifecycle, TherapistProfileResponse, TherapistProfileReview } from './therapist-profile-review'

type Document = {
  id: string
  doc_type: string
  status: string
  reason: string | null
  review_note: string | null
  accepts_upload: boolean
}
const documentTypes: Record<string, string> = {
  license: 'ترخيص مزاولة المهنة',
  identity: 'إثبات الهوية',
  certificate: 'شهادة',
  payment_proof: 'إثبات الدفع',
  support_file: 'مستند داعم',
  other: 'مستند آخر',
}
const documentStatuses: Record<string, string> = {
  requested: 'مطلوب',
  submitted: 'قيد المراجعة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
}
const lifecycleCopy = {
  invited: ['فعّل حسابك', 'أدخل رمز الدعوة الذي وصلك عبر واتساب لتفعيل الحساب أولًا.'],
  awaiting_profile: ['أكمل ملفك المهني', 'أكمل بيانات ملفك المهني ثم أرسله للمراجعة.'],
  pending_review: ['بانتظار الموافقة', 'طلبك قيد المراجعة. ستتحدّث الحالة تلقائيًا عند صدور القرار.'],
  needs_changes: ['الملف المهني يحتاج إلى تعديل', 'عدّل بيانات ملفك المهني وأعد إرساله للمراجعة.'],
  approved: ['تم اعتماد ملفك المهني', 'يمكنك إرسال المسودة التي تعمل عليها كتعديلات للمراجعة، أو إلغاؤها والانتقال إلى لوحة التحكم.'],
  update_pending: ['تعديلات بانتظار المراجعة', 'يمكنك إرسال المسودة التي تعمل عليها للمراجعة، أو إلغاؤها والانتقال إلى لوحة التحكم.'],
  suspended: ['الحساب موقوف', 'لا يمكنك استخدام لوحة المعالج حاليًا. تواصل مع الإدارة للاستفسار عن حالة الحساب.'],
} as const

export function TherapistOnboarding({
  api, path, review, lifecycle, finishingDraft, onDraftChange, navigate, logout, activate, approvalCheckFailed, checkApproval, saved,
}: {
  api: ApiClient
  path: string
  review: TherapistProfileReview
  lifecycle: TherapistLifecycle
  finishingDraft: boolean
  onDraftChange: (dirty: boolean) => void
  navigate: (path: string) => void
  logout: () => Promise<void>
  activate: () => Promise<void>
  approvalCheckFailed: boolean
  checkApproval: () => void
  saved: (response: TherapistProfileResponse) => void
}) {
  const [editing, setEditing] = useState(false)
  const canSeeDocuments = lifecycle !== 'invited' && lifecycle !== 'suspended'
  const showDocuments = canSeeDocuments && path === '/profile/documents'
  const documents = useRequestedDocuments(api, canSeeDocuments)
  const pending = review.pending_revision
  const last = review.last_review
  const rejectedReview = lifecycle === 'needs_changes' && last?.status === 'rejected' ? last : null
  const initial = (lifecycle === 'pending_review' ? pending?.data : rejectedReview?.data) ?? {
    ...review.published,
    email: review.published.email ?? review.account.email,
  }
  const shownForm = lifecycle === 'awaiting_profile' || lifecycle === 'needs_changes' ||
    (lifecycle === 'pending_review' && editing && !!pending) || finishingDraft
  const options = useTherapistOptions(api, shownForm || (!showDocuments && lifecycle === 'pending_review'))
  const [title, description] = lifecycleCopy[lifecycle]

  function closeEditor() {
    setEditing(false)
    onDraftChange(false)
  }

  function link(event: MouseEvent<HTMLAnchorElement>, next: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(next)
  }

  return (
    <AuthCardShell
      arabic
      focusHeading
      title={approvalCheckFailed ? 'الملف المهني' : showDocuments ? 'المستندات المطلوبة' : title}
      description={approvalCheckFailed ? undefined : showDocuments ? 'راجع المستندات التي طلبتها منك الإدارة.' : description}
      footer={<p className="auth-switch"><button type="button" onClick={logout}>تسجيل الخروج</button></p>}
    >
      <div inert={approvalCheckFailed} hidden={approvalCheckFailed}>
      {showDocuments && (
        <>
          <RequestedDocuments api={api} documents={documents} />
          <p className="auth-switch">
            {!finishingDraft && (lifecycle === 'approved' || lifecycle === 'update_pending') ? (
              <a href="/profile/settings" onClick={(event) => link(event, '/profile/settings')}>العودة إلى الإعدادات</a>
            ) : (
              <a href="/profile/approval" onClick={(event) => link(event, '/profile/approval')}>العودة إلى الملف المهني</a>
            )}
          </p>
        </>
      )}
      <div hidden={showDocuments || lifecycle === 'suspended' || (!shownForm && !['invited', 'pending_review'].includes(lifecycle))}>
        {lifecycle === 'invited' && (
          <button type="button" className="primary-button" onClick={activate}>الانتقال إلى تفعيل الحساب</button>
        )}
        {rejectedReview?.note && <p className="live-auth-feedback">سبب الرفض: <bdi>{rejectedReview.note}</bdi></p>}
        {lifecycle === 'pending_review' && !pending && (
          <p className="live-auth-help">البيانات المرسلة غير متوفرة الآن. سنعرضها هنا عند توفرها.</p>
        )}
        {lifecycle === 'pending_review' && !editing && pending && (
          <div className="live-auth-request">
            <strong>البيانات المرسلة للمراجعة</strong>
            <TherapistProfileSummary profile={pending.data} phone={review.account.whatsapp_number} options={options} />
            <button type="button" className="remaining-primary" onClick={() => setEditing(true)}>تعديل الطلب</button>
          </div>
        )}
        {shownForm && (
          <TherapistProfileForm
            api={api}
            initial={initial}
            phone={review.account.whatsapp_number}
            options={options}
            submitLabel={finishingDraft ? 'إرسال التعديلات للمراجعة' : lifecycle === 'awaiting_profile' ? 'إرسال الملف للمراجعة' : 'إعادة إرسال الطلب للمراجعة'}
            onChange={() => onDraftChange(true)}
            saved={(response) => {
              closeEditor()
              saved(response)
            }}
            close={lifecycle === 'pending_review' || finishingDraft ? closeEditor : undefined}
          />
        )}
      </div>
      {canSeeDocuments && !showDocuments && !!documents.data?.data?.length && (
        <p className="auth-switch">
          <a href="/profile/documents" onClick={(event) => link(event, '/profile/documents')}>المستندات المطلوبة</a>
        </p>
      )}
      </div>
      {approvalCheckFailed && (
        <p className="live-auth-feedback" role="alert">
          تعذّر تحديث حالة المراجعة. <button type="button" className="remaining-cancel" onClick={checkApproval}>إعادة المحاولة</button>
        </p>
      )}
    </AuthCardShell>
  )
}

function useRequestedDocuments(api: ApiClient, enabled: boolean) {
  return useApiResource<{ data: Document[] }>(api, enabled ? '/therapists/me/documents' : null)
}

function RequestedDocuments({ api, documents }: { api: ApiClient; documents: ReturnType<typeof useRequestedDocuments> }) {
  const mutation = useMutation(api)
  const [notice, setNotice] = useState<{ error?: string; success?: string }>({})

  function submit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    if (mutation.pending) return
    const form = event.currentTarget
    const file = (form.elements.namedItem('file') as HTMLInputElement).files?.[0]
    const error = documentFileError(file)
    if (error || !file) {
      setNotice({ error })
      return
    }
    const data = new FormData()
    data.set('file', file)
    setNotice({})
    void mutation.run(
      (signal) => api.mutate(`/therapists/me/documents/${apiId(id)}/upload`, data, { signal }),
      () => {
        form.reset()
        documents.reload()
        setNotice({ success: 'تم إرسال المستند للمراجعة.' })
      },
      (cause) => setNotice({ error: documentError(cause, true) }),
    )
  }

  return (
    <section>
      {documents.loading && <p role="status">جارٍ تحميل طلبات المستندات…</p>}
      {documents.error && <p role="alert">{documentError(documents.error)} <button type="button" className="remaining-cancel" onClick={documents.reload}>إعادة المحاولة</button></p>}
      {documents.data?.data?.length === 0 && !documents.error && !documents.loading && (
        <p>لا توجد مستندات مطلوبة.</p>
      )}
      {documents.data?.data?.map((document) => (
        <article key={document.id}>
          <h2>{documentTypes[document.doc_type] ?? 'مستند'}</h2>
          <p>الحالة: {documentStatuses[document.status] ?? 'غير معروفة'}</p>
          {document.reason && <p>سبب الطلب: <bdi>{document.reason}</bdi></p>}
          {document.review_note && <p>ملاحظة المراجعة: <bdi>{document.review_note}</bdi></p>}
          {document.accepts_upload && (
            <form className="auth-form" onSubmit={(event) => submit(event, document.id)}>
              <label>
                {documentTypes[document.doc_type] ?? 'المستند'}
                <input name="file" type="file" accept={documentFileTypes} required disabled={mutation.pending} />
              </label>
              <button type="submit" className="primary-button" disabled={mutation.pending}>رفع المستند</button>
            </form>
          )}
        </article>
      ))}
      {notice.error && <p role="alert">{notice.error}</p>}
      {notice.success && <p role="status">{notice.success}</p>}
    </section>
  )
}
