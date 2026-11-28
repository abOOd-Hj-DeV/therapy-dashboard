import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/chats')
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  Element.prototype.scrollIntoView = vi.fn()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

describe('chat demo', () => {
  it('opens real routes from the first dashboard without replacing it', async () => {
    window.history.replaceState({}, '', '/dashboard')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'الرسائل' }))
    expect(screen.getByRole('heading', { name: 'Chats' })).toBeInTheDocument()
    await userEvent.click(
      within(screen.getByRole('complementary', { name: 'التنقل الرئيسي' })).getByRole('button', {
        name: 'لوحة التحكم',
      }),
    )
    expect(screen.getByRole('heading', { name: 'الجلسات القادمة' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'See all' }))
    expect(screen.getByRole('heading', { name: 'كل الجلسات' })).toBeInTheDocument()
  })
  it('opens the Arabic empty state and selects a conversation', async () => {
    window.history.replaceState({}, '', '/chats?state=empty')
    render(<App />)
    expect(screen.getByText('اختر محادثة')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /سارة خالد/ }))
    expect(
      screen.getByRole('region', { name: 'Conversation with سارة خالد' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('أشعر بتحسن بعد تطبيق تمارين التنفس التي أوصيتَ بها.'),
    ).toBeInTheDocument()
  })
  it('filters conversations and clears unread badges on selection', async () => {
    render(<App />)
    await userEvent.type(screen.getByLabelText('ابحث في المحادثات'), 'أحمد')
    expect(screen.queryByRole('button', { name: /جاك واطسون/ })).not.toBeInTheDocument()
    const ahmed = screen.getByRole('button', { name: /أحمد محمد/ })
    expect(within(ahmed).getByText('2')).toBeInTheDocument()
    await userEvent.click(ahmed)
    expect(within(ahmed).queryByText('2')).not.toBeInTheDocument()
    expect(
      screen.getByRole('region', { name: 'Conversation with أحمد محمد' }),
    ).toBeInTheDocument()
  })
  it('sends a local demo message only to the selected thread', async () => {
    render(<App />)
    expect(screen.getByRole('button', { name: 'إرسال الرسالة' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Message', { exact: true }), 'A local reply')
    await userEvent.click(screen.getByRole('button', { name: 'إرسال الرسالة' }))
    expect(screen.getByRole('region', { name: /Conversation with سارة/ })).toHaveTextContent(
      'A local reply',
    )
    expect(screen.getByRole('status')).toHaveTextContent('لم تُرسل أي رسالة إلى الخادم')
    await userEvent.click(screen.getByRole('button', { name: /أحمد محمد/ }))
    expect(screen.getByRole('region', { name: /Conversation with أحمد/ })).not.toHaveTextContent(
      'A local reply',
    )
  })
  it('disables messaging on actual connection loss and restores it', () => {
    render(<App />)
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    act(() => window.dispatchEvent(new Event('offline')))
    expect(screen.getByText(/أنت غير متصل/)).toBeInTheDocument()
    expect(screen.getByLabelText('Message', { exact: true })).toBeDisabled()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.getByLabelText('Message', { exact: true })).toBeEnabled()
  })
  it('selects an attachment without pretending to upload it', () => {
    render(<App />)
    fireEvent.change(screen.getByLabelText('مرفق رسالة'), {
      target: { files: [new File(['demo'], 'practice.txt', { type: 'text/plain' })] },
    })
    expect(screen.getByRole('status')).toHaveTextContent('لم يُرفع أي ملف')
  })
  it('starts on the list on phones and returns from a thread', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 370 })
    render(<App />)
    expect(screen.queryByRole('region', { name: /Conversation with سارة/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /سارة خالد/ }))
    await userEvent.click(screen.getByRole('button', { name: 'عودة إلى المحادثات' }))
    expect(screen.queryByRole('region', { name: /Conversation with سارة/ })).not.toBeInTheDocument()
  })
})

