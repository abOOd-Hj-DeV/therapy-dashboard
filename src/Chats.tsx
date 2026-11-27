import { useEffect, useRef, useState, type FormEvent } from 'react'
import { asset } from './assets'
import { DesignIcon, Workspace } from './Workspace'
import { ApiClient } from './api'
import { LiveChats } from './api-chat-and-notifications-live-chat'
import '@fontsource/ibm-plex-sans/700.css'
import './visual-chats.css'

const clients = [
  {
    id: 'sara',
    name: 'سارة خالد',
    image: 'dashboard-imgContainer3.png',
    preview: "متى الوحدة التالية؟",
    time: '05/18',
    crop: '',
    unread: 0,
  },
  {
    id: 'ahmed',
    name: 'أحمد محمد',
    image: 'dashboard-imgContainer1.png',
    preview: 'شكراً دكتور',
    time: '10:30 AM',
    crop: 'chat-portrait',
    unread: 2,
  },
  {
    id: 'jack',
    name: 'جاك واطسون',
    image: 'part2-03-imgContainer3.png',
    preview: 'هل أستطيع تغيير الموعد؟',
    time: 'Yesterday',
    crop: '',
    unread: 1,
  },
  {
    id: 'mohammed',
    name: 'محمد حسن',
    image: 'dashboard-imgContainer4.png',
    preview: "أشعر بتحسن كبير",
    time: 'Yesterday',
    crop: 'chat-mohammed',
    unread: 0,
  },
]
type ChatMessage = {
  text: string
  time: string
  outgoing?: boolean
  today?: boolean
  expandOnPhone?: boolean
}
const saraMessages: ChatMessage[] = [
  {
    text: 'أشعر بتحسن بعد تطبيق تمارين التنفس التي أوصيتَ بها.',
    time: '9:20 AM',
    expandOnPhone: true,
  },
  {
    text: "رائع! هل واجهت صعوبات في تطبيقها؟",
    time: '9:30 ص · مقروءة',
    outgoing: true,
    expandOnPhone: true,
  },
  {
    text: 'كان التركيز صعباً في البداية، لكنه أصبح أسهل مع التمرن.',
    time: '10:00 AM',
    expandOnPhone: true,
  },
  { text: 'هل أستطيع بدء الوحدة الجديدة؟', time: '10:30 AM' },
  { text: 'نعم بالتأكيد', time: '9:30 ص · مقروءة', outgoing: true, today: true },
]

