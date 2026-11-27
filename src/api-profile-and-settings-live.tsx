import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { ApiClient, ApiError, apiErrorMessage, apiId, type ApiUser } from './api'
import { useApiResource, useApiUser } from './api-hooks'
import { useMutation } from './api-mutation'
import { formatCalendarDate } from './display-date'
import { Workspace } from './Workspace'
import { passwordPolicyMessage, validNewPassword } from './auth-policy'
import { Modal } from './ui'
import { FaqSummary, RemainingIcon, SettingRow, type RemainingIconName } from './RemainingUI'
import { approvalLabel } from './therapist-approval'
import { optionName, useTherapistOptions } from './therapist-options'
import { TherapistProfileForm } from './TherapistProfileForm'
import { profileReviewError, therapistLifecycle, therapistProfilePath, therapistSubmissionPath, type TherapistProfileResponse } from './therapist-profile-review'

type Page = 'profile' | 'settings' | 'help'
type Props = { page: Page; navigate: (path: string) => void; api?: ApiClient }
type Therapist = {
  availability: Partial<Record<Day, string[]>> | [] | null
}
type Dashboard = {
  therapist: Therapist
  clients_count: number
  stats: { pending: number; confirmed: number; completed: number; today: number }
  timezone: string
}
type Period = { id: string; start_date: string; end_date: string; reason: string | null }
type PeriodBody = { start_date: string; end_date: string | null; reason: string | null }
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type Day = (typeof days)[number]
const titles = {
  edit: 'تعديل الملف الشخصي',
  withdrawProfile: 'سحب تعديلات الملف المهني',
  hours: 'إدارة ساعات العمل',
  holidays: 'الإجازات والاستراحات',
  password: 'تغيير كلمة المرور',
  preferences: 'إعدادات الإشعارات',
  logout: 'تسجيل الخروج',
  faq: 'الأسئلة الشائعة',
  contact: 'التواصل مع الدعم',
}
type Dialog = keyof typeof titles | ''
const fieldLabels: Record<string, string> = {
  availability: 'ساعات العمل',
  current_password: 'كلمة المرور الحالية',
  password: 'كلمة المرور الجديدة',
  password_confirmation: 'تأكيد كلمة المرور',
  start_date: 'تاريخ البدء',
  end_date: 'تاريخ الانتهاء',
  reason: 'Reason',
  therapist: 'ملف المعالج',
}

function Failure({ error }: { error: unknown }) {
  if (!error) return null
  const labels =
    error instanceof ApiError
      ? [
          ...new Set(
            Object.keys(error.fields)
              .map((key) => fieldLabels[key.split('.')[0]])
              .filter(Boolean),
          ),
        ]
      : []
  return (
    <div className="remaining-error" role="alert">
      <p>
        {apiErrorMessage(error)}
        {error instanceof ApiError && error.retryAfter > 0
          ? ` أعد المحاولة بعد ${error.retryAfter} ثانية.`
          : ''}
      </p>
      {labels.map((label) => (
        <p key={label}>{label}: Please check this field.</p>
      ))}
    </div>
  )
}

function Actions({
  pending,
  close,
  label = 'حفظ التغييرات',
}: {
  pending: boolean
  close: () => void
  label?: string
}) {
  return (
    <footer className="remaining-form-actions">
      <button type="button" className="remaining-cancel" onClick={close}>
        Cancel
      </button>
      <button type="submit" className="remaining-primary" disabled={pending}>
        {pending ? 'Saving…' : label}
      </button>
    </footer>
  )
}

export function LiveProfile({ api, ...props }: Props) {
  return api ? (
    <ProfileBoundary api={api} {...props} />
  ) : (
    <p role="alert">يلزم جلسة API مباشرة.</p>
  )
}
function ProfileBoundary({ api, ...props }: Omit<Props, 'api'> & { api: ApiClient }) {
  const user = useApiUser(api)
  return user ? (
    <ProfileActor key={api.getSessionKey()} api={api} user={user} {...props} />
  ) : (
    <p role="status">تم تسجيل خروجك. محُويت بيانات الملف الخاصة.</p>
  )
}

