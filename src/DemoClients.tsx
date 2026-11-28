import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { asset } from './assets'
import { DesignIcon, Workspace } from './Workspace'
import './visual-client-list-preview.css'

type PreviewClient = {
  name: string
  latinName: string
  detail: string
  status: string
  tone: 'teal' | 'amber' | 'red'
  activity: number
  stripWidth: number
  sessions: number
  change: string
  nextSession: string
  portrait: 'saad' | 'jamal' | 'yaser' | 'ethan' | 'maya'
  active: boolean
  systemChangeFont?: boolean
}

// Development design fixtures only: never substitute these for API client records.
// Text/crops/strip widths: saved Figma 1:6934, 1:8105 and 1:8698 contexts.
// Those frames supply 5/1 filter counts, not membership. Ethan is the local-only
// inactive fixture; this is preview behavior, not an inferred clinical status.
const previewClients: readonly PreviewClient[] = [
  {
    name: 'سعد علي',
    latinName: 'Saad Ali',
    detail: 'قلق · 32 سنة',
    status: 'يتقدّم جيداً',
    tone: 'teal',
    activity: 40,
    stripWidth: 139,
    sessions: 7,
    change: '3 أكثر من الشهر الماضي',
    nextSession: 'الجمعة، 9:30 ص',
    portrait: 'saad',
    active: true,
  },
  {
    name: 'جمال طومسون',
    latinName: 'Jamal Thompson',
    detail: 'إرهاق · 29 سنة',
    status: 'يحتاج مراجعة',
    tone: 'amber',
    activity: 80,
    stripWidth: 285,
    sessions: 4,
    change: '1 أقل من الشهر الماضي',
    nextSession: 'الاثنين، 2:00 م',
    portrait: 'jamal',
    active: true,
  },
  {
    name: 'ياسر راميريز',
    latinName: 'Yaser Ramirez',
    detail: 'مزاج · 27 سنة',
    status: 'على الموعد',
    tone: 'teal',
    activity: 60,
    stripWidth: 204,
    sessions: 6,
    change: 'مثل الشهر الماضي',
    nextSession: 'الأربعاء، 10:00 ص',
    portrait: 'yaser',
    active: true,
    systemChangeFont: true,
  },
  {
    name: 'إيثان كلارك',
    latinName: 'Ethan Clarke',
    detail: 'ضغط · 30 سنة',
    status: 'فاتته الجلسة السابقة',
    tone: 'red',
    activity: 13,
    stripWidth: 31,
    sessions: 5,
    change: '2 أقل من الشهر الماضي',
    nextSession: 'الخميس، 3:30 م',
    portrait: 'ethan',
    active: false,
  },
  {
    name: 'مايا باتيل',
    latinName: 'Maya Patel',
    detail: 'قلق · 24 سنة',
    status: 'على المسار',
    tone: 'teal',
    activity: 60,
    stripWidth: 204,
    sessions: 8,
    change: 'أعلى بـ1 عن الشهر الماضي',
    nextSession: 'الثلاثاء، 8:00 ص',
    portrait: 'maya',
    active: true,
    systemChangeFont: true,
  },
  {
    name: 'نوح بينيت',
    latinName: 'Noah Bennett',
    detail: 'مزاج · 28 سنة',
    status: 'على المسار',
    tone: 'teal',
    activity: 60,
    stripWidth: 204,
    sessions: 5,
    change: '2 أكثر من الشهر الماضي',
    nextSession: 'السبت، 1:00 م',
    portrait: 'jamal',
    active: true,
    systemChangeFont: true,
  },
]

const portraitAssets = {
  saad: 'preview-client-list-saad.png',
  jamal: 'preview-client-list-portraits.png',
  yaser: 'preview-client-list-portraits.png',
  ethan: 'preview-client-list-ethan.png',
  maya: 'preview-client-list-maya.png',
} as const

const filters = ['All', 'Active', 'Inactive'] as const
type PreviewFilter = (typeof filters)[number]

export function DemoClients({ navigate }: { navigate: (path: string) => void }) {
  return import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true'
    ? <ClientListFixture navigate={navigate} />
    : null
}

