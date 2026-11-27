import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'
import { RedFlags } from '../src/RedFlags'
import { Workspace } from '../src/Workspace'
import type { ApiClient } from '../src/api'

describe('therapist red flags', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    window.history.replaceState({}, '', '/red-flags')
  })

  it('shows the demo case and disables contact and decision actions', () => {
    render(<RedFlags navigate={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'حالات الخطر' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'مريم صالح' })).toBeInTheDocument()
    expect(screen.getByText('إشارة سلامة من تقييم')).toBeInTheDocument()
    expect(screen.getByText('الحساب معلّق')).toBeInTheDocument()
    expect(screen.getByText(/طلب إعادة تفعيل/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تواصل عبر واتساب' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'إعادة تفعيل الحساب' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'ملاحظة القرار' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'حفظ القرار' })).toBeDisabled()
    expect(screen.queryByText('demo-red-flag-001')).not.toBeInTheDocument()
  })

  it('links the shared workspace navigation to the page', () => {
    const navigate = vi.fn()
    render(
      <Workspace active="Dashboard" title="Dashboard" navigate={navigate}>
        <div />
      </Workspace>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'حالات الخطر' }))
    expect(navigate).toHaveBeenCalledWith('/red-flags')
  })

  it('labels manual, assessment and legacy safety flags without guessing from the type', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const data = ['manual_support', 'assessment', undefined, 'future_source'].map((source, index) => ({
      id: `source-${index}`,
      patient_name: `مريض ${index}`,
      type: 'safety',
      source,
      description: 'تفاصيل للمراجعة',
      priority: 'high',
      status: 'open',
      created_at: '2026-04-18T07:00:00Z',
      on_hold: false,
    }))
    const user = { id: 'therapist-id' }
    const api = {
      getUser: () => user,
      getSessionKey: () => 1,
      subscribe: () => () => undefined,
      get: vi.fn().mockResolvedValue({ data, pagination: { current_page: 1, last_page: 1, per_page: 4, total: 4 } }),
    } as unknown as ApiClient

    render(<RedFlags api={api} navigate={vi.fn()} />)
    expect(await screen.findByText('طلب دعم عاجل من التطبيق')).toBeInTheDocument()
    expect(screen.getByText('إشارة سلامة من تقييم')).toBeInTheDocument()
    expect(screen.getAllByText('بلاغ سلامة يحتاج إلى مراجعة')).toHaveLength(2)
    expect(screen.queryByText('أفكار لإيذاء النفس')).not.toBeInTheDocument()
  })

  it('uses row capabilities when the same held patient has a safety and a non-safety flag', async () => {
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const user = { id: 'therapist-id' }
    const flag = {
      id: 'safety', patient_name: 'مريض اختباري', type: 'safety',
      description: 'حالة للمراجعة', priority: 'high', status: 'open',
      created_at: '2026-04-18T07:00:00Z', on_hold: true,
      allowed_decisions: ['reactivate', 'keep_hold'],
    }
    const api = {
      getUser: () => user,
      getSessionKey: () => 1,
      subscribe: () => () => undefined,
      get: vi.fn().mockResolvedValue({
        data: [flag, { ...flag, id: 'other', type: 'low_mood', allowed_decisions: [] }],
        pagination: { current_page: 1, last_page: 1, per_page: 2, total: 2 },
      }),
    } as unknown as ApiClient

    render(<RedFlags api={api} navigate={vi.fn()} />)
    expect(await screen.findAllByText('الحساب معلّق')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'حفظ القرار' })).toHaveLength(1)
    expect(screen.getAllByRole('radio', { name: 'إعادة تفعيل الحساب' })).toHaveLength(1)
  })

  it('links the dashboard local navigation to the page', () => {
    const navigate = vi.fn()
    render(<Dashboard navigate={navigate} />)

    fireEvent.click(screen.getByRole('button', { name: 'حالات الخطر' }))
    expect(navigate).toHaveBeenCalledWith('/red-flags')
  })

  it('loads flags across every page reported by the API', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    const pageOne = {
      id: 'flag-page-one',
      patient_name: 'مريض الصفحة الأولى',
      patient_whatsapp: null,
      type: 'low_mood',
      description: 'درجة مرتفعة.',
      priority: 'medium' as const,
      status: 'open',
      created_at: '2026-04-18T07:00:00Z',
      therapist_name: 'د. سارة',
      assessment_score: 18,
      on_hold: false,
    }
    const pageTwo = { ...pageOne, id: 'flag-page-two', patient_name: 'مريض الصفحة الثانية' }
    const user = {
      id: 'therapist-id',
      name: 'د. سارة',
      email: null,
      whatsapp_number: '',
      role: 'therapist',
      is_active: true,
      phone_verified_at: '2026-01-01T00:00:00Z',
      timezone: 'Asia/Damascus',
    }
    const api = {
      getUser: () => user,
      getSessionKey: () => 1,
      subscribe: () => () => undefined,
      get: vi.fn((path: string) => Promise.resolve(
        path.includes('page=2')
          ? { data: [pageTwo], pagination: { current_page: 2, last_page: 2, per_page: 1, total: 2 } }
          : { data: [pageOne], pagination: { current_page: 1, last_page: 2, per_page: 1, total: 2 } },
      )),
    } as unknown as ApiClient

    render(<RedFlags api={api} navigate={vi.fn()} />)

    expect(await screen.findByRole('heading', { name: 'مريض الصفحة الثانية' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/therapists/red-flags?page=2', expect.any(AbortSignal))
  })

  it('does not restart slow remaining-page loads on the 15-second refresh interval', async () => {
    vi.useFakeTimers()
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEMO_MODE', 'false')
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const pageOne = {
      id: 'flag-page-one',
      patient_name: 'مريض الصفحة الأولى',
      patient_whatsapp: null,
      type: 'low_mood',
      description: 'درجة مرتفعة.',
      priority: 'medium' as const,
      status: 'open',
      created_at: '2026-04-18T07:00:00Z',
      therapist_name: 'د. سارة',
      assessment_score: 18,
      on_hold: false,
    }
    const pageTwo = { ...pageOne, id: 'flag-page-two', patient_name: 'مريض الصفحة الثانية' }
    const pageThree = { ...pageOne, id: 'flag-page-three', patient_name: 'مريض الصفحة الثالثة' }
    const secondPage = deferred<unknown>()
    const thirdPage = deferred<unknown>()
    const user = { id: 'therapist-id' }
    const api = {
      getUser: () => user,
      getSessionKey: () => 1,
      subscribe: () => () => undefined,
      get: vi.fn((path: string) => {
        if (path.includes('page=2')) return secondPage.promise
        if (path.includes('page=3')) return thirdPage.promise
        return Promise.resolve({
          data: [pageOne],
          pagination: { current_page: 1, last_page: 3, per_page: 1, total: 3 },
        })
      }),
    } as unknown as ApiClient

    render(<RedFlags api={api} navigate={vi.fn()} />)
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(api.get).toHaveBeenCalledTimes(2)

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(api.get).toHaveBeenCalledTimes(2)

    await act(async () => {
      secondPage.resolve({
        data: [pageTwo],
        pagination: { current_page: 2, last_page: 3, per_page: 1, total: 3 },
      })
      await secondPage.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(api.get).toHaveBeenCalledTimes(3)

    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(api.get).toHaveBeenCalledTimes(3)

    await act(async () => {
      thirdPage.resolve({
        data: [pageThree],
        pagination: { current_page: 3, last_page: 3, per_page: 1, total: 3 },
      })
      await thirdPage.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByRole('heading', { name: 'مريض الصفحة الثالثة' })).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledTimes(3)
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((yes) => { resolve = yes })
  return { promise, resolve }
}
