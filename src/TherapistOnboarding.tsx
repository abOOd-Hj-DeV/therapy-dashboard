import { useState, type FormEvent, type MouseEvent } from 'react'
import { ApiClient, apiId, type ApiError } from './api'
import { useApiResource } from './api-hooks'
import { approvalFileError, approvalFileTypes, approvalLabel, onboardingError } from './therapist-approval'
import { useTherapistOptions } from './therapist-options'
import { TherapistOptionFields } from './TherapistOptionFields'

type Document = {
  id: string
  doc_type: string
  status: string
  reason: string | null
  review_note: string | null
  accepts_upload: boolean
}

const sections = {
  '/profile/settings': 'إعدادات الملف الشخصي',
  '/profile/documents': 'المستندات المطلوبة',
}
const copy = {
  not_submitted: 'ارفع ترخيص مزاولة المهنة وأرسل طلبك للمراجعة. ستتمكن من استخدام لوحة التحكم بعد الموافقة.',
  pending: 'طلبك قيد المراجعة. ستتحدّث حالة الطلب تلقائيًا عند صدور القرار.',
  rejected: 'يمكنك رفع ترخيص جديد وإعادة إرسال طلبك للمراجعة.',
  suspended: 'تواصل مع الإدارة لمعرفة كيفية استعادة الوصول إلى لوحة التحكم.',
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
  api,
  path,
  approvalResponse,
  navigate,
  checkingApproval,
  approvalCheckFailed,
  checkApproval,
}: {
  api: ApiClient
  path: string
  approvalResponse: ApiError
  navigate: (path: string) => void
  checkingApproval: boolean
  approvalCheckFailed: boolean
  checkApproval: () => void
}) {
  const [submittedAfter, setSubmittedAfter] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ error?: string; success?: string }>({})
  const documents = useApiResource<{ data: Document[] }>(
    api,
    path === '/profile/documents' ? '/therapists/me/documents' : null,
  )
  const options = useTherapistOptions(api, path === '/profile/settings')
  const status = approvalResponse.meta.approval_status
  const current =
    submittedAfter === approvalResponse || status === undefined || status === 'approved'
      ? 'pending'
      : status
  const canSubmit = current === null || current === 'rejected'
  const showLicense = canSubmit && !Object.hasOwn(sections, path)

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
    const fileField = document ? 'file' : showLicense ? 'license' : null
    if (fileField) {
      const file = (form.elements.namedItem(fileField) as HTMLInputElement).files?.[0]
      const fileError = approvalFileError(file)
      if (fileError || !file) {
        setNotice({ error: fileError })
        return
      }
      data.set(fileField, file)
    }
    setBusy(true)
    try {
      if (document) {
        await api.mutate(`/therapists/me/documents/${apiId(document.id)}/upload`, data)
        form.reset()
        documents.reload()
        setNotice({ success: 'تم إرسال المستند للمراجعة.' })
      } else if (showLicense) {
        await api.mutate('/therapists/me/approval', data)
        form.reset()
        setSubmittedAfter(approvalResponse)
        setNotice({ success: 'تم إرسال طلبك للمراجعة.' })
        checkApproval()
      } else {
        const specialty = String(data.get('specialty'))
        const country = String(data.get('country'))
        const languages = data.getAll('languages').map(String)
        const bio = String(data.get('bio')).trim()
        const body = {
          ...(specialty && { specialty }),
          ...(country && { country }),
          ...(languages.length && { languages }),
          ...(bio && { bio }),
        }
        if (!Object.keys(body).length) {
          setNotice({ error: 'أدخل بيانًا واحدًا على الأقل لتحديث الملف الشخصي.' })
          return
        }
        await api.request('/therapists/me/settings', 'PUT', { body })
        setNotice({ success: 'تم حفظ إعدادات الملف الشخصي.' })
      }
    } catch (error) {
      setNotice({ error: onboardingError(error, !!fileField) })
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
    <main className="approval-page" lang="ar" dir="rtl">
      <h1>{current === 'rejected' ? 'لم تتم الموافقة على طلبك' : approvalLabel(current)}</h1>
      <p>الحالة: {approvalLabel(current)}</p>
      <p>{copy[current ?? 'not_submitted']}</p>
      {current === 'rejected' && approvalResponse.meta.approval_note && (
        <p>سبب الرفض: <bdi>{approvalResponse.meta.approval_note}</bdi></p>
      )}
      <nav aria-label="إعداد حساب المعالج">
        {canSubmit && (
          <a
            href="/profile/approval"
            aria-current={showLicense ? 'page' : undefined}
            onClick={(event) => link(event, '/profile/approval')}
          >
            {current === 'rejected' ? 'إعادة إرسال الطلب' : 'إرسال طلب الموافقة'}
          </a>
        )}
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
          <h2>إعدادات الملف الشخصي</h2>
          <p>أدخل فقط البيانات التي ترغب في تحديثها.</p>
          <fieldset disabled={busy}>
            <TherapistOptionFields options={options} />
            <label>
              النبذة التعريفية
              <textarea name="bio" maxLength={2000} />
            </label>
            <button className="primary-button" type="submit">
              حفظ إعدادات الملف الشخصي
            </button>
          </fieldset>
        </form>
      )}
      {showLicense && (
        <form className="auth-form" onSubmit={save}>
          <h2>{current === 'rejected' ? 'إعادة إرسال الطلب' : 'إرسال طلب الموافقة'}</h2>
          <p>الصيغ المقبولة: PDF أو JPG أو PNG. الحد الأقصى لحجم الملف ٥ ميغابايت.</p>
          <fieldset disabled={busy}>
            <label>
              ترخيص مزاولة المهنة
              <input name="license" type="file" accept={approvalFileTypes} required />
            </label>
            <button className="primary-button" type="submit">
              {current === 'rejected' ? 'إعادة الإرسال للمراجعة' : 'إرسال الطلب للمراجعة'}
            </button>
          </fieldset>
        </form>
      )}
      {path === '/profile/documents' && (
        <section>
          <h2>المستندات المطلوبة</h2>
          {documents.loading && <p role="status">جارٍ تحميل طلبات المستندات…</p>}
          {documents.error && <p role="alert">{onboardingError(documents.error)}</p>}
          {documents.data?.data.length === 0 && !documents.error && !documents.loading && (
            <p>لا توجد مستندات مطلوبة.</p>
          )}
          {documents.data?.data.map((document) => (
            <article key={document.id}>
              <h3>{documentTypes[document.doc_type] ?? 'مستند'}</h3>
              <p>الحالة: {documentStatuses[document.status] ?? 'غير معروفة'}</p>
              {document.reason && <p>سبب الطلب: <bdi>{document.reason}</bdi></p>}
              {document.review_note && <p>ملاحظة المراجعة: <bdi>{document.review_note}</bdi></p>}
              {document.accepts_upload && (
                <form onSubmit={(event) => void save(event, document)}>
                  <label>
                    {documentTypes[document.doc_type] ?? 'المستند'}
                    <input
                      name="file"
                      type="file"
                      accept={approvalFileTypes}
                      required
                      disabled={busy}
                    />
                  </label>
                  <button type="submit" disabled={busy}>
                    رفع المستند
                  </button>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
      {notice.error && <p role="alert">{notice.error}</p>}
      {notice.success && <p role="status">{notice.success}</p>}
      {approvalCheckFailed && <p role="alert">تعذّر التحقق من حالة الموافقة. حاول مرة أخرى.</p>}
      <div className="approval-actions">
        <button
          type="button"
          className="soft-button"
          disabled={busy || checkingApproval}
          onClick={checkApproval}
        >
          التحقق من حالة الموافقة
        </button>
        <button type="button" className="soft-button" onClick={logout}>
          تسجيل الخروج
        </button>
      </div>
    </main>
  )
}