export function Chats({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  return api ? <LiveChats api={api} navigate={navigate} /> : <DemoChats navigate={navigate} />
}

function DemoChats({ navigate }: { navigate: (path: string) => void }) {
  const initial = new URLSearchParams(window.location.search).get('state')
  const [selected, setSelected] = useState<string | null>(
    initial === 'empty' ||
      initial === 'list' ||
      (window.innerWidth <= 600 && initial !== 'thread' && initial !== 'offline')
      ? null
      : 'sara',
  )
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [sent, setSent] = useState<Record<string, ChatMessage[]>>({})
  const [read, setRead] = useState<string[]>([])
  const [feedback, setFeedback] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [compact, setCompact] = useState(window.innerWidth <= 600)
  const fileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const offline = !online || initial === 'offline'
  const client = clients.find((item) => item.id === selected)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    const resize = () => setCompact(window.innerWidth <= 600)
    window.addEventListener('resize', resize)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  useEffect(() => {
    const history = historyRef.current
    if (history) history.scrollTop = history.scrollHeight
  }, [selected])
  function send(event: FormEvent) {
    event.preventDefault()
    if (!draft.trim() || !selected || offline) return
    const message = { text: draft.trim(), time: 'الآن · عرض تجريبي', outgoing: true }
    setSent((current) => ({ ...current, [selected]: [...(current[selected] ?? []), message] }))
    setDraft('')
    setFeedback('أُضيفت رسالة تجريبية محلياً. لم تُرسل أي رسالة إلى الخادم.')
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ block: 'nearest' }))
  }
  const messages = client
    ? [
        ...(client.id === 'sara' ? saraMessages : [{ text: client.preview, time: client.time }]),
        ...(sent[client.id] ?? []),
      ]
    : []
  return (
    <Workspace
      title="Chats"
      active="Messages"
      navigate={navigate}
      offline={offline}
      onSearch={setQuery}
    >
      <div
        className={`chat-layout demo-chat-layout ${offline ? 'is-offline' : ''} ${client ? 'has-conversation' : 'no-conversation'}`}
      >
        <section className="chat-list" aria-label="Conversations">
          <label className="chat-search">
            <DesignIcon name="part2-03-imgSearch.svg" />
            <input
              aria-label="ابحث في المحادثات"
              placeholder="ابحث..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {(!offline || client) && (
            <div className="response-promise list-promise">
              <DesignIcon name="part2-03-imgIcon1.svg" />
              <span>ملتزمون بالرد خلال 8 ساعات</span>
            </div>
          )}
          <div className="conversation-list">
            {clients
              .filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase()))
              .map((item) => (
                <button
                  key={item.id}
                  className={`conversation ${
                    selected === item.id || (!selected && compact && item.id === 'sara')
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => {
                    setSelected(item.id)
                    setDraft('')
                    setFeedback('')
                    setRead([...read, item.id])
                  }}
                >
                  <span className={`chat-avatar ${item.crop}`}>
                    <img src={asset(item.image)} alt="" />
                  </span>
                  <span className="conversation-copy">
                    <span>
                      <strong>{item.name}</strong>
                      <time>{item.time}</time>
                    </span>
                    <span>
                      <small>{sent[item.id]?.at(-1)?.text ?? item.preview}</small>
                      {item.unread > 0 && !read.includes(item.id) && <i>{item.unread}</i>}
                    </span>
                  </span>
                </button>
              ))}
            {!clients.some((item) =>
              item.name.toLowerCase().includes(query.trim().toLowerCase()),
            ) && <p className="empty-result">لم يُعثر على محادثات</p>}
          </div>
        </section>
        {client ? (
          <section className="chat-thread" aria-label={`Conversation with ${client.name}`}>
            <header className="chat-thread-header">
              <button
                className="thread-back icon-button"
                aria-label="عودة إلى المحادثات"
                onClick={() => {
                  setSelected(null)
                  setFeedback('')
                }}
              >
                <DesignIcon name="part2-06-imgIcon.svg" />
              </button>
              <span className={`chat-avatar ${client.crop}`}>
                <img src={asset(client.image)} alt="" />
              </span>
              <div>
                <strong>{client.name}</strong>
                <p>
                  <span className="desktop-concern">اضطراب القلق </span>العام · آخر ظهور
                  2 hours ago
                </p>
              </div>
            </header>
            <div className="message-history" ref={historyRef}>
              <div className="response-promise thread-promise">
                <DesignIcon name="part2-03-imgIcon1.svg" />
                <span>ملتزمون بالرد خلال 8 ساعات عمل (السبت–الخميس، 9ص–5م)</span>
              </div>
              <p className="message-date">9 كانون الأول 2025</p>
              {messages.map((message, index) => (
                <div
                  key={`${index}-${message.text}`}
                  className={`message-group ${message.outgoing ? 'outgoing' : ''} ${message.expandOnPhone ? 'reference-phone-wide' : ''}`}
                >
                  {message.today && <p className="message-date">اليوم</p>}
                  <p className="message-bubble">{message.text}</p>
                  <time>{message.time}</time>
                </div>
              ))}
              <div className="reply-reminder" ref={bottomRef}>
                <DesignIcon name="part2-03-imgIcon2.svg" />
                <span>رسالة جديدة من العميل · قبل ساعتين — يجب الرد خلال 6 ساعات</span>
              </div>
            </div>
            <form className="message-composer" onSubmit={send}>
              <button
                type="button"
                aria-label="إرفاق ملف"
                disabled={offline}
                onClick={() => fileRef.current?.click()}
              >
                <DesignIcon name="part2-03-imgIcon3.svg" />
              </button>
              <input
                hidden
                ref={fileRef}
                type="file"
                aria-label="مرفق رسالة"
                onChange={(event) =>
                  setFeedback(
                    event.target.files?.[0]
                      ? `مرفق تجريبي محدد: ${event.target.files[0].name}. لم يُرفع أي ملف.`
                      : '',
                  )
                }
              />
              <textarea
                aria-label="Message"
                rows={1}
                placeholder={compact ? 'اكتب رسالتك' : 'اكتب رسالتك للعميل...'}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                disabled={offline}
              />
              <button type="submit" aria-label="إرسال الرسالة" disabled={!draft.trim() || offline}>
                <DesignIcon name="part2-03-imgIcon4.svg" />
              </button>
            </form>
            {feedback && (
              <p className="demo-feedback" role="status">
                {feedback}
              </p>
            )}
          </section>
        ) : (
          <section className="empty-conversation" aria-label="اختر محادثة">
            <div>
              <span>
                <DesignIcon name="part2-20-imgMessageCircleLinesAlt1.svg" />
              </span>
              <h2 dir="rtl">اختر محادثة</h2>
              <p dir="rtl">اضغط على محادثة من القائمة لفتحها والرد على العميل</p>
            </div>
          </section>
        )}
      </div>
    </Workspace>
  )
}
