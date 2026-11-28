import { useState, type FormEvent } from 'react'
import { sessions, type Session } from './data'
import { asset } from './assets'
import { Modal } from './ui'
import { DesignIcon, Workspace } from './Workspace'
import { Avatar } from './Dashboard'
import { ApiClient } from './api'
import { LiveCarePage } from './api-sessions-and-clinical-live'
import { closurePortraitAssets } from './closure-portrait-assets'
import './visual-session-list-final.css'

type ListedSession = Session & {
  id: string
  category: 'Previous' | 'Upcoming' | 'Today'
  type?: string
}
const extraSessions: Session[] = [
  {
    name: 'لينا حداد',
    date: '21 نيسان 2026',
    time: '10:30',
    status: 'ready',
    image: 'part2-07-imgContainer8.png',
  },
  {
    name: 'عمر ناصر',
    date: '22 نيسان 2026',
    time: '15:15',
    status: 'canceled',
    image: 'part2-07-imgContainer9.png',
  },
  {
    name: 'نور الخطيب',
    date: '23 نيسان 2026',
    time: '12:00',
    status: 'unsure',
    image: 'part2-07-imgContainer10.png',
  },
]
const initialSessions: ListedSession[] = [
  ...sessions,
  ...extraSessions,
  { ...extraSessions[2] },
  ...sessions.slice(0, 5).map((item, index) => ({ ...item, date: `${24 + index} نيسان 2026` })),
].map((item, index) => {
  const id = `session-${index}`
  const portrait = closurePortraitAssets.sessions.desktopTablet.find(
    ({ target }) => target.sessionId === id && target.name === item.name,
  )
  return {
    ...item,
    image: portrait?.image ?? item.image,
    crop: portrait ? portrait.crop : item.crop,
    id,
    category: index < 2 ? 'Today' : index < 8 ? 'Previous' : 'Upcoming',
    type:
      index === 7
        ? 'جلسة متابعة'
        : index === 8
          ? 'استشارة أولية'
          : index === 9 || index === 10
            ? 'جلسة جماعية'
            : 'جلسة خاصة',
  }
})

function DemoSessionAvatar({ session }: { session: ListedSession }) {
  const phone = closurePortraitAssets.sessions.phone.find(
    ({ target }) => target.sessionId === session.id && target.name === session.name,
  )
  if (!phone || (phone.image === session.image && phone.crop === session.crop)) {
    return <Avatar patient={session} />
  }
  return (
    <span className="session-row-portrait">
      <span className="session-desktop-portrait">
        <Avatar patient={session} />
      </span>
      <span className="session-phone-portrait">
        <Avatar patient={{ ...session, image: phone.image, crop: phone.crop }} />
      </span>
    </span>
  )
}

