import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { api } from '../src/api'

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false')
  api.clear()
})
afterEach(() => {
  api.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('live routing boundaries', () => {
  const identity = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Invited Therapist',
    email: null,
    whatsapp_number: '+963983321260',
    role: 'therapist',
    is_active: true,
    phone_verified_at: '2026-01-01T00:00:00Z',
    timezone: 'UTC',
  }
  const tokens = {
    access_token: 'test-access',
    refresh_token: 'r'.repeat(64),
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
    token_type: 'Bearer' as const,
  }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  it.each([
    ['pending', '/dashboard', 'Your account is awaiting admin approval'],
    ['rejected', '/sessions', 'Your account was not approved'],
    ['suspended', '/clients', 'Your account is suspended'],
  ])('gates %s on %s and links to working onboarding before calling operational routes', async (status, path, message) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', path)
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({
        code: 'therapist_pending_approval',
        meta: { approval_status: status },
      }, 403))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({ data: {} }))
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByRole('heading', { name: message })).toBeInTheDocument()
    expect(screen.getByText(`Status: ${status}`)).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toEqual(expect.stringMatching(/\/therapists\/me\/dashboard$/))
    fireEvent.click(screen.getByRole('link', { name: 'Requested documents' }))
    expect(await screen.findByText('No documents have been requested.')).toBeInTheDocument()
    expect(fetch.mock.calls[1][0]).toEqual(expect.stringMatching(/\/therapists\/me\/documents$/))
    fireEvent.click(screen.getByRole('link', { name: 'Profile settings' }))
    fireEvent.change(screen.getByLabelText('Specialty'), { target: { value: 'Trauma care' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save profile settings' }))
    expect(await screen.findByText('Profile settings saved.')).toBeInTheDocument()
    expect(fetch.mock.calls[2][0]).toEqual(expect.stringMatching(/\/therapists\/me\/settings$/))
    expect(fetch.mock.calls[2][1]).toMatchObject({ method: 'PUT', body: '{"specialty":"Trauma care"}' })
    expect(screen.getByRole('link', { name: 'Submit for approval' })).toHaveAttribute('href', '/profile/approval')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('restores a protected route before rendering login and handles the legacy approval response', async () => {
    await api.establish({ ...tokens, user: identity })
    const key = window.sessionStorage.key(0)!
    api.clear()
    window.sessionStorage.setItem(key, tokens.refresh_token)
    window.history.replaceState({}, '', '/dashboard')
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ ...tokens, refresh_token: 's'.repeat(64) }))
      .mockResolvedValueOnce(json({ user: identity }))
      .mockResolvedValueOnce(json({ message: 'Your therapist profile has not been approved yet.' }, 403)))
    render(<App />)
    expect(screen.getByText('Restoring your session…')).toBeInTheDocument()
    expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Your account is awaiting admin approval' })).toBeInTheDocument()
  })

  it.each(['/dashboard', '/sessions', '/chats', '/clients', '/profile/settings', '/wallet'])(
    'requires a real session for a direct %s link',
    (path) => {
      window.history.replaceState({}, '', path + '?state=withdraw&demo=true')
      const request = vi.spyOn(api, 'request')
      render(<App />)
      expect(screen.getByLabelText('WhatsApp number')).toBeInTheDocument()
      expect(screen.queryByText('Lifetime net earnings')).not.toBeInTheDocument()
      expect(request).not.toHaveBeenCalled()
    },
  )
  it('does not enable demo bypass in a production build even with the demo variable set', () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    window.history.replaceState({}, '', '/dashboard')
    render(<App />)
    expect(screen.getByLabelText('WhatsApp number')).toBeInTheDocument()
  })
})
