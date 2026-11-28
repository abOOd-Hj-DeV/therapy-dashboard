import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../src/App'

function open(path: string) {
  window.history.replaceState({}, '', path)
  return render(<App />)
}
function dialog() {
  return within(screen.getByRole('dialog'))
}
beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/profile')
  vi.restoreAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
})

describe('profile and settings', () => {
  it('renders the profile details and provided fixtures', () => {
    open('/profile?state=constructor')
    expect(screen.getByRole('heading', { name: 'أحمد محمد' })).toBeInTheDocument()
    expect(screen.getAllByText('PSY-2024-1234')).toHaveLength(2)
    expect(screen.getByText('dr.khaled@example.com')).toBeInTheDocument()
  })
  it('navigates between the profile, settings and help routes', async () => {
    const user = userEvent.setup()
    open('/profile')
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    expect(window.location.pathname).toBe('/profile/settings')
    await user.click(screen.getByRole('button', { name: 'Help' }))
    expect(window.location.pathname).toBe('/profile/help')
    expect(screen.getByText('تحتاج مساعدة سريعة؟')).toBeInTheDocument()
  })
  it('discards cancelled profile edits', async () => {
    const user = userEvent.setup()
    open('/profile')
    await user.click(screen.getByRole('button', { name: 'Edit Profile' }))
    await user.clear(dialog().getByLabelText('Name'))
    await user.type(dialog().getByLabelText('Name'), 'Changed name')
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('heading', { name: 'أحمد محمد' })).toBeInTheDocument()
  })
  it('applies validated profile edits locally', async () => {
    const user = userEvent.setup()
    open('/profile?state=edit')
    await user.clear(dialog().getByLabelText('Name'))
    await user.type(dialog().getByLabelText('Name'), 'Dr. Sara')
    await user.click(dialog().getByRole('button', { name: 'حفظ التغييرات' }))
    expect(screen.getByRole('heading', { name: 'Dr. Sara' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('لا يوجد خادم متصل')
    await user.click(screen.getByRole('button', { name: 'Settings' }))
    await user.click(screen.getByRole('button', { name: 'Profile' }))
    expect(screen.getByRole('heading', { name: 'Dr. Sara' })).toBeInTheDocument()
  })
  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=password')
    await user.type(dialog().getByLabelText('كلمة المرور الحالية'), 'old-password')
    await user.type(dialog().getByLabelText('كلمة المرور الجديدة'), 'new-password')
    await user.type(dialog().getByLabelText('تأكيد كلمة المرور الجديدة'), 'different-password')
    await user.click(dialog().getByRole('button', { name: 'حفظ التغييرات' }))
    expect(screen.getByRole('alert')).toHaveTextContent('يجب أن تتطابق')
  })
  it('does not claim to change a real password', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=password')
    await user.type(dialog().getByLabelText('كلمة المرور الحالية'), 'old-password')
    await user.type(dialog().getByLabelText('كلمة المرور الجديدة'), 'new-password')
    await user.type(dialog().getByLabelText('تأكيد كلمة المرور الجديدة'), 'new-password')
    await user.click(dialog().getByRole('button', { name: 'حفظ التغييرات' }))
    expect(screen.getByRole('status')).toHaveTextContent('كلمة مرورك لم تتغير')
  })
  it('saves preferences but discards cancelled changes', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=preferences')
    await user.click(dialog().getByRole('switch', { name: 'رسائل جديدة من العملاء' }))
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(dialog().getByRole('switch', { name: 'رسائل جديدة من العملاء' })).toBeChecked()
    await user.click(dialog().getByRole('switch', { name: 'رسائل جديدة من العملاء' }))
    await user.click(dialog().getByRole('button', { name: 'حفظ التفضيلات' }))
    await user.click(screen.getByRole('button', { name: 'Notification Settings' }))
    expect(dialog().getByRole('switch', { name: 'رسائل جديدة من العملاء' })).not.toBeChecked()
  })
  it('rejects a working-hours end before the start', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=hours')
    fireEvent.change(dialog().getByLabelText('وقت بدء Saturday'), { target: { value: '17:00' } })
    fireEvent.change(dialog().getByLabelText('وقت انتهاء Saturday'), { target: { value: '09:00' } })
    await user.click(dialog().getByRole('button', { name: 'حفظ التفضيلات' }))
    expect(screen.getByRole('alert')).toHaveTextContent('بعد وقت البدء')
  })
  it('updates the working-day count after local save', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=hours')
    await user.click(dialog().getByRole('checkbox', { name: 'Saturday' }))
    await user.click(dialog().getByRole('button', { name: 'حفظ التفضيلات' }))
    expect(screen.getByRole('button', { name: /إدارة ساعات العمل/ })).toHaveTextContent('5 أيام')
  })
  it('adds and removes local holidays', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=holidays')
    await user.type(dialog().getByLabelText('Reason'), 'Travel')
    fireEvent.change(dialog().getByLabelText('From'), { target: { value: '2026-11-01' } })
    fireEvent.change(dialog().getByLabelText('To'), { target: { value: '2026-11-05' } })
    await user.click(dialog().getByRole('button', { name: 'إضافة إجازة' }))
    expect(dialog().getByText('Travel')).toBeInTheDocument()
    await user.click(dialog().getByRole('button', { name: 'إزالة Travel' }))
    expect(dialog().queryByText('Travel')).not.toBeInTheDocument()
  })
  it('renders FAQ content with disclosure controls', async () => {
    const user = userEvent.setup()
    open('/profile/help?state=faq')
    expect(dialog().getByText(/من صفحة العملاء، اضغط «إضافة عميل» وأدخل بياناته الأساسية ثم احفظ\./)).toBeInTheDocument()
    await user.click(dialog().getByText('كيف تُحتسب أرباحي؟'))
    expect(
      dialog()
        .getByText(/إرشاد تجريبي: تعرض المحفظة عينة من أرباح الجلسات والرصيد المتاح والسحوبات\. لا توجد خدمة أرباح مباشرة متصلة\./)
        .closest('details'),
    ).toHaveAttribute('open')
  })
  it('validates support fields without pretending to send email', async () => {
    const user = userEvent.setup()
    open('/profile/help?state=contact')
    await user.type(dialog().getByLabelText('Subject'), 'Help')
    await user.type(dialog().getByLabelText('Message'), 'Please help me')
    await user.click(dialog().getByRole('button', { name: 'Send' }))
    expect(screen.getByRole('status')).toHaveTextContent('لم تُرسل رسالة الدعم')
  })
  it('supports cancel and confirm for frontend logout', async () => {
    const user = userEvent.setup()
    open('/profile/settings?state=logout')
    await user.click(dialog().getByRole('button', { name: 'Cancel' }))
    expect(window.location.pathname).toBe('/profile/settings')
    await user.click(screen.getByRole('button', { name: 'Log Out' }))
    await user.click(dialog().getByRole('button', { name: 'Log out' }))
    expect(window.location.pathname).toBe('/login')
  })
})

