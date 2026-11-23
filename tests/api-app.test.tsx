import { act, fireEvent, render, screen } from '@testing-library/react'
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

  it.each(['/profile/approval', '/profile/documents'])(
    'redirects an approved therapist from %s to their dashboard after rechecking',
    async (path) => {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', path)
      let approved = false
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
        String(input).endsWith('/therapists/me/dashboard')
          ? approved
            ? json({
                therapist: { id: identity.id, full_name: identity.name, rating: 0, approval_status: 'approved' },
                stats: { pending: 0, confirmed: 0, completed: 0, today: 0 },
              })
            : json({ code: 'therapist_pending_approval', meta: { approval_status: 'pending' } }, 403)
          : json({ data: [], pagination: { last_page: 1 } }),
      )
      vi.stubGlobal('fetch', fetch)
      render(<App />)
      expect(await screen.findByRole('heading', { name: 'Your account is awaiting admin approval' })).toBeInTheDocument()
      approved = true
      fireEvent.click(screen.getByRole('button', { name: 'Check approval status' }))
      expect(await screen.findByRole('heading', { name: 'Upcoming Sessions' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/dashboard')
      expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()
    },
  )

  it.each(['pending', 'unavailable'])(
    'keeps a selected license attached while rechecking and after a %s result',
    async (result) => {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', '/profile/approval')
      const pending = () => json({
        code: 'therapist_pending_approval',
        meta: { approval_status: 'pending' },
      }, 403)
      let finishCheck!: (response: Response) => void
      vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(pending())
        .mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve })))
      render(<App />)
      const license = await screen.findByLabelText<HTMLInputElement>('License')
      const file = new File(['synthetic license'], 'license.pdf', { type: 'application/pdf' })
      fireEvent.change(license, { target: { files: [file] } })
      const check = screen.getByRole('button', { name: 'Check approval status' })
      fireEvent.click(check)
      expect(check).toBeDisabled()
      expect(screen.getByLabelText('License')).toBe(license)
      expect(license.files?.[0]).toBe(file)
      await act(async () => finishCheck(result === 'pending' ? pending() : json({}, 503)))
      expect(check).toBeEnabled()
      expect(screen.getByLabelText('License')).toBe(license)
      expect(license.files?.[0]).toBe(file)
      if (result === 'unavailable')
        expect(screen.getByRole('alert')).toHaveTextContent('Could not check approval status.')
    },
  )

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
