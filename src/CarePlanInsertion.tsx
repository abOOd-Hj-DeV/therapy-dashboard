import { useState, type ReactElement } from 'react'
import { asset } from './assets'
import { DesignIcon, Workspace } from './Workspace'
import type { ApiClient } from './api'
import { formatCalendarDate } from './display-date'

// Development design fixtures ONLY. Transcribed from the round-5 Figma
// references r5-102..r5-112 ("Ahmed care plan — insertion point"): a numbered
// behavioural-activation stage list, the dashed "Target gap" callout that
// previews where a library item would land, and the patient contact card.
// None of this is API data.
type StageStatus = 'completed' | 'current' | 'locked'
type Stage = { title: string; status: StageStatus; line: string; identity: string }

const stages: Stage[] = [
  { title: 'تقييم الحالة', status: 'completed', line: 'مكتمل · الاستجابات محفوظة', identity: 'ba-assess' },
  { title: 'ماذا فقدت من حياتك؟', status: 'completed', line: 'مكتمل · الاستجابات محفوظة', identity: 'ba-loss' },
  { title: 'نشاط صغير يوميًا', status: 'current', line: 'الحالي · قيد التنفيذ', identity: 'ba-small' },
  { title: 'سلّم النشاط', status: 'locked', line: 'مقفل · يكتمل بعد المرحلة 3', identity: 'ba-ladder' },
  { title: 'جدولة الأنشطة الأسبوعية', status: 'locked', line: 'مقفل · يكتمل بعد المرحلة 4', identity: 'ba-week' },
  { title: 'مواجهة الانسحاب الاجتماعي', status: 'locked', line: 'مقفل · يكتمل بعد المرحلة 5', identity: 'ba-social' },
  { title: 'التعامل مع النكسات', status: 'locked', line: 'مقفل · يكتمل بعد المرحلة 6', identity: 'ba-relapse' },
  { title: 'بناء روتين طويل المدى', status: 'locked', line: 'مقفل · يكتمل بعد المرحلة 7', identity: 'ba-routine' },
  { title: 'مراجعة الخطة والاستمرار', status: 'locked', line: 'مقفل · يكتمل بعد المرحلة 8', identity: 'ba-review' },
]

const currentStage = 3
const proposal = {
  title: 'Thought record · سجل الأفكار',
  meta: 'منشور v2 · 4 حقول نص طويل · لم يُدرج بعد',
}

