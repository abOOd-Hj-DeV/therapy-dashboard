import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/login')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = true
  })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (
    this: HTMLDialogElement,
  ) {
    this.open = false
  })
})
afterEach(() => {
  vi.useRealTimers()
})

describe('authentication demo', () => {
  it('disables login until email and password are valid', async () => {
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'invalid')
    await user.type(screen.getByLabelText('Password'), 'password123')
    expect(screen.getByRole('button', { name: 'Login' })).toBeDisabled()
    await user.clear(screen.getByLabelText('البريد الإلكتروني'))
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'therapist@example.com')
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled()
  })
  it('toggles password visibility without losing the value', async () => {
    const user = userEvent.setup()
    render(<App />)
    const password = screen.getByLabelText('Password')
    await user.type(password, 'password123')
    await user.click(screen.getByRole('button', { name: 'إظهار كلمة المرور' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(password).toHaveValue('password123')
    await user.click(screen.getByRole('button', { name: 'إخفاء كلمة المرور' }))
    expect(password).toHaveAttribute('type', 'password')
  })
  it('shows loading and navigates to the demo dashboard', () => {
    vi.useFakeTimers()
    render(<App />)
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), {
      target: { value: 'doctor@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(screen.getByRole('button', { name: 'جارٍ تسجيل الدخول…' })).toBeDisabled()
    act(() => vi.advanceTimersByTime(600))
    expect(screen.getByRole('heading', { name: 'لوحة التحكم' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })
  it('requires both names for signup and navigates to verification', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('link', { name: /أنشئ حساباً الآن!/ }))
    expect(screen.getByRole('heading', { name: 'أنشئ حسابك' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('البريد المهني'), 'doctor@example.com')
    await user.type(screen.getByLabelText('Password'), 'password123')
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    await user.type(screen.getByLabelText('First Name'), 'Jane')
    await user.type(screen.getByLabelText('Last Name'), 'Doe')
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Create' }))
    expect(await screen.findByRole('heading', { name: 'أرسلنا إليك بريداً للتو.' })).toBeInTheDocument()
    expect(screen.getByText('doctor@example.com')).toBeInTheDocument()
  })
  it('supports pasting all five OTP digits and rejects nondigits', async () => {
    window.history.replaceState({}, '', '/verify')
    const user = userEvent.setup()
    render(<App />)
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled()
    await user.type(screen.getByLabelText('الخانة 1 من الرمز'), 'x')
    expect(screen.getByLabelText('الخانة 1 من الرمز')).toHaveValue('')
    await user.click(screen.getByLabelText('الخانة 1 من الرمز'))
    await user.paste('34512')
    for (let i = 0; i < 5; i++)
      expect(screen.getByLabelText(`الخانة ${i + 1} من الرمز`)).toHaveValue('34512'[i])
    await user.click(screen.getByRole('button', { name: 'Verify' }))
    expect(screen.getByRole('heading', { name: 'لوحة التحكم' })).toBeInTheDocument()
  })
  it('reports resend as demo-only rather than claiming email was sent', async () => {
    window.history.replaceState({}, '', '/verify')
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }))
    expect(screen.getByRole('status')).toHaveTextContent('لا يُرسل بريد')
  })
  it('does not claim Google is connected', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('غير متصلة')
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق الحوار' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('cleans up pending login when the page changes', () => {
    vi.useFakeTimers()
    const view = render(<App />)
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), {
      target: { value: 'doctor@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    view.unmount()
    act(() => vi.advanceTimersByTime(1000))
    expect(window.location.pathname).toBe('/login')
  })
})

describe('therapist dashboard', () => {
  it.each(['/clients', '/clients/profile?id=demo-client'])('protects %s from fixture fallback outside demo mode', (path) => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    window.history.replaceState({}, '', path)
    render(<App />)
    expect(document.querySelector('input[name="password"]')).toBeInTheDocument()
    expect(screen.queryByText('أحمد محمد')).not.toBeInTheDocument()
    expect(screen.queryByText('سعد علي')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'إدارة العملاء' })).not.toBeInTheDocument()
  })
  beforeEach(() => window.history.replaceState({}, '', '/dashboard'))
  it('renders all seven sessions and four metrics', () => {
    render(<App />)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(8)
    expect(screen.getByRole('region', { name: 'إحصاءات العيادة' }).children).toHaveLength(4)
    expect(screen.getAllByText('جاهز')).toHaveLength(4)
    expect(screen.getAllByText('غير مؤكد')).toHaveLength(2)
    expect(screen.getByText('ملغاة')).toBeInTheDocument()
  })
  it('collapses and expands the sidebar', async () => {
    const { container } = render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'طي الشريط الجانبي' }))
    expect(container.firstChild).toHaveClass('is-collapsed')
    await userEvent.click(screen.getByRole('button', { name: 'توسيع الشريط الجانبي' }))
    expect(container.firstChild).not.toHaveClass('is-collapsed')
  })
  it('filters search results and shows no-results state', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByLabelText('ابحث في المرضى')
    await user.type(input, 'فا')
    const results = screen.getByLabelText('نتائج البحث')
    expect(within(results).getByText('فاطمة')).toBeInTheDocument()
    expect(within(results).getByText('فادي')).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'nonexistent')
    expect(screen.getByText('لم يُعثر على مرضى')).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('نتائج البحث')).not.toBeInTheDocument()
  })
  it('opens and dismisses notifications, and handles an invitation', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'الإشعارات' }))
    const panel = screen.getByRole('region', { name: 'الإشعارات' })
    expect(within(panel).getAllByRole('article')).toHaveLength(6)
    await userEvent.click(within(panel).getByRole('button', { name: 'قبول' }))
    expect(within(panel).getAllByRole('article')).toHaveLength(5)
    expect(within(panel).getByRole('status')).toHaveTextContent('قُبلت دعوة العرض التجريبي')
    await userEvent.click(screen.getByRole('button', { name: 'إغلاق الإشعارات' }))
    expect(screen.queryByRole('region', { name: 'الإشعارات' })).not.toBeInTheDocument()
  })
  it('opens meeting modal with a copyable URL and honest demo action', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Start session' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('رابط الاجتماع')).toHaveValue(
      'https://meet.google.com/kxx-eyzx-dew?author=0',
    )
    await userEvent.click(within(dialog).getByRole('button', { name: 'Join meeting' }))
    expect(within(dialog).getByRole('status')).toHaveTextContent('لا توجد خدمة اجتماعات مباشرة')
  })
  it('reacts to real offline and online events', () => {
    const getter = vi.spyOn(navigator, 'onLine', 'get')
    getter.mockReturnValue(true)
    render(<App />)
    getter.mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(screen.getByText(/You.re offline\. Some data may not be up to date\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeDisabled()
    getter.mockReturnValue(true)
    act(() => window.dispatchEvent(new Event('online')))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start session' })).toBeEnabled()
  })
  it('opens the newly supplied clients design and preserves its profile query route', async () => {
    render(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'المرضى' }))
    expect(screen.getByRole('heading', { name: 'إدارة العملاء' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'فتح ملف سعد علي التجريبي' }))
    expect(window.location.pathname).toBe('/clients/profile')
    expect(window.location.search).toBe('?id=demo-client')
    expect(screen.getByRole('heading', { name: 'أحمد محمد' })).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('complementary', { name: 'التنقل الرئيسي' })).getByRole('button', { name: 'المرضى' }))
    expect(screen.getByRole('heading', { name: 'إدارة العملاء' })).toBeInTheDocument()
  })
  it('honors direct links to design states', () => {
    window.history.replaceState({}, '', '/dashboard?state=meeting')
    render(<App />)
    expect(screen.getByRole('dialog', { name: 'هيّا ننضم إلى الاجتماع!' })).toBeInTheDocument()
  })
})