function ProfileActor({
  api,
  user,
  page,
  navigate,
}: Omit<Props, 'api'> & { api: ApiClient; user: ApiUser }) {
  const identity = useApiResource<{ user: ApiUser }>(api, '/auth/user')
  const validIdentity =
    identity.data?.user.id === user.id &&
    identity.data.user.role === 'therapist' &&
    identity.data.user.is_active &&
    !!identity.data.user.phone_verified_at
  const dashboard = useApiResource<Dashboard>(
    api,
    validIdentity ? '/therapists/me/dashboard' : null,
  )
  const profile = useApiResource<TherapistProfileResponse>(api, validIdentity ? therapistProfilePath : null)
  const review = profile.data?.data
  const published = review?.published
  const pending = review?.pending_revision
  const last = review?.last_review
  const pendingUpdate = !!review && therapistLifecycle(review) === 'update_pending'
  const rejectedUpdate = last?.kind === 'update' && last.status === 'rejected' ? last : null
  const options = useTherapistOptions(api, !!published)
  const approval = review && approvalLabel(review.approval_status)
  const timezone = dashboard.data?.timezone || identity.data?.user.timezone || user.timezone
  const [dialog, setDialog] = useState<Dialog>(() => {
    const requested = new URLSearchParams(window.location.search).get('state')
    return requested && Object.hasOwn(titles, requested) ? (requested as Dialog) : ''
  })
  const reviewDialog = dialog === 'edit' || dialog === 'withdrawProfile'
  const [notice, setNotice] = useState('')
  const [withdrawalRevisionId, setWithdrawalRevisionId] = useState<string | null>(null)
  const [withdrawalConflict, setWithdrawalConflict] = useState(false)
  // Keys and uncertain submissions are kept only for this actor, across modal closes.
  const periodKeys = useRef(new Map<string, string>())
  const uncertainPeriod = useRef<PeriodBody | null>(null)
  const close = () => {
    setWithdrawalRevisionId(null)
    setDialog('')
  }
  const name = published?.full_name || identity.data?.user.name || user.name
  const settings = page === 'settings'
  return (
    <Workspace title={settings ? 'إعدادات الملف المهني' : 'Profile'} active="Profile" navigate={navigate} api={api}>
      <div className={`profile-layout profile-${page}`} lang={settings ? 'ar' : undefined} dir={settings ? 'rtl' : undefined}>
        <aside className="profile-summary" aria-label={settings ? 'نبذة عن الملف المهني' : 'نظرة الملف'}>
          <div className="profile-identity">
            <span className="profile-avatar profile-avatar-initials" aria-label="Profile initials">
              {name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </span>
            <div>
              <h2>{name}</h2>
              <p lang="ar" dir="rtl">
                {approval ? `حالة الموافقة: ${approval}` : 'حساب المعالج'}
              </p>
            </div>
          </div>
          <button
            className="remaining-primary profile-edit"
            disabled={!published}
            onClick={() => setDialog('edit')}
          >
            {titles.edit}
          </button>
          <div className="profile-description">
            <h3>{settings ? 'التخصص' : 'Description'}</h3>
            <p>{published?.specialty ? optionName(options.specialties, published.specialty) :
              settings ? 'بيانات الملف المهني غير متاحة الآن.' : 'الملف المهني غير متاح.'}</p>
          </div>
          {dashboard.data && (
            <div className="profile-counts">
              <div>
                <strong>{dashboard.data.clients_count}</strong>
                <span>{settings ? 'العملاء' : 'Clients'}</span>
              </div>
              <div>
                <strong>{dashboard.data.stats.completed}</strong>
                <span>{settings ? 'الجلسات المكتملة' : 'الجلسات المكتملة'}</span>
              </div>
            </div>
          )}
        </aside>
        <section className="profile-panel" aria-label={settings ? 'تفاصيل الملف المهني' : 'تفاصيل الملف'}>
          <nav className="profile-tabs" aria-label={settings ? 'أقسام الملف المهني' : 'أقسام الملف'}>
            {(['profile', 'settings', 'help'] as const).map((tab) => (
              <button
                key={tab}
                aria-current={page === tab ? 'page' : undefined}
                className={page === tab ? 'selected' : ''}
                onClick={() => navigate(tab === 'profile' ? '/profile' : `/profile/${tab}`)}
              >
                <RemainingIcon name={`${tab}${page === tab ? 'Active' : 'Idle'}`} />
                {settings
                  ? { profile: 'الملف المهني', settings: 'الإعدادات', help: 'المساعدة' }[tab]
                  : { profile: 'Profile', settings: 'Settings', help: 'Help' }[tab]}
              </button>
            ))}
          </nav>
          {(identity.loading || dashboard.loading || profile.loading) && <p role="status">{settings ? 'جارٍ تحميل الملف المهني…' : 'جارٍ تحميل الملف…'}</p>}
          <Failure error={identity.error || dashboard.error} />
          {(identity.error || dashboard.error || profile.error) && (
            <>
              {profile.error && <p role="alert" lang="ar" dir="rtl">{profileReviewError(profile.error)}</p>}
              <button
                className="remaining-cancel"
                onClick={() => {
                  identity.reload()
                  dashboard.reload()
                  profile.reload()
                }}
              >
                {settings ? 'إعادة محاولة تحميل الملف المهني' : 'إعادة تحميل الملف'}
              </button>
            </>
          )}
          {(pendingUpdate || rejectedUpdate) && (
            <div className="profile-review-banner" lang="ar" dir="rtl">
              {pendingUpdate && (
                <>
                  <p role="status">تعديلات ملفك المهني بانتظار المراجعة. يظل الملف المنشور دون تغيير حتى الموافقة.</p>
                  {pending?.kind === 'update' && (
                    <button type="button" className="remaining-cancel" onClick={() => {
                      setWithdrawalRevisionId(pending.id)
                      setWithdrawalConflict(false)
                      setNotice('')
                      setDialog('withdrawProfile')
                    }}>
                      سحب التعديلات
                    </button>
                  )}
                </>
              )}
              {rejectedUpdate && (
                <p>لم تُعتمد آخر تعديلات ملفك المهني.{rejectedUpdate.note && <> سبب الرفض: <bdi>{rejectedUpdate.note}</bdi></>}</p>
              )}
            </div>
          )}
          {identity.data && !validIdentity && (
            <p role="alert">
              An active, phone-verified therapist account is required. Professional profile access
              is unavailable.
            </p>
          )}
          {page === 'profile' && (
            <div className="profile-information">
              <section className="profile-about">
                <h3>نبذة عني</h3>
                <p>
                  {published
                    ? published.bio || 'لا توجد نبذة.'
                    : 'الملف المهني غير متاح.'}
                </p>
              </section>
              <div className="profile-information-grid">
                <section>
                  <h3>المعلومات المهنية</h3>
                  <div className="profile-info-rows">
                    <Info icon="briefcase" label="المسمى الوظيفي" value={published?.job_title} arabic />
                    <Info icon="briefcase" label="التخصص" value={published?.specialty && optionName(options.specialties, published.specialty)} arabic />
                    <Info icon="location" label="المدينة" value={published?.city} arabic />
                    <Info icon="location" label="البلد" value={published?.country && optionName(options.countries, published.country)} arabic />
                    <Info
                      icon="user"
                      label="اللغات"
                      value={published?.languages?.map((code) => optionName(options.languages, code)).join('، ')}
                      arabic
                    />
                    <Info
                      icon="award"
                      label="سنوات الخبرة"
                      value={published?.years_of_experience == null ? undefined : String(published.years_of_experience)}
                      arabic
                    />
                    <Info
                      icon="user"
                      label="حالة الموافقة"
                      value={approval}
                      arabic
                    />
                  </div>
                </section>
                <section>
                  <h3>معلومات الحساب</h3>
                  <div className="profile-info-rows">
                    <Info
                      icon="user"
                      label="اسم الحساب"
                      value={identity.data?.user.name || user.name}
                    />
                    <Info icon="mail" label="البريد الإلكتروني" value={published?.email} arabic />
                    <Info
                      icon="phone"
                      label="رقم الجوال"
                      value={review?.account.whatsapp_number ?? user.whatsapp_number}
                      arabic
                    />
                    <Info icon="clock" label="المنطقة الزمنية للجدولة" value={timezone} />
                  </div>
                </section>
              </div>
            </div>
          )}
          {settings && (
            <div className="profile-settings-grid">
              <section className="profile-availability">
                <h3>التوفّر والمواعيد</h3>
                <SettingRow
                  icon="clock"
                  title="إدارة أوقات العمل"
                  detail={timezone ? `أوقات العمل الأسبوعية (${timezone})` : 'أوقات العمل الأسبوعية'}
                  onClick={() => setDialog('hours')}
                />
                <SettingRow
                  icon="briefcase"
                  title="الإجازات والاستراحات"
                  detail="أيام لا تستقبل فيها المواعيد"
                  onClick={() => setDialog('holidays')}
                />
                <button className="remaining-danger" onClick={() => setDialog('logout')}>
                  تسجيل الخروج
                </button>
              </section>
              <section className="profile-account">
                <h3>إعدادات الحساب</h3>
                <SettingRow icon="user" title={titles.edit} onClick={() => setDialog('edit')} />
                <SettingRow icon="briefcase" title="المستندات المطلوبة" onClick={() => navigate('/profile/documents')} />
                <SettingRow
                  icon="lock"
                  title="تغيير كلمة المرور"
                  onClick={() => setDialog('password')}
                />
                <SettingRow
                  icon="bell"
                  title="إعدادات الإشعارات"
                  detail="تفضيلات الإشعارات غير متاحة حاليًا"
                  onClick={() => setDialog('preferences')}
                />
              </section>
            </div>
          )}
          {page === 'help' && (
            <div className="profile-help-grid">
              <section className="help-live">
                <div>
                  <h3>توفر الدعم</h3>
                  <p>
                    Therapist support requests, live chat and callbacks are not supported by the
                    current API. Contact your platform management through your established support
                    channel.
                  </p>
                  <button className="remaining-cancel" disabled>
                    Request a callback (unavailable)
                  </button>
                </div>
              </section>
              <section className="help-links">
                <h3>Support &amp; Help</h3>
                <SettingRow
                  icon="faq"
                  title="FAQs"
                  detail="إجابات منشورة من المنصة"
                  onClick={() => setDialog('faq')}
                />
                <SettingRow
                  icon="mail"
                  title="Contact support"
                  detail="إرسال طلب المعالج غير متاح"
                  onClick={() => setDialog('contact')}
                />
              </section>
            </div>
          )}
        </section>
      </div>
      {withdrawalConflict && (
        <p lang="ar" dir="rtl" className="remaining-error" role="alert">
          تعذّر سحب التعديلات لأن الطلب لم يعد متاحًا. تحقّق من حالة طلبك بعد تحديث الملف المهني.
        </p>
      )}
      {notice && (
        <p className="remaining-notice" role="status">
          {notice}
          <button aria-label="إغلاق التنبيه" onClick={() => setNotice('')}>
            ×
          </button>
        </p>
      )}
      {dialog && (
        <Modal
          title={titles[dialog]}
          className={`remaining-modal ${dialog}-modal`}
          closeIcon={<RemainingIcon name="close" />}
          lang={reviewDialog ? 'ar' : undefined}
          dir={reviewDialog ? 'rtl' : undefined}
          closeLabel={reviewDialog ? dialog === 'edit' ? 'إغلاق نافذة التعديل' : 'إغلاق نافذة سحب التعديلات' : undefined}
          onClose={close}
        >
          {dialog === 'edit' &&
            (published && review ? (
              <TherapistProfileForm
                api={api}
                initial={(pending?.kind === 'update' ? pending.data : rejectedUpdate?.data) ?? published}
                phone={review.account.whatsapp_number}
                options={options}
                close={close}
                submitLabel="إرسال التعديلات للمراجعة"
                saved={(response) => {
                  profile.replace(response)
                  close()
                }}
              />
            ) : (
              <>
                <p role="alert">بيانات الملف المهني غير متاحة الآن.</p>
                <button className="remaining-cancel" onClick={close}>إغلاق</button>
              </>
            ))}
          {dialog === 'withdrawProfile' && (
            withdrawalRevisionId ? (
              <WithdrawProfileUpdate
                api={api}
                revisionId={withdrawalRevisionId}
                close={close}
                saved={(response) => {
                  profile.replace(response)
                  close()
                  setNotice('تم سحب التعديلات. لم يتغيّر الملف المنشور.')
                }}
                conflicted={() => {
                  close()
                  setWithdrawalConflict(true)
                  profile.reload()
                }}
              />
            ) : (
              <>
                <p role="status">{published
                  ? 'لم تعد هناك تعديلات بانتظار المراجعة.'
                  : 'بيانات الملف المهني غير متاحة الآن.'}</p>
                <button type="button" className="remaining-cancel" onClick={close}>إغلاق</button>
              </>
            )
          )}
          {dialog === 'hours' &&
            (dashboard.data?.therapist && timezone ? (
              <WorkingHours
                api={api}
                therapist={dashboard.data.therapist}
                timezone={timezone}
                close={close}
                saved={(value) => {
                  if (dashboard.data) dashboard.replace({ ...dashboard.data, therapist: value })
                  close()
                  setNotice('حُدّثت ساعات العمل على الخادم. المواعيد الحالية لم تُلغَ.')
                }}
              />
            ) : (
              <Unavailable close={close} />
            ))}
          {dialog === 'holidays' && (
            <BlockedPeriods
              api={api}
              timezone={timezone}
              close={close}
              keys={periodKeys.current}
              uncertain={uncertainPeriod}
            />
          )}
          {dialog === 'password' && (
            <ChangePassword
              api={api}
              close={close}
              saved={() => {
                close()
                setNotice(
                  'غُيّرت كلمة المرور. سُجّل خروج الأجهزة الأخرى، بينما تبقى جلستك الحالية نشطة.',
                )
              }}
            />
          )}
          {dialog === 'logout' && <Logout api={api} navigate={navigate} close={close} />}
          {dialog === 'preferences' && (
            <>
              <p>
                Notification preferences cannot be read or saved by the current API. Inbox read
                state is separate from notification delivery preferences.
              </p>
              <fieldset disabled className="preferences-list">
                {[
                  'رسائل جديدة من العملاء',
                  'تحديثات تقدّم العملاء',
                  'إشعارات الدفع والسحب',
                  'أخبار المنصة والعروض',
                  'تذكيرات الجلسات',
                ].map((label) => (
                  <label key={label}>
                    {label}
                    <input type="checkbox" role="switch" />
                  </label>
                ))}
              </fieldset>
              <button className="remaining-primary" disabled>
                Save Preferences (unavailable)
              </button>
            </>
          )}
          {dialog === 'contact' && (
            <>
              <p>
                Therapist support submission is unavailable. Patient requester routes and staff
                support-management routes are not therapist capabilities. Contact platform
                management through your established channel; no ticket, email or call has been sent.
              </p>
              <fieldset disabled className="live-contact-fields">
                <Field label="Subject">
                  <input placeholder="الموضوع (غير متاح)" />
                </Field>
                <Field label="Message">
                  <textarea placeholder="الرسالة (غير متاح)" />
                </Field>
              </fieldset>
              <button className="remaining-primary" disabled>
                إرسال الرسالة (غير متاح)
              </button>
            </>
          )}
          {dialog === 'faq' && <Faqs api={api} />}
        </Modal>
      )}
    </Workspace>
  )
}
function WithdrawProfileUpdate({ api, revisionId, close, saved, conflicted }: {
  api: ApiClient
  revisionId: string
  close: () => void
  saved: (response: TherapistProfileResponse) => void
  conflicted: () => void
}) {
  const mutation = useMutation(api)

  function withdraw() {
    void mutation.run(
      (signal) => api.request<TherapistProfileResponse>(`${therapistSubmissionPath}/${apiId(revisionId)}`, 'DELETE', { signal }),
      saved,
      (error) => {
        if (error instanceof ApiError && (error.status === 409 || error.status === 404)) conflicted()
      },
    )
  }

  return (
    <>
      <p>سيُلغى طلب مراجعة تعديلاتك. ستبقى بيانات ملفك المنشور كما هي.</p>
      {!!mutation.error && <p role="alert" className="remaining-error">{profileReviewError(mutation.error)}</p>}
      <footer className="remaining-form-actions">
        <button type="button" className="remaining-cancel" disabled={mutation.pending} onClick={close}>إلغاء</button>
        <button type="button" className="remaining-primary" disabled={mutation.pending} onClick={withdraw}>
          {mutation.pending ? 'جارٍ سحب التعديلات…' : 'تأكيد السحب'}
        </button>
      </footer>
    </>
  )
}
function Info({
  icon,
  label,
  value,
  arabic = false,
}: {
  icon: RemainingIconName
  label: string
  value?: string | null
  arabic?: boolean
}) {
  return (
    <div className="profile-info-row" dir={arabic ? 'rtl' : undefined} lang={arabic ? 'ar' : undefined}>
      <RemainingIcon name={icon} />
      <div>
        <small>{label}</small>
        <p dir={arabic ? 'auto' : undefined}>{value || (arabic ? 'غير متوفرة' : 'غير متوفر')}</p>
      </div>
    </div>
  )
}
function Unavailable({ close }: { close: () => void }) {
  return (
    <>
      <p role="alert">
        Working hours are unavailable. Wait for loading or resolve access issues before editing.
      </p>
      <button className="remaining-cancel" onClick={close}>
        Close
      </button>
    </>
  )
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="remaining-field">
      {label}
      {children}
    </label>
  )
}