describe('wallet and integration', () => {
  it('renders overview, earnings and withdrawals', async () => {
    const user = userEvent.setup()
    open('/wallet')
    expect(screen.getByRole('img', { name: /الأرباح الشهرية: كانون الثاني 6,200؛ شباط 7,800؛ آذار 8,500؛ نيسان 9,200؛ أيار 8,400/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Earnings' }))
    expect(screen.getByText('سارة علي')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Withdrawals' }))
    expect(screen.getAllByText('SA** **** **** 1234 · 1 May 2024')).toHaveLength(6)
  })
  it('previews Shamcash without moving money', async () => {
    const user = userEvent.setup()
    open('/wallet?state=shamcash')
    await user.type(dialog().getByLabelText('مبلغ السحب'), '750')
    await user.type(dialog().getByLabelText('رمز شام كاش'), 'demo-code')
    await user.click(dialog().getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status')).toHaveTextContent('750 ل.س عبر شام كاش')
    expect(screen.getByRole('status')).toHaveTextContent('لم يُنقل مال')
  })
  it('enforces withdrawal amount limits', () => {
    open('/wallet?state=shamcash')
    const amount = dialog().getByLabelText('مبلغ السحب') as HTMLInputElement
    fireEvent.change(amount, { target: { value: '499' } })
    expect(amount.validity.rangeUnderflow).toBe(true)
    fireEvent.change(amount, { target: { value: '12501' } })
    expect(amount.validity.rangeOverflow).toBe(true)
  })
  it('switches method-specific payment fields', async () => {
    const user = userEvent.setup()
    open('/wallet?state=shamcash')
    await user.selectOptions(dialog().getByLabelText('اختر طريقة الدفع'), 'haram')
    expect(dialog().queryByLabelText('رمز شام كاش')).not.toBeInTheDocument()
    await user.type(dialog().getByLabelText('الاسم الكامل'), 'Demo User')
    await user.type(dialog().getByLabelText('رقم الجوال'), '+963 999')
    await user.type(dialog().getByLabelText('Location'), 'Damascus')
    await user.type(dialog().getByLabelText('مبلغ السحب'), '1000')
    await user.click(dialog().getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('status')).toHaveTextContent('عبر الحرم')
  })
  it('shows offline feedback on new routes', () => {
    open('/wallet')
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    fireEvent(window, new Event('offline'))
    expect(screen.getByText(/أنت غير متصل/)).toBeInTheDocument()
    online.mockReturnValue(true)
    fireEvent(window, new Event('online'))
    expect(screen.queryByText(/أنت غير متصل\. قد لا تكون بعض البيانات محدّثة\./)).not.toBeInTheDocument()
  })
  it('opens wallet from the original dashboard', async () => {
    const user = userEvent.setup()
    open('/dashboard')
    await user.click(
      within(screen.getByRole('complementary', { name: 'التنقل الرئيسي' })).getByRole('button', {
        name: 'المحفظة',
      }),
    )
    expect(window.location.pathname).toBe('/wallet')
    expect(screen.getByRole('region', { name: 'Wallet details' })).toBeInTheDocument()
  })
  it('opens the supplied profile from the chat workspace', async () => {
    const user = userEvent.setup()
    open('/chats')
    await user.click(screen.getByRole('button', { name: 'فتح الملف الشخصي' }))
    expect(window.location.pathname).toBe('/profile')
    expect(screen.getByRole('heading', { name: 'أحمد محمد' })).toBeInTheDocument()
  })
})
