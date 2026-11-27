import { useState, type FormEvent, type MouseEvent } from 'react'
import { apiId, type ApiClient } from './api'
import { useApiResource } from './api-hooks'
import { useMutation } from './api-mutation'
import { documentFileError, documentFileTypes, documentError, approvalLabel } from './therapist-approval'
import { useTherapistOptions } from './therapist-options'
import { TherapistProfileForm, TherapistProfileSummary } from './TherapistProfileForm'
import type { ProfileRevision, TherapistProfileResponse, TherapistProfileReview } from './therapist-profile-review'

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

export function TherapistOnboarding({
  api, path, review, navigate, logout, checkingApproval, approvalCheckFailed, checkApproval, saved,
}: {
  api: ApiClient
  path: string
  review: TherapistProfileReview
  navigate: (path: string) => void
  logout: () => Promise<void>
  checkingApproval: boolean
  approvalCheckFailed: boolean
  checkApproval: () => void
  saved: (response: TherapistProfileResponse) => void
}) {
  const [editing, setEditing] = useState(false)
  const [latestInitial, setLatestInitial] = useState<ProfileRevision | null>(null)
  const showDocuments = path === '/profile/documents'
  const status = review.approval_status
  const pending = review.pending_revision
  const last = review.last_review
  if (pending?.kind === 'initial' && latestInitial?.id !== pending.id) setLatestInitial(pending)
  const previous = status === 'rejected' && latestInitial?.id === last?.revision_id ? latestInitial : null
  const initial = pending?.data ?? previous?.data ?? {
    ...review.published,
    email: review.published.email ?? review.account.email,
  }
  const shownForm = status === null || status === 'rejected' || (status === 'pending' && editing && !!pending)
  const options = useTherapistOptions(api, !showDocuments || shownForm)

  function link(event: MouseEvent<HTMLAnchorElement>, next: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(next)
  }

  return (
    <main className="approval-page" lang="ar" dir="rtl">
      <h1>{showDocuments ? 'المستندات المطلوبة' : status === null ? 'أكمل ملفك المهني' : approvalLabel(status)}</h1>
      <nav aria-label="إعداد حساب المعالج">
        {status === 'approved' ? (
          <a href="/dashboard" onClick={(event) => link(event, '/dashboard')}>لوحة التحكم</a>
        ) : (
          <a href="/profile/approval" aria-current={!showDocuments ? 'page' : undefined} onClick={(event) => link(event, '/profile/approval')}>
            طلب مراجعة الملف المهني
          </a>
        )}
        <a href="/profile/documents" aria-current={showDocuments ? 'page' : undefined} onClick={(event) => link(event, '/profile/documents')}>
          المستندات المطلوبة
        </a>
      </nav>
      {showDocuments && <RequestedDocuments api={api} />}
      <div hidden={showDocuments}>
        {status === null && <p>أكمل بيانات ملفك المهني ثم أرسله للمراجعة.</p>}
        {status === 'pending' && <p>طلبك قيد المراجعة. ستتحدّث الحالة تلقائيًا عند صدور القرار.</p>}
        {status === 'rejected' && (
          <>
            {last?.status === 'rejected' && last.note && <p>سبب الرفض: <bdi>{last.note}</bdi></p>}
            <p>عدّل بيانات ملفك المهني وأعد إرساله للمراجعة.</p>
          </>
        )}
        {status === 'pending' && !editing && pending && (
          <section aria-labelledby="submitted-profile">
            <h2 id="submitted-profile">البيانات المرسلة للمراجعة</h2>
            <TherapistProfileSummary profile={pending.data} phone={review.account.whatsapp_number} options={options} />
            <button type="button" className="soft-button" onClick={() => setEditing(true)}>تعديل الطلب</button>
          </section>
        )}
        {shownForm && (
          <TherapistProfileForm
            key={pending?.id ?? previous?.id ?? status ?? 'initial'}
            api={api}
            initial={initial}
            phone={review.account.whatsapp_number}
            options={options}
            submitLabel={status === null ? 'إرسال الملف للمراجعة' : 'إعادة إرسال الطلب للمراجعة'}
            saved={(response) => {
              setEditing(false)
              saved(response)
            }}
            close={status === 'pending' ? () => setEditing(false) : undefined}
          />
        )}
      </div>
      {approvalCheckFailed && <p role="alert">تعذّر تحديث حالة المراجعة. حاول مرة أخرى.</p>}
      <div className="approval-actions">
        <button type="button" className="soft-button" disabled={checkingApproval} onClick={checkApproval}>
          التحقق من حالة المراجعة
        </button>
        <button type="button" className="soft-button" onClick={logout}>تسجيل الخروج</button>
      </div>
    </main>
  )
}

function RequestedDocuments({ api }: { api: ApiClient }) {
  const documents = useApiResource<{ data: Document[] }>(api, '/therapists/me/documents')
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
      {documents.error && <p role="alert">{documentError(documents.error)}</p>}
      {documents.data?.data.length === 0 && !documents.error && !documents.loading && (
        <p>لا توجد مستندات مطلوبة.</p>
      )}
      {documents.data?.data.map((document) => (
        <article key={document.id}>
          <h2>{documentTypes[document.doc_type] ?? 'مستند'}</h2>
          <p>الحالة: {documentStatuses[document.status] ?? 'غير معروفة'}</p>
          {document.reason && <p>سبب الطلب: <bdi>{document.reason}</bdi></p>}
          {document.review_note && <p>ملاحظة المراجعة: <bdi>{document.review_note}</bdi></p>}
          {document.accepts_upload && (
            <form onSubmit={(event) => submit(event, document.id)}>
              <label>
                {documentTypes[document.doc_type] ?? 'المستند'}
                <input name="file" type="file" accept={documentFileTypes} required disabled={mutation.pending} />
              </label>
              <button type="submit" disabled={mutation.pending}>رفع المستند</button>
            </form>
          )}
        </article>
      ))}
      {notice.error && <p role="alert">{notice.error}</p>}
      {notice.success && <p role="status">{notice.success}</p>}
    </section>
  )
}