export function CarePlanInsertion({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  if (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true' && !api) {
    return <DemoCarePlanInsertion navigate={navigate} />
  }
  return <LiveCarePlanInsertion navigate={navigate} api={api} />
}

// The nav-wire unit owns the shell contract: /homework/* pages highlight
// "Additional Content" in the sidebar via the Workspace active union.
const homeworkNav = 'Additional Content' as const
const homeworkTitle = 'إسناد الواجب'

function LiveCarePlanInsertion({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  const [notice, setNotice] = useState('')
  return (
    <div className="care-plan-insertion">
      <Workspace active={homeworkNav} title={homeworkTitle} mobileTitle={homeworkTitle} navigate={navigate} api={api}>
        {notice && (
          <div className="cpi-notice" role="status">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </div>
        )}
        <div className="cpi-layout">
          <section className="cpi-card cpi-empty" aria-label="Care plan unavailable">
            <h2>تحرير خطة الرعاية غير متصل</h2>
            <p>
              The therapist API does not expose care-plan stages or a homework library, so no stages
              are shown and nothing can be inserted, published, assigned, repositioned, or deleted here.
            </p>
            <button type="button" className="cpi-action" onClick={() => setNotice('تحرير خطة الرعاية غير متاح في API المعالج.')}>
              Why is this empty?
            </button>
          </section>
        </div>
      </Workspace>
    </div>
  )
}

function DemoCarePlanInsertion({ navigate }: { navigate: (path: string) => void }) {
  const [gap, setGap] = useState(currentStage)
  const [notice, setNotice] = useState('')

  function unavailable(action: string) {
    setNotice(`عرض تجريبي فقط: ${action} غير متصل. لم يُجرَ أي تغيير على خطة الرعاية.`)
  }

  function insertSlot(afterStage: number) {
    const next = stages[afterStage]
    return (
      <li key={`insert-${afterStage}`} className="cpi-insert">
        <button
          type="button"
          aria-label={
            next
              ? `إدراج بين المراحل: بعد ${stages[afterStage - 1].title}، قبل ${next.title}`
              : `إدراج بين المراحل: بعد ${stages[afterStage - 1].title}`
          }
          onClick={() => {
            setGap(afterStage)
            setNotice('')
          }}
        >
          <DesignIcon name="r5-insertion-add.svg" />
          <span>إدراج بين المراحل</span>
        </button>
      </li>
    )
  }

  function stageCard(stage: Stage, index: number) {
    const number = index + 1
    return (
      <li
        key={stage.identity}
        className={`cpi-stage cpi-stage-${stage.status}`}
        aria-label={`المرحلة ${number}: ${stage.title} — ${stage.line}`}
      >
        <span className={`cpi-chip cpi-chip-${stage.status}`} aria-hidden="true">
          {stage.status === 'completed' ? <img src={asset('r5-insertion-check.svg')} alt="" /> : number}
        </span>
        <div className="cpi-stage-copy">
          <h3 lang="ar">{stage.title}</h3>
          <p className="cpi-status">{stage.line}</p>
          <p className="cpi-meta">Stable identity · {stage.identity}</p>
        </div>
      </li>
    )
  }

  const nextStage = stages[gap]
  const gapHeading = gap === currentStage ? `الفجوة المستهدفة · بعد المرحلة الحالية ${currentStage}` : `الفجوة المستهدفة · بعد المرحلة ${gap}`
  const gapSub = nextStage
    ? `قبل «${nextStage.title}» · مرحلة جديدة مقترحة ${gap + 1} من ${stages.length + 1}`
    : `نهاية الخطة · مرحلة جديدة مقترحة ${gap + 1} من ${stages.length + 1}`

  return (
    <div className="care-plan-insertion">
      <Workspace active={homeworkNav} title={homeworkTitle} mobileTitle={homeworkTitle} navigate={navigate}>
        {notice && (
          <div className="cpi-notice" role="status">
            <p>{notice}</p>
            <button type="button" onClick={() => setNotice('')}>
              Dismiss
            </button>
          </div>
        )}
        <div className="cpi-layout">
          <aside className="cpi-card cpi-identity" aria-label="Design fixture patient contact">
            <div className="cpi-identity-actions">
              <button
                type="button"
                className="cpi-contact"
                title="افتح محادثات العرض، وليست محادثة مريض حقيقية"
                onClick={() => navigate('/chats')}
              >
                <DesignIcon name="preview-client-profile-contact.svg" />
                Contact patient
              </button>
              <div className="cpi-two-actions">
                <button type="button" onClick={() => unavailable('Scheduling')}>
                  <DesignIcon name="preview-client-profile-schedule.svg" />
                  Schedule
                </button>
                <button type="button" onClick={() => unavailable('Calling')}>
                  <DesignIcon name="preview-client-profile-call.svg" />
                  Call
                </button>
              </div>
            </div>
            <section className="cpi-meta-block">
              <h3>معلومات التواصل</h3>
              <dl>
                <div>
                  <dt>Mobile</dt>
                  <dd>+966 50 123 4567</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>ahmed@example.com</dd>
                </div>
              </dl>
            </section>
            <section className="cpi-meta-block cpi-subscription">
              <h3>Subscription</h3>
              <dl>
                <div>
                  <dt>Package</dt>
                  <dd>باقة 8 أسابيع</dd>
                </div>
                <div>
                  <dt>Start</dt>
                  <dd>{formatCalendarDate('2024-01-15')}</dd>
                </div>
                <div>
                  <dt>الجلسة التالية</dt>
                  <dd>اليوم 10:00 ص</dd>
                </div>
              </dl>
            </section>
          </aside>
          <ol className="cpi-stages" aria-label="Care plan stages">
            {stages.map((stage, index) => (
              <FragmentRow key={stage.identity} stage={stage} index={index} gap={gap} insertSlot={insertSlot} stageCard={stageCard} gapHeading={gapHeading} gapSub={gapSub} setNotice={setNotice} />
            ))}
          </ol>
        </div>
        <p className="cpi-demo-disclaimer">
          Development design reference only. The stage list and proposal are a Figma fixture, not a
          real care plan. No backend is connected; picking a slot only moves the preview.
        </p>
      </Workspace>
    </div>
  )
}

function FragmentRow({
  stage,
  index,
  gap,
  insertSlot,
  stageCard,
  gapHeading,
  gapSub,
  setNotice,
}: {
  stage: Stage
  index: number
  gap: number
  insertSlot: (afterStage: number) => ReactElement
  stageCard: (stage: Stage, index: number) => ReactElement
  gapHeading: string
  gapSub: string
  setNotice: (value: string) => void
}) {
  const afterStage = index + 1
  return (
    <>
      {stageCard(stage, index)}
      {gap === afterStage && (
        <li className="cpi-gap" aria-label={`${gapHeading}. ${gapSub}`}>
          <h2>{gapHeading}</h2>
          <p className="cpi-gap-sub">{gapSub}</p>
          <div className="cpi-proposal">
            <h3>{proposal.title}</h3>
            <p>{proposal.meta}</p>
          </div>
          <div className="cpi-gap-actions">
            <button
              type="button"
              className="cpi-action"
              onClick={() => setNotice('Demo only: the content picker is not connected. “Thought record · سجل الأفكار” stays the staged proposal.')}
            >
              <DesignIcon name="r5-insertion-plus.svg" />
              Choose content
            </button>
            <button
              type="button"
              className="cpi-action"
              onClick={() => setNotice('عرض تجريبي فقط: اختر أي خانة «إدراج بين المراحل» لنقل المرحلة المقترحة. لا يُحفظ شيء.')}
            >
              Reposition
            </button>
          </div>
        </li>
      )}
      {gap !== afterStage && insertSlot(afterStage)}
    </>
  )
}
