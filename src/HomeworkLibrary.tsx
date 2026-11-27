import { useState } from 'react'
import { asset } from './assets'
import { ApiClient } from './api'
import { DesignIcon, Workspace } from './Workspace'
import { DeleteTemplateDialog } from './DeleteTemplateDialog'
import { Modal } from './ui'

type HomeworkLibraryProps = { navigate: (path: string) => void; api?: ApiClient }
type LibraryVariant = 'empty' | 'list' | 'published' | 'preview' | 'no-patients'
type Tab = 'content' | 'patients'

function isDemoMode() {
  return import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
}

const variants: LibraryVariant[] = ['empty', 'list', 'published', 'preview', 'no-patients']

type FixtureRow = {
  title: string
  type: string
  duration: string
  patients: number
  status: string[]
  fresh?: boolean
}

// Development design fixtures only; the live view stays on the honest empty
// library and never fabricates clinical operations.
const fixtureRows: readonly FixtureRow[] = [
  {
    title: 'نشاط يومي صغير',
    type: 'مقال / درس',
    duration: 'قراءة 10 د',
    patients: 0,
    status: ['منشور v2', '4 حقول نص طويل', 'لم يُدرج بعد'],
    fresh: true,
  },
  {
    title: 'تمرين التنفس اليومي',
    type: 'Video',
    duration: '12 د',
    patients: 14,
    status: ['منشور v1', 'Assigned'],
  },
  {
    title: 'يوميات النوم',
    type: 'تمرين تفاعلي',
    duration: '5 د',
    patients: 8,
    status: ['منشور v1', 'Assigned'],
  },
  {
    title: 'تمرين وقت القلق',
    type: 'Goal',
    duration: '15 د',
    patients: 3,
    status: ['Draft', 'لم يُدرج بعد'],
  },
]

const fixturePatients = [
  { name: 'سعد علي', completion: '92%', status: 'على المسار' },
  { name: 'جمال طومسون', completion: '71%', status: 'مراجعة مستحقة' },
  { name: 'ياسر راميريز', completion: '100%', status: 'على المسار' },
  { name: 'مايا باتيل', completion: '64%', status: 'على المسار' },
  { name: 'نوح بينيت', completion: '38%', status: 'مراجعة مستحقة' },
] as const

const clinicalNeeds = ['كل الاحتياجات', 'Anxiety', 'Depression', 'Sleep', 'Stress', 'Mood']
const contentTypes = [
  'كل الأنواع',
  'تمرين تفاعلي',
  'Video',
  'Audio',
  'مقال / درس',
  'Goal',
  'فحص سريع',
]

const instructions =
  'اختر نشاطاً صغيراً واحداً — لا يتجاوز 10 دقائق — وقم به دون انتظار الحماس. ثم سجّل ما فعلته وكيف شعرت قبله وبعده.'