export function ScheduleDialog({
  onClose,
  onSchedule,
}: {
  onClose: () => void
  onSchedule: (session: { name: string; date: string; time: string; duration: string }) => void
}) {
  const [patient, setPatient] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [duration, setDuration] = useState('')
  function submit(event: FormEvent) {
    event.preventDefault()
    if (patient && date && time && duration) onSchedule({ name: patient, date, time, duration })
  }
  return (
    <Modal title="جدولة جلسة جديدة" className="part2-modal schedule-modal" onClose={onClose}>
      <form className="part2-form" onSubmit={submit}>
        <label>
          Patient
          <select
            aria-label="Patient"
            required
            value={patient}
            onChange={(event) => setPatient(event.target.value)}
          >
            <option value="">مثال: إجازة سنوية، سفر...</option>
            {[...new Set([...initialSessions.map((item) => item.name), 'مارك لوري'])].map(
              (name) => (
                <option key={name}>{name}</option>
              ),
            )}
          </select>
        </label>
        <div className="form-columns">
          <label>
            Time
            <select
              aria-label="Time"
              required
              value={time}
              onChange={(event) => setTime(event.target.value)}
            >
              <option value="">التاريخ هنا</option>
              {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Dated
            <input
              aria-label="Dated"
              type="date"
              required
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        <label>
          Duration
          <select
            aria-label="Duration"
            required
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          >
            <option value="">التاريخ هنا</option>
            {['30 دقيقة', '45 دقيقة', '60 دقيقة', '90 دقيقة'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <footer className="form-footer">
          <button type="button" className="soft-button" onClick={onClose}>
            Cancel
          </button>
          <button className="teal-button" type="submit">
            Schedule
          </button>
        </footer>
      </form>
    </Modal>
  )
}

export function Sessions({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  return api ? (
    <LiveCarePage page="sessions" api={api} navigate={navigate} />
  ) : (
    <DemoSessions navigate={navigate} />
  )
}

function DemoSessions({ navigate }: { navigate: (path: string) => void }) {
  const initial = new URLSearchParams(window.location.search).get('state')
  const [tab, setTab] = useState('All')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState(initialSessions)
  const [schedule, setSchedule] = useState(initial === 'schedule')
  const [feedback, setFeedback] = useState('')
  const filtered = items.filter(
    (item) =>
      (tab === 'All' || item.category === tab) &&
      item.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <Workspace title="Sessions" active="Sessions" navigate={navigate} onSearch={setQuery}>
      <div className="sessions-toolbar demo-sessions-toolbar">
        <div className="session-tabs" role="tablist" aria-label="مرشّحات الجلسات">
          {['All', 'Previous', 'Upcoming', 'Today'].map((label) => (
            <button
              role="tab"
              aria-selected={tab === label}
              key={label}
              className={tab === label ? 'selected' : ''}
              onClick={() => setTab(label)}
            >
              {label}
              <span>
                ({items.filter((item) => label === 'All' || item.category === label).length})
              </span>
            </button>
          ))}
        </div>
        <button className="teal-button" onClick={() => setSchedule(true)}>
          Schedule New <DesignIcon name="part2-07-imgArrowLeft.svg" />
        </button>
      </div>
      <section
        className="all-sessions demo-all-sessions final-session-list"
        aria-label="كل الجلسات"
      >
        <header>
          <h2>{tab === 'All' ? 'كل الجلسات' : `${tab} Sessions`}</h2>
          <button
            onClick={() => {
              setTab('All')
              setQuery('')
            }}
          >
            See all{' '}
            <img
              className="see-all-arrow"
              src={asset('r4-sessions-list-see-all-arrow.svg')}
              alt=""
              aria-hidden="true"
            />
          </button>
        </header>
        <div className="sessions-list-scroll">
          <table className="all-sessions-table">
            <thead>
              <tr>
                <th>اسم المريض</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <button
                      className="patient-cell"
                      onClick={() =>
                        navigate(`/sessions/upcoming?patient=${encodeURIComponent(item.name)}`)
                      }
                    >
                      <DemoSessionAvatar session={item} />
                      <span>
                        <span className="patient-name">{item.name}</span>
                        <small>{item.type}</small>
                      </span>
                    </button>
                  </td>
                  <td className="session-date">
                    {item.date}, {item.time}
                  </td>
                  <td>
                    <button
                      className={`session-status ${item.status}`}
                      aria-label={`فتح جلسة ${item.name}`}
                      onClick={() =>
                        navigate(`/sessions/upcoming?patient=${encodeURIComponent(item.name)}`)
                      }
                    >
                      {item.status === 'ready'
                        ? 'جاهز'
                        : item.status === 'canceled'
                          ? 'Canceled'
                          : 'غير مؤكد'}
                      <img
                        src={asset(
                          item.status === 'ready'
                            ? 'part2-07-imgStatusIcon.svg'
                            : item.status === 'canceled'
                              ? 'dashboard-imgIcon6.svg'
                              : 'part2-07-imgLoaderIcon.svg',
                        )}
                        alt=""
                      />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="empty-result">No sessions found</p>}
        </div>
      </section>
      {feedback && (
        <p className="demo-feedback" role="status">
          {feedback}
        </p>
      )}
      {schedule && (
        <ScheduleDialog
          onClose={() => setSchedule(false)}
          onSchedule={(item) => {
            setItems([
              ...items,
              {
                id: `demo-${items.length}`,
                name: item.name,
                date: new Date(`${item.date}T12:00:00`).toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                }),
                time: item.time,
                category: 'Upcoming',
                status: 'ready',
                image: 'part2-07-imgContainer6.png',
                type: `جلسة خاصة · ${item.duration}`,
              },
            ])
            setSchedule(false)
            setTab('All')
            setFeedback('جُدولت جلسة تجريبية محلياً. لا يوجد تقويم أو API مرضى متصل.')
          }}
        />
      )}
    </Workspace>
  )
}
