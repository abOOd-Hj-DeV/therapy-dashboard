import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { api } from '../src/api'

beforeEach(() => {
  vi.stubEnv('VITE_DEMO_MODE', 'false')
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
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
  const approvalError = (status: string | null, note?: string) => json({
    code: 'therapist_pending_approval',
    meta: { approval_status: status, approval_note: note },
  }, 403)
  const licenseField = 'ترخيص مزاولة المهنة'
  const attach = (file = new File(['synthetic license'], 'license.pdf', { type: 'application/pdf' })) => {
    fireEvent.change(screen.getByLabelText(licenseField), { target: { files: [file] } })
    return file
  }

  it.each(['/dashboard', '/sessions', '/clients', '/red-flags'])(
    'blocks a pending therapist who opens %s directly',
    async (path) => {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', path)
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(approvalError('pending'))
      vi.stubGlobal('fetch', fetch)
      render(<App />)
      const heading = await screen.findByRole('heading', { name: 'بانتظار الموافقة' })
      expect(heading.closest('main')).toHaveAttribute('dir', 'rtl')
      expect(screen.getByText('الحالة: بانتظار الموافقة')).toBeInTheDocument()
      expect(screen.queryByLabelText(licenseField)).not.toBeInTheDocument()
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch.mock.calls[0][0]).toEqual(expect.stringMatching(/\/therapists\/me\/dashboard$/))
    },
  )

  it.each([503, 403])('keeps dashboard routes closed when approval cannot be verified (%s)', async (status) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/red-flags')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json({}, status))
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر التحقق من حالة الموافقة')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('lets a therapist sign out when the approval check persistently returns a generic 403', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/login')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      String(input).endsWith('/auth/logout') ? json({}) : json({}, 403),
    )
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر التحقق من حالة الموافقة')
    expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الخروج' }))
    expect(await screen.findByLabelText('WhatsApp number')).toBeInTheDocument()
    expect(api.getUser()).toBeNull()
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/auth\/logout$/), expect.objectContaining({ method: 'POST' }))
  })

  it('warns on the mounted login screen when server revocation fails after local sign-out', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/login')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    let finishLogout!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      String(input).endsWith('/auth/logout')
        ? new Promise((resolve) => { finishLogout = resolve })
        : json({}, 403),
    ))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'تسجيل الخروج' }))
    const phone = await screen.findByLabelText('WhatsApp number')
    expect(api.getUser()).toBeNull()
    expect(screen.queryByText(/Server revocation could not be confirmed/)).not.toBeInTheDocument()

    await act(async () => finishLogout(json({}, 503)))
    expect(window.location.search).toBe('?logout=revocation-unknown')
    expect(screen.getByText(/Server revocation could not be confirmed/)).toBeInTheDocument()
    expect(screen.getByLabelText('WhatsApp number')).toBe(phone)
  })

  it('shows the not-submitted license form and links to working document and profile settings', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/dashboard')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(approvalError(null))
      .mockResolvedValueOnce(json({ data: [] }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ data: {} }))
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'لم يُرسل الطلب' })).toBeInTheDocument()
    expect(screen.getByText('الحالة: لم يُرسل الطلب')).toBeInTheDocument()
    expect(screen.getByLabelText(licenseField)).toBeRequired()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toEqual(expect.stringMatching(/\/therapists\/me\/dashboard$/))
    fireEvent.click(screen.getByRole('link', { name: 'المستندات المطلوبة' }))
    expect(await screen.findByText('لا توجد مستندات مطلوبة.')).toBeInTheDocument()
    expect(fetch.mock.calls[1][0]).toEqual(expect.stringMatching(/\/therapists\/me\/documents$/))
    fireEvent.click(screen.getByRole('link', { name: 'إعدادات الملف الشخصي' }))
    const countries = Array.from(screen.getByLabelText<HTMLSelectElement>('البلد').options)
    expect(countries.slice(1).map((option) => option.value)).toEqual(
      'SY LB JO PS IQ SA AE QA KW BH OM YE EG SD LY TN DZ MA MR SO DJ KM TR DE GB US CA FR SE NL'.split(' '),
    )
    expect(countries[1]).toHaveTextContent('سوريا')
    fireEvent.change(screen.getByLabelText('التخصص'), { target: { value: 'anxiety' } })
    fireEvent.click(screen.getByRole('button', { name: 'حفظ إعدادات الملف الشخصي' }))
    expect(await screen.findByText('تم حفظ إعدادات الملف الشخصي.')).toBeInTheDocument()
    expect(fetch.mock.calls[2][0]).toEqual(expect.stringMatching(/\/meta\/therapist-options$/))
    expect(fetch.mock.calls[3][0]).toEqual(expect.stringMatching(/\/therapists\/me\/settings$/))
    expect(fetch.mock.calls[3][1]).toMatchObject({ method: 'PUT', body: '{"specialty":"anxiety"}' })
    expect(screen.getByRole('link', { name: 'إرسال طلب الموافقة' })).toHaveAttribute('href', '/profile/approval')
    expect(fetch).toHaveBeenCalledTimes(4)
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
    expect(screen.getByText('جارٍ استعادة جلستك…')).toBeInTheDocument()
    expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
  })

  it.each(['/profile/approval', '/profile/documents'])(
    'automatically redirects an approved therapist from %s to their dashboard on focus',
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
      expect(await screen.findByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
      approved = true
      fireEvent(window, new Event('focus'))
      expect(await screen.findByRole('heading', { name: 'Upcoming Sessions' })).toBeInTheDocument()
      expect(window.location.pathname).toBe('/dashboard')
      expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()
    },
  )

  it('shows a new rejection reason when the background approval poll runs', async () => {
    vi.useFakeTimers()
    try {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', '/dashboard')
      vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(approvalError('pending'))
        .mockResolvedValueOnce(approvalError('rejected', 'الترخيص منتهي الصلاحية')))
      await act(async () => { render(<App />) })
      expect(screen.getByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()

      await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
      expect(screen.getByText('الترخيص منتهي الصلاحية')).toBeInTheDocument()
      expect(screen.getByLabelText(licenseField)).toBeRequired()
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([
    ['rejected', 'لم تتم الموافقة على طلبك', 'مرفوض'],
    ['suspended', 'معلّق', 'معلّق'],
  ])('shows the server’s %s decision after the therapist resubmits a license', async (status, heading, label) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    let finishCheck!: (response: Response) => void
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(approvalError('rejected', 'يرجى رفع نسخة واضحة من الترخيص'))
      .mockResolvedValueOnce(json({ data: { approval_status: 'pending' } }, 202))
      .mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve }))
    vi.stubGlobal('fetch', fetch)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'لم تتم الموافقة على طلبك' })).toBeInTheDocument()
    expect(screen.getByText('يرجى رفع نسخة واضحة من الترخيص')).toBeInTheDocument()
    const file = attach()
    fireEvent.submit(screen.getByRole('button', { name: 'إعادة الإرسال للمراجعة' }).closest('form')!)
    expect(await screen.findByText('تم إرسال طلبك للمراجعة.')).toBeInTheDocument()
    expect(screen.getByText('الحالة: بانتظار الموافقة')).toBeInTheDocument()
    expect(screen.queryByText('يرجى رفع نسخة واضحة من الترخيص')).not.toBeInTheDocument()
    const [route, request] = fetch.mock.calls[1]
    expect(route).toEqual(expect.stringMatching(/\/therapists\/me\/approval$/))
    expect(request?.method).toBe('POST')
    expect((request?.body as FormData).get('license')).toBe(file)

    await act(async () => finishCheck(approvalError(status, 'ملاحظة جديدة')))
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
    expect(screen.getByText(`الحالة: ${label}`)).toBeInTheDocument()
    if (status === 'rejected') expect(screen.getByText('ملاحظة جديدة')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it.each(['not submitted', 'unavailable'])(
    'keeps a selected license attached while rechecking and after a %s result',
    async (result) => {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', '/profile/approval')
      let finishCheck!: (response: Response) => void
      vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
        .mockResolvedValueOnce(approvalError(null))
        .mockImplementationOnce(() => new Promise((resolve) => { finishCheck = resolve })))
      render(<App />)
      const license = await screen.findByLabelText<HTMLInputElement>(licenseField)
      const file = attach()
      const check = screen.getByRole('button', { name: 'التحقق من حالة الموافقة' })
      fireEvent.click(check)
      expect(check).toBeDisabled()
      expect(screen.getByLabelText(licenseField)).toBe(license)
      expect(license.files?.[0]).toBe(file)
      await act(async () => finishCheck(result === 'not submitted' ? approvalError(null) : json({}, 503)))
      expect(check).toBeEnabled()
      expect(screen.getByLabelText(licenseField)).toBe(license)
      expect(license.files?.[0]).toBe(file)
      if (result === 'unavailable')
        expect(screen.getByRole('alert')).toHaveTextContent('تعذّر التحقق من حالة الموافقة.')
    },
  )

  it.each([
    ['license.txt', 'text/plain', 1, 'نوع الملف غير مدعوم'],
    ['license.pdf', 'application/pdf', 5 * 1024 * 1024 + 1, 'حجم الملف يتجاوز الحد'],
  ])('rejects an invalid license before uploading: %s', async (name, type, size, message) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(approvalError(null))
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    const submit = await screen.findByRole('button', { name: 'إرسال الطلب للمراجعة' })
    attach(new File([new Uint8Array(size)], name, { type }))
    fireEvent.submit(submit.closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    [413, 'حجم الملف يتجاوز الحد'],
    [415, 'نوع الملف غير مدعوم'],
    [429, 'تم إرسال طلبات كثيرة'],
    [0, 'تعذّر الاتصال بالخادم'],
  ])('explains an upload failure in Arabic (%s)', async (status, message) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(approvalError(null))
    if (status) fetch.mockResolvedValueOnce(json({ message: 'Internal detail' }, status))
    else fetch.mockRejectedValueOnce(new TypeError('Network unavailable'))
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    const submit = await screen.findByRole('button', { name: 'إرسال الطلب للمراجعة' })
    const file = attach()
    fireEvent.submit(submit.closest('form')!)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(screen.getByLabelText<HTMLInputElement>(licenseField).files?.[0]).toBe(file)
    expect(submit).toBeEnabled()
    expect(fetch).toHaveBeenCalledTimes(2)
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
