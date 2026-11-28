import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DemoClients } from '../src/DemoClients'

const fixtures = [
  [
    'سعد علي',
    'قلق · 32 سنة',
    'يتقدّم جيداً',
    '40%',
    '139px',
    '7 sessions',
    '3 أكثر من الشهر الماضي',
    'الجمعة، 9:30 ص',
  ],
  [
    'جمال طومسون',
    'إرهاق · 29 سنة',
    'يحتاج مراجعة',
    '80%',
    '285px',
    '4 sessions',
    '1 أقل من الشهر الماضي',
    'الاثنين، 2:00 م',
  ],
  [
    'ياسر راميريز',
    'مزاج · 27 سنة',
    'على الموعد',
    '60%',
    '204px',
    '6 sessions',
    'مثل الشهر الماضي',
    'الأربعاء، 10:00 ص',
  ],
  [
    'إيثان كلارك',
    'ضغط · 30 سنة',
    'فاتته الجلسة السابقة',
    '13%',
    '31px',
    '5 sessions',
    '2 أقل من الشهر الماضي',
    'الخميس، 3:30 م',
  ],
  [
    'مايا باتيل',
    'قلق · 24 سنة',
    'على المسار',
    '60%',
    '204px',
    '8 sessions',
    'أعلى بـ1 عن الشهر الماضي',
    'الثلاثاء، 8:00 ص',
  ],
  [
    'نوح بينيت',
    'مزاج · 28 سنة',
    'على المسار',
    '60%',
    '204px',
    '5 sessions',
    '2 أكثر من الشهر الماضي',
    'السبت، 1:00 م',
  ],
] as const

function cards() {
  return within(screen.getByRole('region', { name: 'عملاء العرض' })).getAllByRole('button')
}

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  window.history.replaceState({}, '', '/clients')
})

describe('development-only client-list reference interactions (not visual validation)', () => {
  it.each([['DEV', false], ['VITE_DEMO_MODE', 'false']] as const)('does not expose fixtures when %s is disabled', (key, value) => {
    vi.stubEnv(key, value)
    const { container } = render(<DemoClients navigate={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('renders the six exact reference fixtures and source strip lengths independently of printed percentages', () => {
    render(<DemoClients navigate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'إدارة العملاء' })).toBeInTheDocument()
    expect(cards()).toHaveLength(6)
    fixtures.forEach(
      ([name, detail, status, percentage, stripWidth, sessions, change, date], index) => {
        const card = cards()[index]
        expect(card).toHaveAccessibleName(`فتح ملف ${name} التجريبي`)
        for (const text of [name, detail, status, percentage, sessions, change, date]) {
          expect(within(card).getByText(text)).toBeInTheDocument()
        }
        expect(card.style.getPropertyValue('--demo-client-list-strip-width')).toBe(stripWidth)
        expect(card.querySelector('img')?.getAttribute('src')).toMatch(
          /^\/assets\/preview-client-list-/,
        )
      },
    )
    expect(
      screen.getByRole('button', { name: 'تصفية حسب الالتزام' }),
    ).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByText(/عناصر تصميم تطويرية فقط\. البحث ومرشّحات الحالة تعمل محلياً؛ لا يوجد خادم connected\. Every card opens the separate Ahmed Mohamed reference profile, not a live record\./),
    ).toBeInTheDocument()
  })

  it('exposes the supplied compliance menu without inventing clinical filtering semantics', async () => {
    const user = userEvent.setup()
    render(<DemoClients navigate={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'تصفية حسب الالتزام' })
    await user.click(toggle)
    const options = within(screen.getByRole('region', { name: 'Compliance design options' }))
    expect(options.getByRole('button', { name: 'التزام عالٍ (80%+)' })).toBeDisabled()
    expect(options.getByRole('button', { name: 'التزام منخفض (أقل من 80%)' })).toBeDisabled()
    await user.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    await user.click(toggle)
    await user.click(within(screen.getByRole('region', { name: 'Compliance design options' })).getByRole('button', { name: 'All' }))
    expect(cards()).toHaveLength(6)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('filters All (6), Active (5), and Inactive (1) locally without network requests', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected demo request'))
    render(<DemoClients navigate={vi.fn()} />)
    const all = screen.getByRole('button', { name: 'All (6)' })
    const active = screen.getByRole('button', { name: 'Active (5)' })
    const inactive = screen.getByRole('button', { name: 'Inactive (1)' })
    expect(all).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(active)
    expect(active).toHaveAttribute('aria-pressed', 'true')
    expect(all).toHaveAttribute('aria-pressed', 'false')
    expect(cards()).toHaveLength(5)
    expect(screen.queryByText('إيثان كلارك')).not.toBeInTheDocument()
    fireEvent.click(inactive)
    expect(inactive).toHaveAttribute('aria-pressed', 'true')
    expect(cards()).toHaveLength(1)
    expect(within(cards()[0]).getByText('إيثان كلارك')).toBeInTheDocument()
    fireEvent.click(all)
    expect(cards()).toHaveLength(6)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('searches names case-insensitively through Workspace and composes search with the selected filter', () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected demo request'))
    render(<DemoClients navigate={vi.fn()} />)
    const search = screen.getByRole('textbox', { name: 'ابحث في المرضى' })
    fireEvent.change(search, { target: { value: '  tHoMpSoN  ' } })
    expect(cards()).toHaveLength(1)
    expect(within(cards()[0]).getByText('جمال طومسون')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Inactive (1)' }))
    expect(screen.getByRole('status')).toHaveTextContent('No demo clients found.')
    fireEvent.change(search, { target: { value: 'ETHAN' } })
    expect(cards()).toHaveLength(1)
    expect(within(cards()[0]).getByText('إيثان كلارك')).toBeInTheDocument()
    fireEvent.change(search, { target: { value: '' } })
    expect(cards()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'All (6)' }))
    expect(cards()).toHaveLength(6)
    fireEvent.change(search, { target: { value: 'not a fixture name' } })
    expect(screen.getByRole('status')).toHaveTextContent('No demo clients found.')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('preserves the exact demo-client query route for every card', () => {
    const navigate = vi.fn()
    render(<DemoClients navigate={navigate} />)
    cards().forEach((card) => fireEvent.click(card))
    expect(navigate.mock.calls).toEqual(fixtures.map(() => ['/clients/profile?id=demo-client']))
  })

  it('supports native keyboard activation of the reference card', async () => {
    const navigate = vi.fn()
    const user = userEvent.setup()
    render(<DemoClients navigate={navigate} />)
    cards()[0].focus()
    await user.keyboard('{Enter}')
    expect(navigate).toHaveBeenLastCalledWith('/clients/profile?id=demo-client')
  })
})
