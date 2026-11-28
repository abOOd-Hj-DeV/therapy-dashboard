import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { Modal } from '../src/ui'
import { Wallet } from '../src/Wallet'

vi.mock('../src/Workspace', () => ({
  Workspace: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

beforeEach(() => window.history.replaceState({}, '', '/wallet?state=withdraw'))

describe('dialog dismissal pointer origin', () => {
  it('does not dismiss a dialog when a click started inside before content recentered', () => {
    const close = vi.fn()
    render(<Modal title="Example" onClose={close}>Content</Modal>)
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Example' }))
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(close).not.toHaveBeenCalled()
    fireEvent.pointerDown(dialog)
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(close).toHaveBeenCalledOnce()
  })

  it('preserves Al-Haram fields and amount when dismissing the recentering payment popup', () => {
    render(<Wallet navigate={vi.fn()} />)
    const combo = screen.getByRole('combobox', { name: 'طريقة الدفع' })
    fireEvent.click(combo)
    fireEvent.click(screen.getByRole('option', { name: 'تحويل الحرم' }))
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'Demo Person' } })
    fireEvent.change(screen.getByLabelText('رقم الجوال'), { target: { value: '+963999999999' } })
    fireEvent.change(screen.getByLabelText('مبلغ السحب'), { target: { value: '750' } })
    fireEvent.click(combo)
    const dialog = screen.getByRole('dialog')
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'طلب سحب' }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('الاسم الكامل')).toHaveValue('Demo Person')
    expect(screen.getByLabelText('رقم الجوال')).toHaveValue('+963999999999')
    expect(screen.getByLabelText('مبلغ السحب')).toHaveValue(750)
    fireEvent.pointerDown(dialog)
    fireEvent.pointerUp(dialog)
    fireEvent.click(dialog)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps close-button and native cancel dismissal working', () => {
    const close = vi.fn()
    render(<Modal title="Example" onClose={close}>Content</Modal>)
    fireEvent.click(screen.getByRole('button', { name: 'إغلاق الحوار' }))
    expect(close).toHaveBeenCalledOnce()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }))
    expect(close).toHaveBeenCalledTimes(2)
  })
})