function ClientListFixture({ navigate }: { navigate: (path: string) => void }) {
  // Finite development-only presentation states for the distinct source densities.
  // This component is never mounted by the protected API clients route.
  const params = new URLSearchParams(window.location.search)
  const requestedDensity = params.get('density')
  const density = requestedDensity === 'compact' || requestedDensity === 'spacious'
    ? requestedDensity
    : params.get('state') === 'offline' || params.get('state') === 'expanded'
      ? 'spacious'
      : 'responsive'
  const [filter, setFilter] = useState<PreviewFilter>('All')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filterMenu = useRef<HTMLDivElement>(null)
  const filterButton = useRef<HTMLButtonElement>(null)
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!filtersOpen) return
    function dismiss(event: PointerEvent) {
      if (!filterMenu.current?.contains(event.target as Node)) setFiltersOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
        filterButton.current?.focus()
      }
    }
    document.addEventListener('pointerdown', dismiss)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', dismiss)
      document.removeEventListener('keydown', escape)
    }
  }, [filtersOpen])
  const query = search.trim().toLocaleLowerCase()
  const visibleClients = previewClients.filter(
    (client) =>
      (filter === 'All' || client.active === (filter === 'Active')) &&
      [client.name, client.latinName].some((name) => name.toLocaleLowerCase().includes(query)),
  )

  return (
    <div className="demo-client-list" data-density={density} data-compliance-open={filtersOpen} aria-label="Development client-list design reference">
      <Workspace active="Clients" title="إدارة العملاء" navigate={navigate} onSearch={setSearch}>
        <p className="sr-only" id="demo-client-list-disclosure">
          عناصر تصميم تطويرية فقط. البحث ومرشّحات الحالة تعمل محلياً؛ لا يوجد خادم
          connected. Every card opens the separate Ahmed Mohamed reference profile, not a live
          record.
        </p>
        <div className="demo-client-list-add-row">
          <button
            className="demo-client-list-add"
            type="button"
            disabled
            aria-describedby="demo-client-list-add-unavailable"
            title="إنشاء العملاء غير متاح في معاينة التصميم المحلية. لن يُنشأ أي عميل."
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add Client
          </button>
          <span className="sr-only" id="demo-client-list-add-unavailable">
            Client creation is unavailable in this local design preview. No client will be created.
          </span>
        </div>
        <div className="demo-client-list-toolbar">
          <div
            className="demo-client-list-filters"
            role="group"
            aria-label="مرشّحات عملاء العرض المحلي"
          >
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                aria-controls="demo-client-list-cards"
                onClick={() => setFilter(item)}
              >
                {item} (
                {
                  previewClients.filter(
                    (client) => item === 'All' || client.active === (item === 'Active'),
                  ).length
                }
                )
              </button>
            ))}
          </div>
          <div className="demo-client-list-filter-anchor" ref={filterMenu}>
          <button
            ref={filterButton}
            className="demo-client-list-more-filters"
            type="button"
            aria-label="تصفية حسب الالتزام"
            aria-expanded={filtersOpen}
            aria-controls="demo-client-compliance-options"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <DesignIcon name="client-6934-imgIcon1.svg" />
          </button>
          {filtersOpen && <section id="demo-client-compliance-options" className="demo-client-list-compliance" aria-label="Compliance design options">
            <h2>تصفية حسب الالتزام</h2>
            <button type="button" aria-pressed="true" onClick={() => { setFilter('All'); setFiltersOpen(false) }}>All</button>
            <button type="button" disabled title="بيانات الالتزام غير متوفرة؛ شريط النشاط ليس درجة التزام إكلينيكية.">التزام عالٍ (80%+)</button>
            <button type="button" disabled title="بيانات الالتزام غير متوفرة؛ شريط النشاط ليس درجة التزام إكلينيكية.">التزام منخفض (أقل من 80%)</button>
          </section>}
          </div>
        </div>
        <section
          id="demo-client-list-cards"
          className="demo-client-list-grid"
          aria-label="عملاء العرض"
          aria-describedby="demo-client-list-disclosure"
        >
          {visibleClients.map((client) => (
            <button
              key={client.name}
              className={`demo-client-list-card demo-client-list-${client.tone} ${client.portrait === 'yaser' ? 'demo-client-list-wide-card' : ''}`}
              type="button"
              aria-label={`فتح ملف ${client.name} التجريبي`}
              onClick={() => navigate('/clients/profile?id=demo-client')}
              style={
                { '--demo-client-list-strip-width': `${client.stripWidth}px` } as CSSProperties
              }
            >
              <span className="demo-client-list-card-header">
                <span className="demo-client-list-identity">
                  <span
                    className={`demo-client-list-portrait demo-client-list-portrait-${client.portrait}`}
                  >
                    <img src={asset(portraitAssets[client.portrait])} alt="" />
                  </span>
                  <span className="demo-client-list-person">
                    <span className="demo-client-list-name">{client.name}</span>
                    <span className="demo-client-list-detail">{client.detail}</span>
                  </span>
                </span>
                <span className="demo-client-list-status">{client.status}</span>
              </span>
              <span className="demo-client-list-activity">
                <span className="demo-client-list-activity-label">
                  <span>النشاط · الشهر الماضي</span>
                  <span className="demo-client-list-percent">{client.activity}%</span>
                </span>
                {/* Fixed source strip lengths deliberately do not recalculate the printed percentages. */}
                <span className="demo-client-list-track" aria-hidden="true">
                  <span />
                </span>
              </span>
              <span
                className={`demo-client-list-card-footer ${client.name === 'سعد علي' ? 'demo-client-list-spread-footer' : ''}`}
              >
                <span
                  className={`demo-client-list-pill ${client.systemChangeFont ? 'demo-client-list-muted-sessions' : ''}`}
                >
                  <DesignIcon name="preview-client-list-calendar.svg" />
                  <span>{client.sessions} sessions</span>
                  <span
                    className={`demo-client-list-change ${client.systemChangeFont ? 'demo-client-list-system-change' : ''}`}
                  >
                    <DesignIcon name="preview-client-list-change.svg" />
                    <span>{client.change}</span>
                  </span>
                </span>
                <span className="demo-client-list-pill demo-client-list-next-session">
                  <DesignIcon name="preview-client-list-clock.svg" />
                  <span>{client.nextSession}</span>
                </span>
              </span>
            </button>
          ))}
          {visibleClients.length === 0 && (
            <p className="demo-client-list-empty" role="status">
              No demo clients found.
            </p>
          )}
        </section>
      </Workspace>
    </div>
  )
}
