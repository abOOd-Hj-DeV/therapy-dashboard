import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
    expect(screen.getByText('أفكار لإيذاء النفس')).toBeInTheDocument()
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
})