describe('session scheduling and records', () => {
  beforeEach(() => window.history.replaceState({}, '', '/sessions'))
  it('filters all 16 fixtures with counts that match their rows', async () => {
    render(<App />)
    const region = screen.getByRole('region', { name: 'كل الجلسات' })
    expect(within(region).getAllByRole('row')).toHaveLength(17)
    for (const [label, count] of [
      ['Previous', 6],
      ['Upcoming', 8],
      ['Today', 2],
    ] as const) {
      await userEvent.click(screen.getByRole('tab', { name: `${label} (${count})` }))
      expect(within(region).getAllByRole('row')).toHaveLength(count + 1)
    }
  })
  it('schedules a new demo session and updates the counts', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Schedule New' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Patient'), 'مارك لوري')
    await userEvent.selectOptions(within(dialog).getByLabelText('Time'), '10:00')
    fireEvent.change(within(dialog).getByLabelText('Dated'), { target: { value: '2026-10-20' } })
    await userEvent.selectOptions(within(dialog).getByLabelText('Duration'), '45 دقيقة')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'All (17)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /فتح جلسة مارك لوري/ })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('لا يوجد تقويم أو API مرضى متصل')
  })
  it('opens patient-specific detail through a query-string route', async () => {
    render(<App />)
    await userEvent.click(
      screen.getAllByRole('button', { name: /فتح جلسة سعد الشيخ علي/ })[0],
    )
    expect(window.location.pathname).toBe('/sessions/upcoming')
    expect(screen.getByRole('heading', { name: 'سعد الشيخ علي' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Sign in' })).not.toBeInTheDocument()
  })
  it('adds notes and continuity text without claiming backend persistence', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    render(<App />)
    await userEvent.type(screen.getByLabelText('ملاحظة جديدة'), 'Practiced grounding exercises')
    await userEvent.click(screen.getByRole('button', { name: /Add Note/ }))
    expect(screen.getByText('Practiced grounding exercises')).toBeInTheDocument()
    await userEvent.type(
      screen.getByLabelText('Next Step / Continuity Note'),
      'Discuss sleep next time',
    )
    await userEvent.click(screen.getByRole('checkbox', { name: 'Clinical Follow-up Flag' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save and Update Next Session' }))
    expect(screen.getByRole('status')).toHaveTextContent('لم يُبلَّغ أي مشرف')
    await userEvent.click(screen.getByRole('button', { name: 'Back to Summary' }))
    expect(screen.getByText('Discuss sleep next time')).toBeInTheDocument()
  })
  it('creates new homework through the wizard and lands on the published library', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming?state=record')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: '+ Add New Homework' }))
    expect(window.location.pathname).toBe('/homework/create')
    await userEvent.type(screen.getByLabelText('Title'), 'Grounding practice')
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(window.location.pathname).toBe('/homework')
    expect(window.location.search).toBe('?state=published')
    expect(screen.getByRole('status')).toHaveTextContent('Homework published successfully.')
  })
  it('filters homework library rows by type and search then opens the preview details', async () => {
    window.history.replaceState({}, '', '/homework?state=list')
    render(<App />)
    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'Video')
    expect(screen.queryByText('نشاط يومي صغير')).not.toBeInTheDocument()
    expect(screen.getByText('تمرين التنفس اليومي')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'كل الأنواع')
    await userEvent.type(screen.getByLabelText('ابحث في قوالب الواجبات'), 'القلق')
    expect(screen.queryByText('تمرين التنفس اليومي')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /تمرين وقت القلق/ }))
    expect(window.location.search).toBe('?state=preview')
    expect(screen.getByRole('heading', { name: 'Template Details' })).toBeInTheDocument()
  })
  it('confirms demo deletion and returns to sessions', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'إجراءات الجلسة' }))
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('لن يُحذف أي سجل مريض')
    await userEvent.click(screen.getByRole('button', { name: 'Delete session' }))
    expect(window.location.pathname).toBe('/sessions')
  })
  it('opens a rescheduling form and updates local session metadata', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'إجراءات الجلسة' }))
    await userEvent.click(screen.getByRole('button', { name: 'Reschedule' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Patient'), 'مارك لوري')
    await userEvent.selectOptions(within(dialog).getByLabelText('Time'), '11:00')
    fireEvent.change(within(dialog).getByLabelText('Dated'), { target: { value: '2026-10-20' } })
    await userEvent.selectOptions(within(dialog).getByLabelText('Duration'), '60 دقيقة')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Schedule' }))
    expect(screen.getByText('2026-10-20 · 11:00 · 60 دقيقة · متابعة')).toBeInTheDocument()
  })
  it('does not claim to start a live meeting', async () => {
    window.history.replaceState({}, '', '/sessions/upcoming')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'بدء الجلسة' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('لا توجد خدمة اجتماعات مباشرة متصلة')
  })
})
