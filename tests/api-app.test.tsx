import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/App'
import { api } from '../src/api'
import { profileReview, validProfile } from './therapist-profile-fixtures'

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
    whatsapp_number: '+12025550107',
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
  const revision = {
    id: 'af04c10b-58cc-4372-a567-0e02b2c3d480',
    kind: 'initial',
    status: 'pending',
    submitted_at: '2026-11-27T12:00:00Z',
    data: validProfile,
  } as const
  const notSubmitted = profileReview({
    approval_status: null,
    account: { whatsapp_number: identity.whatsapp_number, email: null },
    published: {
      full_name: identity.name, job_title: null, specialty: null, bio: null, email: null,
      city: null, country: null, languages: [], years_of_experience: null,
    },
  })
  const pending = profileReview({ ...notSubmitted, approval_status: 'pending', pending_revision: revision })
  const requestedDocument = {
    id: revision.id, doc_type: 'certificate', status: 'requested', reason: null, review_note: null, accepts_upload: true,
  }
  const rejected = profileReview({
    ...notSubmitted, approval_status: 'rejected',
    last_review: {
      revision_id: revision.id, kind: 'initial', status: 'rejected',
      note: 'يرجى تحديث المسمى الوظيفي', reviewed_at: '2026-11-27T12:01:00Z',
    },
  })
  const isProfile = (input: RequestInfo | URL) => String(input).endsWith('/therapists/me/profile')
  const isSubmit = (input: RequestInfo | URL) => String(input).endsWith('/therapists/me/profile-submission')
  const change = (name: string, value: string) =>
    fireEvent.change(screen.getByLabelText(name), { target: { value } })

  it('finishes invitation activation before loading the professional profile', async () => {
    window.history.replaceState({}, '', '/activate')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
      if (String(input).endsWith('/auth/activate')) return json({ ...tokens, user: identity })
      if (isProfile(input)) return json({ data: { ...notSubmitted, lifecycle_state: 'awaiting_profile' } })
      return json({ data: [] })
    })
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(screen.getByRole('heading', { name: 'تفعيل دعوة المعالج' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
    change('رقم واتساب', identity.whatsapp_number)
    change('رمز التفعيل', 'ABCD1234')
    change('كلمة المرور الجديدة', 'synthetic password1')
    change('تأكيد كلمة المرور', 'synthetic password1')
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الحساب' }))

    expect(await screen.findByRole('heading', { name: 'أكمل ملفك المهني' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/profile/approval')
    expect(screen.queryByLabelText('رمز التفعيل')).not.toBeInTheDocument()
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument()
    expect(fetch.mock.calls.slice(0, 2).map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/v1/auth/activate', '/api/v1/therapists/me/profile',
    ])
  })

  it.each([
    ['invited', 'approved', 'فعّل حسابك'],
    ['suspended', 'approved', 'الحساب موقوف'],
    ['approved', null, 'أكمل ملفك المهني'],
    ['update_pending', 'pending', 'بانتظار الموافقة'],
  ] as const)('keeps /sessions closed for lifecycle %s with approval %s', async (lifecycle, approval, heading) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/sessions')
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      isProfile(input)
        ? json({ data: profileReview({ lifecycle_state: lifecycle, approval_status: approval }) })
        : json({ data: [] }),
    )
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    const title = await screen.findByRole('heading', { name: heading })
    expect(title.closest('main')).toHaveClass('visual-auth')
    expect(screen.queryByTestId('workspace')).not.toBeInTheDocument()
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/me/sessions'))).toBe(false)
    if (lifecycle === 'invited' || lifecycle === 'suspended') {
      expect(screen.queryByRole('textbox', { name: 'الاسم' })).not.toBeInTheDocument()
      expect(fetch).toHaveBeenCalledTimes(1)
    }
  })

  it.each(['/dashboard', '/sessions', '/clients', '/red-flags'])(
    'blocks a pending therapist who opens %s directly and shows the submitted profile',
    async (path) => {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', path)
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
        isProfile(input) ? json({ data: pending }) : json({}, 404),
      )
      vi.stubGlobal('fetch', fetch)
      render(<App />)
      const heading = await screen.findByRole('heading', { name: 'بانتظار الموافقة' })
      expect(heading.closest('main')).toHaveAttribute('dir', 'rtl')
      expect(screen.getByText(validProfile.job_title)).toBeInTheDocument()
      expect(screen.getByText(validProfile.email)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'تعديل الطلب' })).toBeInTheDocument()
      expect(fetch.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
        '/api/v1/therapists/me/profile', '/api/v1/therapists/me/documents', '/api/v1/meta/therapist-options',
      ])
      expect(screen.queryByRole('link', { name: 'المستندات المطلوبة' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'التحقق من حالة المراجعة' })).not.toBeInTheDocument()
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

  it('submits the initial profile without the read-only number or a requested licence', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/dashboard')
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      isProfile(input) ? json({ data: { ...notSubmitted, lifecycle_state: 'awaiting_profile' } }) :
        isSubmit(input) ? json({ data: { ...pending, lifecycle_state: 'pending_review' } }, 201) :
          String(input).endsWith('/me/documents') ? json({ data: [{ ...requestedDocument, doc_type: 'license' }] }) :
            json({}, 503),
    )
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'أكمل ملفك المهني' })).toBeInTheDocument()
    expect(screen.getByLabelText('الاسم')).toHaveValue(identity.name)
    expect(screen.getByLabelText('رقم الجوال')).toHaveAttribute('readonly')
    expect(screen.getByLabelText('رقم الجوال')).toHaveValue(identity.whatsapp_number)
    expect(await screen.findByRole('link', { name: 'المستندات المطلوبة' })).toBeInTheDocument()
    expect(document.querySelector('input[type="file"]')).not.toBeInTheDocument()
    const countries = Array.from(screen.getByLabelText<HTMLSelectElement>('البلد').options)
    expect(countries.slice(1).map((option) => option.value)).toEqual(
      'SY LB JO PS IQ SA AE QA KW BH OM YE EG SD LY TN DZ MA MR SO DJ KM TR DE GB US CA FR SE NL'.split(' '),
    )
    expect(countries[1]).toHaveTextContent('سوريا')
    const submit = screen.getByRole('button', { name: 'إرسال الملف للمراجعة' })
    fireEvent.click(submit)
    expect(screen.getByLabelText('سنوات الخبرة')).toHaveAttribute('aria-invalid', 'true')
    expect(fetch.mock.calls.some(([url]) => isSubmit(url))).toBe(false)

    change('الاسم', validProfile.full_name)
    change('المسمى الوظيفي', validProfile.job_title)
    change('التخصص', validProfile.specialty)
    change('النبذة التعريفية', validProfile.bio)
    change('البريد الإلكتروني', validProfile.email)
    change('المدينة', validProfile.city)
    change('البلد', validProfile.country)
    change('سنوات الخبرة', '0')
    const interaction = userEvent.setup()
    const languages = within(screen.getByRole('group', { name: 'اللغات' }))
    const arabic = languages.getByRole('checkbox', { name: 'العربية' })
    const english = languages.getByRole('checkbox', { name: 'الإنجليزية' })
    await interaction.click(arabic)
    await interaction.tab()
    expect(english).toHaveFocus()
    await interaction.keyboard(' ')
    expect(arabic).toBeChecked()
    expect(english).toBeChecked()
    fireEvent.click(submit)
    expect(await screen.findByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) => isSubmit(url))?.[1]?.body))).toEqual(validProfile)
  })

  it('keeps unsaved profile edits when visiting requested documents', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const draftTitle = 'مسمى وظيفي غير محفوظ'
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
      if (isProfile(input)) return json({ data: pending })
      if (String(input).endsWith('/me/documents')) return json({ data: [requestedDocument] })
      return json({}, 404)
    }))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'تعديل الطلب' }))
    change('المسمى الوظيفي', draftTitle)
    await userEvent.click(screen.getByRole('checkbox', { name: 'الفرنسية' }))

    fireEvent.click(screen.getByRole('link', { name: 'المستندات المطلوبة' }))
    expect(await screen.findByRole('heading', { name: 'المستندات المطلوبة' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'المسمى الوظيفي' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: 'العودة إلى الملف المهني' }))

    expect(screen.getByRole('textbox', { name: 'المسمى الوظيفي' })).toHaveValue(draftTitle)
    expect(screen.getByRole('checkbox', { name: 'العربية' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'الإنجليزية' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'الفرنسية' })).toBeChecked()
  })

  it('keeps requested documents accessible and uses the existing document upload endpoint', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/dashboard')
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
      if (isProfile(input)) return json({ data: pending })
      if (String(input).endsWith('/me/documents')) return json({
        data: [requestedDocument],
      })
      return json({ data: {} })
    })
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    fireEvent.click(await screen.findByRole('link', { name: 'المستندات المطلوبة' }))
    const field = await screen.findByLabelText('شهادة')
    const file = new File(['synthetic document'], 'certificate.pdf', { type: 'application/pdf' })
    fireEvent.change(field, { target: { files: [file] } })
    fireEvent.submit(screen.getByRole('button', { name: 'رفع المستند' }).closest('form')!)
    expect(await screen.findByText('تم إرسال المستند للمراجعة.')).toBeInTheDocument()
    const call = fetch.mock.calls.find(([url]) => String(url).endsWith(`/me/documents/${revision.id}/upload`))
    expect((call?.[1]?.body as FormData).get('file')).toEqual(file)
  })

  it('restores a protected route before rendering login and checks the self-profile', async () => {
    await api.establish({ ...tokens, user: identity })
    const key = window.sessionStorage.key(0)!
    api.clear()
    window.sessionStorage.setItem(key, tokens.refresh_token)
    window.history.replaceState({}, '', '/dashboard')
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ ...tokens, refresh_token: 's'.repeat(64) }))
      .mockResolvedValueOnce(json({ user: identity }))
      .mockResolvedValueOnce(json({ data: pending }))
      .mockResolvedValueOnce(json({}, 404)))
    render(<App />)
    expect(screen.getByText('جارٍ استعادة جلستك…')).toBeInTheDocument()
    expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
  })

  it('automatically opens the dashboard after approval on focus', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    let approved = false
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
      if (isProfile(input)) return json({ data: approved
        ? profileReview({ lifecycle_state: 'approved' })
        : profileReview({ ...pending, lifecycle_state: 'pending_review' }) })
      if (String(input).endsWith('/therapists/me/dashboard')) return json({
        therapist: { id: identity.id, full_name: identity.name, rating: 0, approval_status: 'approved' },
        stats: { pending: 0, confirmed: 0, completed: 0, today: 0 },
      })
      return json({ data: [], pagination: { last_page: 1 } })
    })
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
    approved = true
    fireEvent(window, new Event('focus'))
    expect(await screen.findByRole('heading', { name: 'Upcoming Sessions' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
    expect(screen.queryByLabelText('WhatsApp number')).not.toBeInTheDocument()
  })

  it('keeps the focused draft through rejection and approval arriving during editing', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    let review = profileReview({ ...pending, lifecycle_state: 'pending_review' })
    let profileRequests = 0
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
      if (isProfile(input)) {
        profileRequests++
        return json({ data: review })
      }
      if (String(input).endsWith('/therapists/me/dashboard')) return json({
        therapist: { id: identity.id, full_name: identity.name, rating: 0, approval_status: 'approved' },
        stats: { pending: 0, confirmed: 0, completed: 0, today: 0 },
      })
      return json({ data: [], pagination: { last_page: 1 } })
    }))
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'تعديل الطلب' }))
    const title = screen.getByLabelText('المسمى الوظيفي')
    const draft = 'مسمى وظيفي جديد'
    await userEvent.click(screen.getByRole('checkbox', { name: 'الفرنسية' }))
    title.focus()
    change('المسمى الوظيفي', draft)
    review = profileReview({ ...rejected, lifecycle_state: 'needs_changes' })
    await act(async () => { fireEvent(window, new Event('focus')) })
    expect(await screen.findByRole('heading', { name: 'الملف المهني يحتاج إلى تعديل' })).toBeInTheDocument()
    expect(screen.getByLabelText('المسمى الوظيفي')).toBe(title)
    expect(title).toHaveFocus()
    expect(title).toHaveValue(draft)

    review = profileReview({ lifecycle_state: 'approved' })
    await act(async () => { fireEvent(window, new Event('focus')) })
    expect(profileRequests).toBe(3)
    expect(await screen.findByRole('heading', { name: 'تم اعتماد ملفك المهني' })).toBeInTheDocument()
    expect(title).toHaveFocus()
    expect(title).toHaveValue(draft)
    expect(screen.getByRole('checkbox', { name: 'الفرنسية' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'إرسال التعديلات للمراجعة' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'إلغاء' }))
    expect(await screen.findByRole('heading', { name: 'Upcoming Sessions' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('allows an approved therapist with a pending profile update to open sessions', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/sessions')
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      isProfile(input) ? json({ data: profileReview({ lifecycle_state: 'update_pending' }) })
        : json({ data: [], pagination: { last_page: 1 } }),
    ))
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'All Sessions' })).toBeInTheDocument()
  })

  it.each([503, 403])('handles a self-profile refresh returning %s on the approved sessions page', async (status) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/sessions')
    let profileRequests = 0
    vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) => {
      if (!isProfile(input)) return json({ data: [], pagination: { last_page: 1 } })
      if (++profileRequests === 1) return json({ data: profileReview() })
      return json(status === 403
        ? { code: 'therapist_pending_approval', meta: { approval_status: 'pending' } }
        : {}, status)
    }))
    render(<App />)
    const heading = await screen.findByRole('heading', { name: 'All Sessions' })

    await act(async () => { fireEvent(window, new Event('focus')) })
    expect(profileRequests).toBe(2)

    if (status === 503) {
      expect(screen.getByRole('heading', { name: 'All Sessions' })).toBe(heading)
      expect(screen.queryByText(/تعذّر التحقق من حالة الموافقة/)).not.toBeInTheDocument()
    } else {
      expect(screen.queryByRole('heading', { name: 'All Sessions' })).not.toBeInTheDocument()
      expect(screen.getByRole('alert')).toHaveTextContent('تعذّر التحقق من حالة الموافقة')
    }
  })

  it('lets a pending therapist supersede the previous submission using its prefilled data', async () => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    const changed = 'اختصاصي العلاج النفسي'
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      isProfile(input) ? json({ data: pending }) : isSubmit(input) ? json({
        data: { ...pending, pending_revision: { ...revision, id: 'new-revision', data: { ...validProfile, job_title: changed } } },
      }, 201) : json({}, 404),
    )
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: 'تعديل الطلب' }))
    expect(screen.getByLabelText('المسمى الوظيفي')).toHaveValue(validProfile.job_title)
    change('المسمى الوظيفي', changed)
    fireEvent.click(screen.getByRole('button', { name: 'إعادة إرسال الطلب للمراجعة' }))
    expect(await screen.findByText(changed)).toBeInTheDocument()
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) => isSubmit(url))?.[1]?.body)))
      .toEqual({ ...validProfile, job_title: changed })
  })

  it('shows a new rejection reason and falls back to published data when the review has no profile', async () => {
    vi.useFakeTimers()
    try {
      await api.establish({ ...tokens, user: identity })
      window.history.replaceState({}, '', '/dashboard')
      let review = pending
      vi.stubGlobal('fetch', vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
        isProfile(input) ? json({ data: review }) : json({}, 404),
      ))
      await act(async () => { render(<App />) })
      expect(screen.getByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
      review = rejected
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
      expect(screen.getByText('يرجى تحديث المسمى الوظيفي')).toBeInTheDocument()
      expect(screen.getByLabelText('الاسم')).toHaveValue(notSubmitted.published.full_name)
      expect(screen.getByLabelText('المسمى الوظيفي')).toHaveValue('')
    } finally {
      vi.useRealTimers()
    }
  })

  it.each([true, false])('prefills a returning rejected therapist and allows resubmission (review data present: %s)', async (hasReviewData) => {
    await api.establish({ ...tokens, user: identity })
    window.history.replaceState({}, '', '/profile/approval')
    const submitted = { ...validProfile, full_name: 'Rejected Revision Name' }
    const review = {
      ...rejected,
      published: validProfile,
      last_review: { ...rejected.last_review, ...(hasReviewData && { data: submitted }) },
    }
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (input) =>
      isProfile(input) ? json({ data: review }) :
        isSubmit(input) ? json({ data: pending }, 201) : json({}, 404),
    )
    vi.stubGlobal('fetch', fetch)
    render(<App />)
    expect(await screen.findByText('يرجى تحديث المسمى الوظيفي')).toBeInTheDocument()
    const expected = hasReviewData ? submitted : validProfile
    expect(screen.getByLabelText('الاسم')).toHaveValue(expected.full_name)
    fireEvent.click(screen.getByRole('button', { name: 'إعادة إرسال الطلب للمراجعة' }))
    expect(await screen.findByRole('heading', { name: 'بانتظار الموافقة' })).toBeInTheDocument()
    expect(screen.queryByText('يرجى تحديث المسمى الوظيفي')).not.toBeInTheDocument()
    expect(JSON.parse(String(fetch.mock.calls.find(([url]) => isSubmit(url))?.[1]?.body))).toEqual(expected)
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
