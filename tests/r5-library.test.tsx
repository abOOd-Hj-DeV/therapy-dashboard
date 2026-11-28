import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeworkLibrary } from '../src/HomeworkLibrary'

function go(url: string) {
  window.history.replaceState({}, '', url)
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  vi.stubEnv('VITE_DEMO_MODE', 'true')
  go('/homework')
})

describe('Homework Library — empty state', () => {
  it('renders the Figma empty library by default and via ?state=empty', () => {
    for (const url of ['/homework', '/homework?state=empty']) {
      go(url)
      const { unmount } = render(<HomeworkLibrary navigate={vi.fn()} />)
      expect(screen.getByRole('heading', { name: 'مكتبة الواجبات' })).toBeInTheDocument()
      expect(screen.getByText('لا توجد قوالب واجبات بعد')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Create New Homework/ }),
      ).toBeInTheDocument()
      expect(
        screen.getByText(/Manage, organize, and assign clinical homework resources/),
      ).toBeInTheDocument()
      expect(screen.getByLabelText('تصفية حسب الاحتياجات الإكلينيكية')).toBeInTheDocument()
      expect(screen.getByLabelText('Filter by type')).toBeInTheDocument()
      expect(screen.getByLabelText('ابحث في قوالب الواجبات')).toBeInTheDocument()
      unmount()
    }
  })

  it('marks Additional Content active in the shell', () => {
    render(<HomeworkLibrary navigate={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'المحتوى الإضافي' }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('routes Create New Homework to the wizard route in demo mode', async () => {
    const navigate = vi.fn()
    render(<HomeworkLibrary navigate={navigate} />)
    await userEvent.click(screen.getByRole('button', { name: /Create New Homework/ }))
    expect(navigate).toHaveBeenCalledWith('/homework/create')
  })
})

describe('Homework Library — populated list', () => {
  it('shows title/type/duration/patient rows via ?state=list', () => {
    go('/homework?state=list')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    expect(screen.getByText('نشاط يومي صغير')).toBeInTheDocument()
    expect(screen.getByText('تمرين التنفس اليومي')).toBeInTheDocument()
    expect(screen.getByText('12 د')).toBeInTheDocument()
    expect(screen.getByText('14 مرضى')).toBeInTheDocument()
    expect(screen.getByText('منشور v2')).toBeInTheDocument()
  })

  it('shows the publish success banner only via ?state=published', () => {
    go('/homework?state=published')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Homework published successfully.')
    expect(screen.getAllByText('لم يُدرج بعد').length).toBeGreaterThan(0)
  })

  it('accepts the published-success alias', () => {
    go('/homework?state=published-success')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    expect(screen.getByText('منشور v2')).toBeInTheDocument()
  })

  it('filters rows by type and search', async () => {
    go('/homework?state=list')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    const list = screen.getByLabelText('قوالب الواجبات')
    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'Video')
    expect(within(list).queryByText('نشاط يومي صغير')).not.toBeInTheDocument()
    expect(within(list).getByText('تمرين التنفس اليومي')).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Filter by type'), 'كل الأنواع')
    await userEvent.type(screen.getByLabelText('ابحث في قوالب الواجبات'), 'النوم')
    expect(within(list).getByText('يوميات النوم')).toBeInTheDocument()
    expect(within(list).queryByText('تمرين التنفس اليومي')).not.toBeInTheDocument()
  })

  it('opens a row onto the detail preview in demo mode', async () => {
    const navigate = vi.fn()
    go('/homework?state=list')
    render(<HomeworkLibrary navigate={navigate} />)
    await userEvent.click(screen.getByText('تمرين التنفس اليومي'))
    expect(navigate).toHaveBeenCalledWith('/homework?state=preview')
  })
})

describe('Homework Details — preview and no-patients', () => {
  it('renders the Content & Preview state via ?state=preview', () => {
    go('/homework?state=preview')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Daily Breathing Exercise' })).toBeInTheDocument()
    expect(screen.getByText('إجمالي مرات الإسناد')).toBeInTheDocument()
    expect(screen.getByText('48 مرة')).toBeInTheDocument()
    expect(screen.getByText('92.4%')).toBeInTheDocument()
    expect(screen.getByText('4.8 / 5')).toBeInTheDocument()
    expect(screen.getByText('فعّالة جداً')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'المحتوى والمعاينة' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'المرضى المسندون (14)' })).toBeInTheDocument()
    expect(screen.getByText('Template Details')).toBeInTheDocument()
    expect(screen.getByText('Patient Preview')).toBeInTheDocument()
    expect(screen.getByText('تمرين التنفس 7،8،9')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Click here to Upload new video file' }),
    ).toBeInTheDocument()
  })

  it('renders the المرضى المسندون (0) empty state via ?state=no-patients', () => {
    go('/homework?state=no-patients')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    expect(screen.getByText('0 مرات')).toBeInTheDocument()
    expect(screen.getByText('0.0%')).toBeInTheDocument()
    expect(screen.getByText('لا يوجد مرضى مسندون بعد')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Assign Homework Now' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'المرضى المسندون (0)' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('assign action shows the honest local notice, never a fabricated clinical op', async () => {
    go('/homework?state=no-patients')
    render(<HomeworkLibrary navigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Assign Homework Now' }))
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'معاينة تصميم محلية فقط — لا توجد خدمة واجبات متصلة.',
    )
  })

  it('back button returns to the library list in demo mode', async () => {
    const navigate = vi.fn()
    go('/homework?state=no-patients')
    render(<HomeworkLibrary navigate={navigate} />)
    await userEvent.click(screen.getByRole('button', { name: 'عودة إلى مكتبة الواجبات' }))
    expect(navigate).toHaveBeenCalledWith('/homework?state=list')
  })
})

describe('Homework Library — live mode honesty', () => {
  beforeEach(() => vi.stubEnv('VITE_DEMO_MODE', 'false'))

  it('ignores fixture states and stays on the truthful empty library', () => {
    for (const url of [
      '/homework?state=published',
      '/homework?state=preview',
      '/homework?state=no-patients',
      '/homework?state=list',
    ]) {
      go(url)
      const { unmount } = render(<HomeworkLibrary navigate={vi.fn()} />)
      expect(screen.getByText('لا توجد قوالب واجبات بعد')).toBeInTheDocument()
      expect(screen.queryByText('48 مرة')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('keeps mutating actions behind the shared unavailable notice in live mode', async () => {
    go('/homework')
    const api = { getUser: () => ({ name: 'Dr. Issa Alhadad' }) } as never
    render(<HomeworkLibrary navigate={vi.fn()} api={api} />)
    await userEvent.click(screen.getByRole('button', { name: /Create New Homework/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'هذه الميزة غير متاحة في API المعالج.',
    )
  })
})
