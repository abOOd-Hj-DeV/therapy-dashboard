import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Dashboard } from '../src/Dashboard'
import { RedFlags } from '../src/RedFlags'
import { Workspace } from '../src/Workspace'

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
})