export function HomeworkLibrary({ navigate, api }: HomeworkLibraryProps) {
  const requested = new URLSearchParams(window.location.search).get('state')
  const normalized = requested === 'published-success' ? 'published' : requested
  const demo = isDemoMode()
  const deleteTemplate = demo && normalized === 'delete-template'
  const variant: LibraryVariant = deleteTemplate
    ? 'list'
    : demo && variants.includes(normalized as LibraryVariant)
      ? (normalized as LibraryVariant)
      : 'empty'
  const [notice, setNotice] = useState('')
  const [deleteDismissed, setDeleteDismissed] = useState(false)
  const [search, setSearch] = useState('')
  const [need, setNeed] = useState('كل الاحتياجات')
  const [type, setType] = useState('كل الأنواع')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [tab, setTab] = useState<Tab>(variant === 'no-patients' ? 'patients' : 'content')
  const isDetails = variant === 'preview' || variant === 'no-patients'

  function unavailable(label: string) {
    setNotice(
      api
        ? `${label}: هذه الميزة غير متاحة في API المعالج.`
        : `${label}: معاينة تصميم محلية فقط — لا توجد خدمة واجبات متصلة.`,
    )
  }
  function openCreate() {
    if (api) unavailable('إنشاء واجب جديد')
    else navigate('/homework/create')
  }

  const query = search.trim().toLocaleLowerCase()
  const rows = fixtureRows.filter(
    (row) =>
      (type === 'كل الأنواع' || row.type === type) &&
      row.title.toLocaleLowerCase().includes(query),
  )
  const listVisible = variant === 'list' || variant === 'published'

  return (
    <Workspace
      title={
        <>
          <span className="r5-hw-crumb">المحتوى الإضافي / </span>
          {isDetails ? 'تفاصيل الواجب' : 'مكتبة الواجبات'}
        </>
      }
      mobileTitle={isDetails ? 'تفاصيل الواجب' : 'مكتبة سكينة'}
      active="Additional Content"
      navigate={navigate}
      onSearch={isDetails || api ? undefined : setSearch}
      api={api}
    >
      <div className={`r5-homework r5-variant-${variant}`}>
        {!isDetails && (
          <header className="r5-hw-header">
            <h2>مكتبة الواجبات</h2>
            <p>
              <span className="r5-hw-sub-long">
                Manage, organize, and assign clinical homework resources to your patients.
              </span>
              <span className="r5-hw-sub-short">أسند التمارين الإكلينيكية للمرضى.</span>
            </p>
            <div className="r5-hw-filters">
              <label className="r5-hw-select">
                <span className="sr-only">تصفية حسب الاحتياجات الإكلينيكية</span>
                <select aria-label="تصفية حسب الاحتياجات الإكلينيكية" value={need} onChange={(e) => setNeed(e.target.value)}>
                  {clinicalNeeds.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="r5-hw-select">
                <span className="sr-only">Filter by type</span>
                <select aria-label="Filter by type" value={type} onChange={(e) => setType(e.target.value)}>
                  {contentTypes.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="r5-hw-search">
                <DesignIcon name="part2-03-imgSearch.svg" />
                <input
                  aria-label="ابحث في قوالب الواجبات"
                  placeholder="ابحث..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
          </header>
        )}
        {variant === 'published' && !bannerDismissed && (
          <p className="r5-hw-banner" role="status">
            <CheckIcon />
            Homework published successfully.
            <button aria-label="إغلاق تنبيه النشر" onClick={() => setBannerDismissed(true)}>
              ×
            </button>
          </p>
        )}
        {listVisible ? (
          <section className="r5-hw-list" aria-label="قوالب الواجبات">
            {rows.map((row) => (
              <button
                key={row.title}
                type="button"
                className="r5-hw-row"
                onClick={() => (api ? unavailable(row.title) : navigate('/homework?state=preview'))}
              >
                <span className="r5-hw-row-main">
                  <span className="r5-hw-row-title">{row.title}</span>
                  <span className="r5-hw-chip r5-hw-chip-type">{row.type}</span>
                </span>
                <span className="r5-hw-row-meta">
                  <span className="r5-hw-row-detail">
                    <DesignIcon name="dashboard-imgClockThree.svg" />
                    {row.duration}
                  </span>
                  <span className="r5-hw-row-detail">
                    <DesignIcon name="dashboard-imgSquareUserCheck.svg" />
                    {row.patients === 0
                      ? 'لا يوجد مرضى'
                      : `${row.patients} ${row.patients === 1 ? 'مريض' : 'مرضى'}`}
                  </span>
                </span>
                <span className={`r5-hw-status ${row.fresh ? 'r5-hw-status-fresh' : ''}`}>
                  {row.status.map((part, i) => (
                    <span key={part}>
                      {i > 0 && <i aria-hidden="true" />}
                      {part}
                    </span>
                  ))}
                </span>
                <ChevronIcon />
              </button>
            ))}
            {!rows.length && (
              <p className="r5-hw-empty-result" role="status">
                لا توجد قوالب واجبات تطابق هذا المرشّح.
              </p>
            )}
          </section>
        ) : !isDetails ? (
          <section className="r5-hw-empty" aria-label="Empty homework library">
            <span className="r5-hw-empty-icon">
              <DesignIcon name="r5-library-states-sparkles.svg" />
            </span>
            <h3>لا توجد قوالب واجبات بعد</h3>
            <p>
              Create your first homework template to start assigning clinical exercises and
              tracking your patient progress.
            </p>
            <button type="button" className="r5-hw-cta" onClick={openCreate}>
              <PlusIcon /> Create New Homework
            </button>
          </section>
        ) : null}
        {isDetails && (
          <DetailsView
            api={api}
            navigate={navigate}
            tab={tab}
            setTab={setTab}
            empty={variant === 'no-patients'}
            onUnavailable={unavailable}
          />
        )}
      </div>
      {notice && (
        <Modal
          title={api ? 'الميزة غير متاحة' : 'عرض الواجهة التجريبي'}
          className="part2-modal"
          onClose={() => setNotice('')}
        >
          <p>{notice}</p>
        </Modal>
      )}
      {deleteTemplate && !deleteDismissed && (
        <DeleteTemplateDialog
          templateName="Daily Breathing Exercise"
          assignedCount={14}
          onClose={() => setDeleteDismissed(true)}
          onDelete={() => {
            setDeleteDismissed(true)
            setNotice('عرض تجريبي فقط: لم يُحذف أي قالب. لا يوجد خادم متصل.')
          }}
        />
      )}
    </Workspace>
  )
}

function DetailsView({
  api,
  navigate,
  tab,
  setTab,
  empty,
  onUnavailable,
}: {
  api?: ApiClient
  navigate: (path: string) => void
  tab: Tab
  setTab: (tab: Tab) => void
  empty: boolean
  onUnavailable: (label: string) => void
}) {
  const stats = empty
    ? [
        { label: 'إجمالي مرات الإسناد', value: '0 مرات', chip: 'لا يوجد نشاط' },
        { label: 'متوسط نسبة الإكمال', value: '0.0%', chip: 'N/A' },
        { label: 'متوسط تقييم المرضى', value: '—', chip: 'لا توجد مراجعات بعد' },
      ]
    : [
        { label: 'إجمالي مرات الإسناد', value: '48 مرة', chip: '+12% هذا الشهر' },
        { label: 'متوسط نسبة الإكمال', value: '92.4%', chip: '+4% مقابل المتوسط' },
        { label: 'متوسط تقييم المرضى', value: '4.8 / 5', chip: 'فعّالة جداً' },
      ]
  const patientCount = empty ? 0 : 14
  return (
    <>
      <header className="r5-hd-header">
        <button
          type="button"
          className="icon-button r5-hd-back"
          aria-label="عودة إلى مكتبة الواجبات"
          onClick={() => navigate(isDemoMode() ? '/homework?state=list' : '/homework')}
        >
          <DesignIcon name="r5-library-states-arrow-left.svg" />
        </button>
        <div className="r5-hd-titles">
          <h2>Daily Breathing Exercise</h2>
          <p>أدر وراجع معاينة قالب المريض.</p>
        </div>
        {!empty && (
          <button
            type="button"
            className="soft-button r5-hd-edit-top"
            onClick={() => (api ? onUnavailable('تعديل القالب') : navigate('/homework/create'))}
          >
            Edit Template
          </button>
        )}
      </header>
      <div className="r5-hd-stats">
        {stats.map((stat) => (
          <section key={stat.label} className="r5-hd-stat">
            <p>{stat.label}</p>
            <strong>{stat.value}</strong>
            <span className={`r5-hd-chip ${empty ? 'r5-hd-chip-muted' : ''}`}>{stat.chip}</span>
          </section>
        ))}
      </div>
      <div className="r5-hd-tabs" role="tablist" aria-label="Homework detail views">
        <button
          role="tab"
          aria-selected={tab === 'content'}
          aria-label="المحتوى والمعاينة"
          className={tab === 'content' ? 'selected' : ''}
          onClick={() => setTab('content')}
        >
          <span className="r5-hd-tab-long" aria-hidden="true">
            Content &amp; Preview
          </span>
          <span className="r5-hd-tab-short" aria-hidden="true">
            Preview
          </span>
        </button>
        <button
          role="tab"
          aria-selected={tab === 'patients'}
          aria-label={`المرضى المسندون (${patientCount})`}
          className={tab === 'patients' ? 'selected' : ''}
          onClick={() => setTab('patients')}
        >
          <span className="r5-hd-tab-long" aria-hidden="true">
            المرضى المسندون ({patientCount})
          </span>
          <span className="r5-hd-tab-short" aria-hidden="true">
            Patients ({patientCount})
          </span>
        </button>
      </div>
      {tab === 'content' ? (
        <div className="r5-hd-panels">
          <TemplateCard onUnavailable={onUnavailable} api={api} navigate={navigate} />
          <PatientPreview />
        </div>
      ) : empty ? (
        <section className="r5-hw-empty r5-hd-no-patients" aria-label="لا يوجد مرضى مسندون">
          <span className="r5-hw-empty-icon">
            <DesignIcon name="r5-library-states-users.svg" />
          </span>
          <h3>لا يوجد مرضى مسندون بعد</h3>
          <p>
            Assign this template to one or more of your active clinical patients to begin
            collecting logs.
          </p>
          <button type="button" className="r5-hw-cta" onClick={() => onUnavailable('أسند الواجب الآن')}>
            Assign Homework Now
          </button>
        </section>
      ) : (
        <section className="r5-hd-patient-list" aria-label="Assigned patients">
          {fixturePatients.map((patient) => (
            <div key={patient.name} className="r5-hd-patient-row">
              <span className="r5-hd-patient-avatar" aria-hidden="true">
                {patient.name.slice(0, 1)}
              </span>
              <span className="r5-hd-patient-name">{patient.name}</span>
              <span className="r5-hd-patient-completion">{patient.completion} completed</span>
              <span className="r5-hd-chip">{patient.status}</span>
            </div>
          ))}
        </section>
      )}
    </>
  )
}

function TemplateCard({
  api,
  navigate,
  onUnavailable,
}: {
  api?: ApiClient
  navigate: (path: string) => void
  onUnavailable: (label: string) => void
}) {
  return (
    <section className="r5-hd-card" aria-label="Template Details">
      <header className="r5-hd-card-head">
        <h3>Template Details</h3>
        <span className="r5-hw-chip r5-hw-chip-type">Breathing Exercise</span>
      </header>
      <dl className="r5-hd-fields">
        <dt>العنوان</dt>
        <dd>نشاط يومي صغير</dd>
        <dt>التعليمات / الوصف</dt>
        <dd>{instructions}</dd>
      </dl>
      <div className="r5-hd-uploads">
        <button type="button" onClick={() => onUnavailable('رفع فيديو')}>
          <DesignIcon name="r5-library-states-upload.svg" />
          Click here to Upload new video file
        </button>
        <button type="button" onClick={() => onUnavailable('رفع صورة مصغّرة')}>
          <DesignIcon name="r5-library-states-upload.svg" />
          Click here to Upload new thumbnail
        </button>
      </div>
      <div className="r5-hd-card-foot">
        <button
          type="button"
          className="teal-button r5-hd-edit"
          onClick={() => (api ? onUnavailable('تعديل القالب') : navigate('/homework/create'))}
        >
          Edit template
        </button>
      </div>
    </section>
  )
}

function PatientPreview() {
  return (
    <section className="r5-hd-card r5-hd-preview-card" aria-label="Patient Preview">
      <header className="r5-hd-card-head">
        <h3>Patient Preview</h3>
        <span className="r5-hd-chip">Live Preview</span>
      </header>
      <div className="r5-hd-phone">
        <div className="r5-hd-phone-status">
          <span>9:41</span>
          <span className="r5-hd-phone-notch" />
          <span className="r5-hd-phone-signal" aria-hidden="true" />
        </div>
        <div className="r5-hd-phone-appbar">
          <span className="r5-hd-phone-back" aria-hidden="true">
            ‹
          </span>
          <strong>تمرين التنفس 7،8،9</strong>
        </div>
        <div className="r5-hd-phone-body">
          <div className="r5-hd-phone-video">
            <img src={asset('r5-library-states-preview-thumb.svg')} alt="" />
            <span className="r5-hd-phone-time">4:10</span>
            <span className="r5-hd-phone-total">12:00</span>
          </div>
          <h4>Daily Small Activity</h4>
          <p>{instructions}</p>
          <span className="r5-hd-phone-done">Completed</span>
        </div>
      </div>
    </section>
  )
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg className="r5-hw-row-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="#98a2ae" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