type WindowDraft = { from: string; to: string }
function WorkingHours({
  api,
  therapist,
  timezone,
  close,
  saved,
}: {
  api: ApiClient
  therapist: Therapist
  timezone: string
  close: () => void
  saved: (therapist: Therapist) => void
}) {
  const [draft, setDraft] = useState<Record<Day, WindowDraft[]>>(
    () =>
      Object.fromEntries(
        days.map((day) => [
          day,
          (therapist.availability && !Array.isArray(therapist.availability)
            ? (therapist.availability[day] ?? [])
            : []
          ).map((window) => {
            const [from, to] = window.split('-')
            return { from, to }
          }),
        ]),
      ) as Record<Day, WindowDraft[]>,
  )
  const [validation, setValidation] = useState('')
  const mutation = useMutation(api)
  function update(day: Day, index: number, value: Partial<WindowDraft>) {
    setDraft({
      ...draft,
      [day]: draft[day].map((window, item) => (item === index ? { ...window, ...value } : window)),
    })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    for (const day of days) {
      const windows = [...draft[day]].sort((a, b) => a.from.localeCompare(b.from))
      if (
        windows.some(
          (window, index) =>
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.from) ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(window.to) ||
            window.to <= window.from ||
            (index > 0 && window.from < windows[index - 1].to),
        )
      ) {
        setValidation(
          `Enter complete, non-overlapping start/end times for ${day}; end must be after start. Overnight hours are not supported.`,
        )
        return
      }
    }
    setValidation('')
    // All seven days are submitted: the server replaces, rather than merges, this map.
    const availability = Object.fromEntries(
      days.map((day) => [day, draft[day].map(({ from, to }) => `${from}-${to}`)]),
    )
    void mutation.run(
      (signal) =>
        api.request<{ data: Therapist }>('/therapists/me/settings', 'PUT', {
          body: { availability },
          signal,
        }),
      (result) => saved(result.data),
    )
  }
  return (
    <form onSubmit={submit}>
      <p>
        All times are wall-clock hours in {timezone}, not your browser timezone. Saving replaces the
        entire weekly schedule. Days with no windows are off.
      </p>
      <p className="remaining-muted">
        Updates change future bookability; existing appointments are not cancelled or rescheduled.
      </p>
      <fieldset disabled={mutation.pending} className="hours-list live-hours-list">
        {days.map((day) => (
          <section className="live-hours-day" key={day}>
            <h3>{day[0].toUpperCase() + day.slice(1)}</h3>
            {!draft[day].length && <p>Off</p>}
            {draft[day].map((window, index) => (
              <div className="live-hours-window" key={index}>
                <Field label={`${day} start ${index + 1}`}>
                  <input
                    type="time"
                    required
                    value={window.from}
                    onChange={(event) => update(day, index, { from: event.target.value })}
                  />
                </Field>
                <Field label={`${day} end ${index + 1}`}>
                  <input
                    type="time"
                    required
                    value={window.to}
                    onChange={(event) => update(day, index, { to: event.target.value })}
                  />
                </Field>
                <button
                  className="remaining-cancel"
                  type="button"
                  aria-label={`Remove ${day} window ${index + 1}`}
                  onClick={() =>
                    setDraft({ ...draft, [day]: draft[day].filter((_, item) => item !== index) })
                  }
                >
                  Remove window
                </button>
              </div>
            ))}
            <button
              type="button"
              className="remaining-cancel"
              onClick={() => setDraft({ ...draft, [day]: [...draft[day], { from: '', to: '' }] })}
            >
              Add {day} window
            </button>
          </section>
        ))}
      </fieldset>
      {validation && (
        <p className="remaining-error" role="alert">
          {validation}
        </p>
      )}
      <Failure error={mutation.error} />
      <Actions pending={mutation.pending} close={close} />
    </form>
  )
}

