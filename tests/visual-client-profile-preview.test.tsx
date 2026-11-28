import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClientProfile } from '../src/DemoClientProfile'

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients/profile')
})
afterEach(() => vi.unstubAllGlobals())

function renderPreview() {
  const navigate = vi.fn()
  const user = userEvent.setup()
  const { unmount } = render(<DemoClientProfile navigate={navigate} />)
  return { navigate, user, unmount }
}

function panel() { return within(screen.getByRole('tabpanel')) }

// These are jsdom behavior/content checks, not visual or pixel-fidelity claims.
describe('development-only client profile Figma reference', () => {
  it('does not expose fixtures unless demo mode is explicitly enabled', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders the exact identity, subscription and Overview fixtures without a backend', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    renderPreview()
    expect(screen.getByRole('heading', { name: 'إدارة العملاء / الملفات' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'إدارة العملاء / الملف' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    for (const text of ['أحمد محمد', 'العمر 28 · ذكر', '+966 50 123 4567', 'ahmed@example.com', '8-Week Package', '15 Jan 2024', 'Today 10:00 AM']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(panel().getByText('8')).toBeInTheDocument()
    expect(panel().getByText('7')).toBeInTheDocument()
    expect(panel().getByText('85%')).toBeInTheDocument()
    expect(panel().getByText('21')).toBeInTheDocument()
    for (const text of ['إجمالي الجلسات', 'الجلسات المكتملة', 'نسبة الالتزام', 'أيام في البرنامج', '4/10', 'سابقاً 7/10', 'سابقاً 5/10', 'سابقاً 6/10', 'مستوى القلق', 'جودة النوم', 'الأداء اليومي']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
    expect(screen.getByText('The client shows significant improvement across all key indicators. Consistent exercise contributes to positive results.')).toBeInTheDocument()
    expect(screen.getByText(/Development design reference only/)).toHaveTextContent('Figma fixture, not a real patient record')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('renders nothing in a production environment', () => {
    vi.stubEnv('DEV', false)
    const { container } = render(<DemoClientProfile navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('switches all tabs, including an honest missing Custom Content reference', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    expect(panel().getByRole('group', { name: 'Filter sessions' })).toBeInTheDocument()
    expect(screen.queryByText('مستوى القلق')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().getByRole('textbox', { name: 'ملاحظة جديدة' })).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'محتوى مخصص' }))
    expect(panel().getByRole('heading', { name: 'Custom Content reference unavailable' })).toBeInTheDocument()
    expect(panel().getByText(/1:11772 contains Notes/)).toBeInTheDocument()
    expect(panel().queryByRole('textbox')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(panel().getByText('إجمالي الجلسات')).toBeInTheDocument()
    for (const tab of screen.getAllByRole('tab')) {
      expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', screen.getByRole('tab', { selected: true }).id)
      expect(tab).toHaveAttribute('aria-controls')
    }
  })

  it('supports keyboard tab navigation and roving focus', async () => {
    const { user } = renderPreview()
    screen.getByRole('tab', { name: 'Overview' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Sessions' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'محتوى مخصص' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'محتوى مخصص' })).toHaveFocus()
    await user.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveFocus()
    expect(screen.getAllByRole('tab').filter((tab) => tab.tabIndex === 0)).toHaveLength(1)
  })

  it('preserves all seven supplied session rows and the literal All (6) source label', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    expect(panel().getByRole('button', { name: 'الكل (6)' })).toHaveAttribute('aria-pressed', 'true')
    expect(panel().getAllByRole('article')).toHaveLength(7)
    const upcoming = within(panel().getByRole('region', { name: 'Upcoming sessions' }))
    expect(upcoming.getAllByRole('article')).toHaveLength(2)
    expect(upcoming.getByText('22 أيار 2024 · 10:00 ص · 60 دقيقة')).toBeInTheDocument()
    expect(upcoming.getByText('مراجعة شهرية مجدولة')).toBeInTheDocument()
    const historical = within(panel().getByRole('region', { name: 'Completed sessions' }))
    expect(historical.getAllByRole('article')).toHaveLength(5)
    expect(historical.getByText('لم يحضر المريض — لم تُعَد الجدولة حينها')).toBeInTheDocument()
    expect(historical.getByText('نوقشت الأهداف والتحديات')).toBeInTheDocument()
  })

  it('filters Upcoming, Completed and Missed independently, then restores All', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    await user.click(panel().getByRole('button', { name: 'Upcoming' }))
    expect(panel().getAllByRole('article')).toHaveLength(2)
    expect(panel().queryByText('استشارة أولية')).not.toBeInTheDocument()
    await user.click(panel().getByRole('button', { name: 'Completed' }))
    expect(panel().getAllByRole('article')).toHaveLength(4)
    expect(panel().queryByRole('article', { name: 'جلسة فردية: Missed' })).not.toBeInTheDocument()
    await user.click(panel().getByRole('button', { name: 'Missed' }))
    expect(panel().getAllByRole('article')).toHaveLength(1)
    expect(panel().getByText('جلسة فردية')).toBeInTheDocument()
    await user.click(panel().getByRole('button', { name: 'الكل (6)' }))
    expect(panel().getAllByRole('article')).toHaveLength(7)
  })

  it('uses the exact existing notes, and expands/collapses note text locally', async () => {
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().getByText('تاريخ ووقت الجلسة: 15 أيار 2024، 4:00 م')).toBeInTheDocument()
    expect(panel().getByText(/During this session, we thoroughly reviewed/)).toHaveTextContent('ensuring a more tailored and effective therapeutic approach moving forward.')
    expect(panel().getByText('لُوحظ تقدّم واضح في إدارة القلق.')).toBeInTheDocument()
    expect(panel().getByText('حسّن المريض مهارات التعامل مع القلق.')).toBeInTheDocument()
    const first = panel().getByRole('button', { name: 'Collapse ملخص شامل لجلسة العلاج' })
    expect(first).toHaveAttribute('aria-expanded', 'true')
    await user.click(first)
    expect(panel().getByRole('button', { name: 'Expand ملخص شامل لجلسة العلاج' })).toHaveAttribute('aria-expanded', 'false')
    await user.click(panel().getByRole('button', { name: 'Expand جلسة علاج فردي' }))
    expect(panel().getByRole('button', { name: 'Collapse جلسة علاج فردي' })).toHaveAttribute('aria-expanded', 'true')
    expect(panel().getByText(/رُوجعت أعراض القلق واستراتيجيات التأقلم بالتفصيل\. أظهر المريض تقدّماً قوياً في تحديد المحفّزات واستخدام التقنيات الجديدة بثقة\. رُكّز على تمارين الاسترخاء والتمارين المعرفية، مع خطط لتعزيز هذه المهارات ومواجهة تحديات جديدة للتحسّن المستمر\./)).toHaveTextContent('مواجهة تحديات جديدة للتحسّن المستمر.')
  })

  it('validates empty, short, whitespace and oversized local notes with no writes', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { user } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    const field = panel().getByRole('textbox', { name: 'ملاحظة جديدة' })
    expect(field).toHaveAttribute('maxlength', '5000')
    for (const value of ['', '   ', 'ab', 'x'.repeat(5001)]) {
      fireEvent.change(field, { target: { value } })
      fireEvent.submit(field.closest('form')!)
      expect(screen.getByRole('alert')).toHaveTextContent('بين 3 و5,000 حرف')
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(panel().queryByText('Local demo note')).not.toBeInTheDocument()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('adds a trimmed local note, retains it between tabs, and loses it on unmount', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { user, unmount } = renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    const field = panel().getByRole('textbox', { name: 'ملاحظة جديدة' })
    await user.type(field, '  My local preview observation  ')
    await user.click(panel().getByRole('button', { name: 'Add Note' }))
    expect(panel().getByText('My local preview observation')).toBeInTheDocument()
    expect(panel().getByText('Local only — not saved to a server')).toBeInTheDocument()
    expect(field).toHaveValue('')
    expect(screen.getByRole('status')).toHaveTextContent('لم تُرسل إلى خادم')
    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().getByText('My local preview observation')).toBeInTheDocument()
    unmount()
    renderPreview()
    await user.click(screen.getByRole('tab', { name: 'Notes' }))
    expect(panel().queryByText('My local preview observation')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('explicitly refuses unsupported scheduling, calls and rescheduling, and navigates only to demo chats for contact', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { navigate, user } = renderPreview()
    await user.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(screen.getByRole('status')).toHaveTextContent('عرض تجريبي فقط: Scheduling غير متصل')
    await user.click(screen.getByRole('button', { name: 'Call' }))
    expect(screen.getByRole('status')).toHaveTextContent('عرض تجريبي فقط: Calling غير متصل')
    await user.click(screen.getByRole('button', { name: 'Contact patient' }))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/chats')
    await user.click(screen.getByRole('tab', { name: 'Sessions' }))
    await user.click(panel().getByRole('button', { name: 'Schedule session' }))
    expect(screen.getByRole('status')).toHaveTextContent('عرض تجريبي فقط: Schedule session غير متصل')
    await user.click(panel().getByRole('button', { name: 'Reschedule جلسة متابعة' }))
    expect(screen.getByRole('status')).toHaveTextContent('لم يُجرَ اتصال أو حجز أو تغيير على الخادم')
    await user.click(panel().getByRole('button', { name: /View استشارة أولية/ }))
    expect(screen.getByRole('status')).toHaveTextContent('عرض تجريبي فقط: Session details غير متصل')
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