function localDate(timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    return ['year', 'month', 'day']
      .map((part) => parts.find((item) => item.type === part)?.value)
      .join('-')
  } catch {
    return undefined
  }
}
function BlockedPeriods({
  api,
  timezone,
  close,
  keys,
  uncertain,
}: {
  api: ApiClient
  timezone: string
  close: () => void
  keys: Map<string, string>
  uncertain: { current: PeriodBody | null }
}) {
  const periods = useApiResource<{ data: Period[] }>(api, '/therapists/me/blocked-periods')
  const mutation = useMutation(api)
  const reconciliation = useMutation(api)
  const [draft, setDraft] = useState<PeriodBody>(
    uncertain.current ?? { start_date: '', end_date: '', reason: '' },
  )
  const [locked, setLocked] = useState(!!uncertain.current)
  const [validation, setValidation] = useState('')
  const [notice, setNotice] = useState('')
  const today = localDate(timezone)
  function submit(event: FormEvent) {
    event.preventDefault()
    const end = draft.end_date || draft.start_date
    const span =
      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${draft.start_date}T00:00:00Z`)) / 86400000 + 1
    if (
      !today ||
      !draft.start_date ||
      draft.start_date < today ||
      end < draft.start_date ||
      !Number.isFinite(span) ||
      span > 90
    ) {
      setValidation(
        'استخدم تواريخ حالية أو مستقبلية بمنطقتك الزمنية للجدولة، بنطاق شامل لا يتجاوز 90 يوماً.',
      )
      return
    }
    setValidation('')
    const body = {
      start_date: draft.start_date,
      end_date: end,
      reason: draft.reason?.trim() || null,
    }
    const signature = JSON.stringify(body)
    const key = keys.get(signature) ?? crypto.randomUUID()
    keys.set(signature, key)
    // Mark before dispatch so closing an in-flight modal cannot forget an ambiguous result.
    uncertain.current = body
    void mutation.run(
      (signal) =>
        api.request<{ data: Period }>('/therapists/me/blocked-periods', 'POST', {
          body,
          signal,
          idempotencyKey: key,
        }),
      () => {
        uncertain.current = null
        keys.delete(signature)
        setLocked(false)
        setDraft({ start_date: '', end_date: '', reason: '' })
        setNotice('أُضيفت فترة الحظر على الخادم.')
        periods.reload()
      },
      (error) => {
        const ambiguous =
          !(error instanceof ApiError) ||
          error.status === 0 ||
          error.status >= 500 ||
          error.status === 409
        uncertain.current = ambiguous ? body : null
        setLocked(ambiguous)
      },
    )
  }
  function reconcile() {
    void reconciliation.run(
      (signal) => api.get<{ data: Period[] }>('/therapists/me/blocked-periods', signal),
      (result) => {
        const body = uncertain.current
        const matching =
          body &&
          result.data.some(
            (period) =>
              period.start_date === body.start_date &&
              period.end_date === (body.end_date || body.start_date) &&
              (period.reason || null) === body.reason,
          )
        uncertain.current = null
        setLocked(false)
        if (matching) {
          setDraft({ start_date: '', end_date: '', reason: '' })
          setNotice(
            'توجد فترة حظر مطابقة على الخادم. راجع القائمة قبل إرسال أخرى.',
          )
        } else
          setNotice(
            'حُدّثت قائمة الخادم. إعادة الإرسال المتطابقة تحتفظ بمفتاح عدم التكرار نفسه.',
          )
        periods.reload()
      },
    )
  }
  function remove(id: string) {
    void mutation.run(
      (signal) => api.request(`/therapists/me/blocked-periods/${apiId(id)}`, 'DELETE', { signal }),
      () => {
        setNotice('أُزيلت فترة الحظر على الخادم.')
        periods.reload()
      },
    )
  }
  const busy = mutation.pending || reconciliation.pending
  return (
    <div>
      <p>
        Whole-day inclusive blocks in {timezone || 'منطقتك الزمنية على الخادم'}. Overlapping blocks or
        pending/confirmed appointments may prevent a new block. Existing appointments must be
        cancelled or rescheduled first.
      </p>
      {periods.loading && <p role="status">جارٍ تحميل فترات الحظر…</p>}
      <Failure error={periods.error} />
      <button
        type="button"
        className="remaining-cancel"
        disabled={busy}
        onClick={locked ? reconcile : periods.reload}
      >
        Refresh blocked periods
      </button>
      {!periods.loading && !periods.error && periods.data?.data.length === 0 && (
        <p>لا توجد فترات حظر.</p>
      )}
      <div className="holiday-list">
        {periods.data?.data.map((period) => (
          <article key={period.id}>
            <span className="holiday-clock"><RemainingIcon name="pendingMobile" /></span>
            <div className="holiday-copy">
              <strong>{period.reason || 'لم يُذكر سبب'}</strong>
              <p>{formatCalendarDate(period.start_date) || 'التاريخ غير متاح'} – {formatCalendarDate(period.end_date) || 'التاريخ غير متاح'}</p>
            </div>
            <button
              className="icon-button holiday-remove"
              disabled={busy || locked}
              aria-label={`Remove blocked period ${formatCalendarDate(period.start_date)}`.trimEnd()}
              onClick={() => remove(period.id)}
            >
              <RemainingIcon name="close" />
            </button>
          </article>
        ))}
      </div>
      {locked && (
        <p role="alert">
          The previous result is uncertain or conflicted. Refresh the server list before editing or
          retry this identical submission with its original key.
        </p>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy || locked || !!periods.error || periods.loading || !today}>
          <div className="remaining-field-grid">
            <Field label="Start date">
              <input
                type="date"
                required
                min={today}
                value={draft.start_date}
                onChange={(event) => setDraft({ ...draft, start_date: event.target.value })}
              />
            </Field>
            <Field label="تاريخ الانتهاء (اختياري)">
              <input
                type="date"
                min={draft.start_date || today}
                value={draft.end_date ?? ''}
                onChange={(event) => setDraft({ ...draft, end_date: event.target.value })}
              />
            </Field>
          </div>
          <Field label="السبب (اختياري)">
            <input
              maxLength={200}
              value={draft.reason ?? ''}
              onChange={(event) => setDraft({ ...draft, reason: event.target.value })}
            />
          </Field>
        </fieldset>
        {validation && (
          <p className="remaining-error" role="alert">
            {validation}
          </p>
        )}
        <Failure error={mutation.error || reconciliation.error} />
        {notice && <p role="status">{notice}</p>}
        <Actions
          pending={busy || !!periods.error || periods.loading || !today}
          close={close}
          label={locked ? 'إعادة الإرسال نفسه' : 'إضافة فترة حظر'}
        />
      </form>
    </div>
  )
}

function ChangePassword({
  api,
  close,
  saved,
}: {
  api: ApiClient
  close: () => void
  saved: () => void
}) {
  const mutation = useMutation(api)
  const [validation, setValidation] = useState('')
  const [reused, setReused] = useState(false)
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const body = {
      current_password: String(data.get('current_password') ?? ''),
      password: String(data.get('password') ?? ''),
      password_confirmation: String(data.get('password_confirmation') ?? ''),
    }
    if (!validNewPassword(body.password)) {
      setValidation(passwordPolicyMessage)
      return
    }
    if (body.password === body.current_password) {
      setValidation('يجب أن تختلف كلمة المرور الجديدة عن الحالية.')
      return
    }
    if (body.password !== body.password_confirmation) {
      setValidation('يجب أن تتطابق كلمة المرور الجديدة مع تأكيدها.')
      return
    }
    setValidation('')
    setReused(false)
    void mutation.run(
      (signal) => api.request('/auth/user/password', 'PUT', { body, signal }),
      () => {
        form.reset()
        saved()
      },
      (error) => {
        if (error instanceof ApiError && error.code === 'password_reused') setReused(true)
      },
    )
  }
  return (
    <form onSubmit={submit}>
      <p>A successful change signs out other devices, not this session.</p>
      <fieldset disabled={mutation.pending}>
        {(
          [
            ['كلمة المرور الحالية', 'current_password'],
            ['كلمة المرور الجديدة', 'password'],
            ['تأكيد كلمة المرور الجديدة', 'password_confirmation'],
          ] as const
        ).map(([label, name]) => (
          <Field label={label} key={name}>
            <input
              type="password"
              name={name}
              aria-label={label}
              required
              autoComplete={name === 'current_password' ? 'current-password' : 'new-password'}
              onChange={() => {
                setValidation('')
                if (name === 'password') setReused(false)
              }}
            />
            {name === 'password' && (validation || reused) && (
              <span className="remaining-error" role="alert">
                {validation || 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.'}
              </span>
            )}
          </Field>
        ))}
      </fieldset>
      {!(mutation.error instanceof ApiError && mutation.error.code === 'password_reused') && (
        <Failure error={mutation.error} />
      )}
      <Actions pending={mutation.pending} close={close} />
    </form>
  )
}
function Logout({
  api,
  navigate,
  close,
}: {
  api: ApiClient
  navigate: (path: string) => void
  close: () => void
}) {
  const busy = useRef(false)
  const [pending, setPending] = useState(false)
  const [started, setStarted] = useState(false)
  async function logout() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setStarted(true)
    let revoked = true
    try {
      await api.logout()
    } catch {
      revoked = false
    } finally {
      // logout intentionally unmounts private data as soon as local credentials clear.
      // Navigation must survive that unmount, but must not redirect a new signed-in actor.
      if (!api.getUser()) navigate(revoked ? '/login' : '/login?logout=revocation-unknown')
    }
  }
  // Stage the explanation before local clearing can unmount this dialog.
  return (
    <>
      <p>تسجيل الخروج من هذا الجهاز وإلغاء جلسته على الخادم؟</p>
      <p role={started ? 'status' : undefined}>
        If the server cannot confirm revocation, you will still be signed out locally, but remote
        revocation is unknown and the session may remain active on the server.
      </p>
      <footer className="remaining-form-actions">
        <button className="remaining-cancel" disabled={pending} onClick={close}>
          Cancel
        </button>
        <button
          className="remaining-danger"
          disabled={pending}
          onClick={() => {
            void logout()
          }}
        >
          {pending ? 'جارٍ تسجيل الخروج…' : 'تسجيل الخروج'}
        </button>
      </footer>
    </>
  )
}
function Faqs({ api }: { api: ApiClient }) {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<{
    data: { id: string; question: string; answer: string }[]
    pagination: { current_page: number; last_page: number }
  } | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)
    setState(null)
    api
      .request<NonNullable<typeof state>>(`/faqs?page=${page}`, 'GET', {
        public: true,
        signal: controller.signal,
      })
      .then((result) => {
        if (active) {
          setState(result)
          setLoading(false)
        }
      })
      .catch((cause) => {
        if (active && !controller.signal.aborted) {
          setError(cause)
          setLoading(false)
        }
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [api, page, revision])
  return (
    <div className="faq-list">
      {loading && <p role="status">جارٍ تحميل الأسئلة الشائعة…</p>}
      <Failure error={error} />
      {!!error && (
        <button className="remaining-cancel" onClick={() => setRevision((value) => value + 1)}>
          Retry FAQs
        </button>
      )}
      {state?.data.length === 0 && !error && <p>No published FAQs.</p>}
      {state?.data.map((faq, index) => (
        <details key={faq.id} open={index === 0}>
          <FaqSummary>{faq.question}</FaqSummary>
          <p>{faq.answer}</p>
        </details>
      ))}
      {state && (
        <footer className="remaining-form-actions">
          <button
            className="remaining-cancel"
            disabled={loading || page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous FAQs
          </button>
          <span>
            Page {state.pagination.current_page} of {state.pagination.last_page}
          </span>
          <button
            className="remaining-cancel"
            disabled={loading || page >= state.pagination.last_page}
            onClick={() => setPage(page + 1)}
          >
            Next FAQs
          </button>
        </footer>
      )}
    </div>
  )
}
