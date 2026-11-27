import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { ApiClient, type ApiSession } from '../src/api'
import { Profile } from '../src/Profile'
import { profileReview, validProfile } from './therapist-profile-fixtures'

// Keep these tests focused on this domain while verifying Workspace receives api.
vi.mock('../src/Workspace', () => ({
  Workspace: ({ children, api }: { children: ReactNode; api?: ApiClient }) => (
    <main data-testid="workspace" data-live={!!api}>
      {children}
    </main>
  ),
}))
const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const periodId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const revisionA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const revisionB = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const user = {
  id: userId,
  name: 'Real Account Name',
  email: 'real@example.test',
  whatsapp_number: '+123456789',
  role: 'therapist',
  is_active: true,
  phone_verified_at: '2026-01-01T00:00:00Z',
  timezone: 'Asia/Amman',
}
const therapist = {
  id: userId,
  full_name: 'Real Professional Name',
  specialty: 'Counselling',
  country: 'Jordan',
  languages: ['ar', 'en'],
  bio: 'Actual biography',
  rating: 4.2,
  approval_status: 'approved',
  has_license: true,
  availability: { monday: ['09:00-12:00', '13:00-17:00'], tuesday: ['10:00-11:00'] },
}
const dashboard = {
  therapist,
  clients_count: 7,
  stats: { pending: 2, confirmed: 3, completed: 12, today: 1 },
  timezone: 'Asia/Amman',
}
function session(actor = user): ApiSession {
  return {
    user: actor,
    access_token: 'test-memory-only-access',
    refresh_token: 'x'.repeat(64),
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
type Call = {
  path: string
  method: string
  body: Record<string, unknown> | undefined
  headers: Headers
  signal: AbortSignal | null | undefined
}
type Handler = (call: Call) => Response | Promise<Response> | undefined
async function client(handler?: Handler) {
  const calls: Call[] = []
  const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = {
      path: String(input).replace('https://api.example.test/api/v1', ''),
      method: init?.method || 'GET',
      body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
      headers: new Headers(init?.headers),
      signal: init?.signal,
    }
    calls.push(call)
    const result = handler?.(call)
    if (result !== undefined) return await result
    if (call.path === '/auth/user') return json({ user, roles: ['therapist'] })
    if (call.path === '/therapists/me/dashboard') return json(dashboard)
    if (call.path === '/therapists/me/profile') return json({ data: profileReview() })
    if (call.path === '/therapists/me/blocked-periods' && call.method === 'GET')
      return json({ data: [] })
    throw new Error('Unexpected test request')
  })
  const api = new ApiClient('https://api.example.test/api/v1', transport)
  await api.establish(session())
  return { api, calls }
}
function modal() {
  return within(screen.getByRole('dialog'))
}
function change(label: string, value: string) {
  fireEvent.change(modal().getByLabelText(label), { target: { value } })
}
async function loaded() {
  await screen.findByRole('heading', { name: 'Real Professional Name' })
}
const withdrawalSuccess = 'تم سحب التعديلات. لم يتغيّر الملف المنشور.'
function pendingProfile(id: string) {
  return profileReview({
    lifecycle_state: 'update_pending',
    pending_revision: {
      id, kind: 'update', status: 'pending', submitted_at: '2026-11-27T12:00:00Z',
      data: { ...validProfile, full_name: 'Unpublished Name' },
    },
  })
}
beforeEach(() => {
  window.history.replaceState({}, '', '/profile')
  vi.restoreAllMocks()
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})

describe('live Profile API integration', () => {
  it('loads account identity before dashboard, reports permission errors and never substitutes demo data', async () => {
    const identity = deferred<Response>()
    const { api, calls } = await client((call) =>
      call.path === '/auth/user'
        ? identity.promise
        : call.path === '/therapists/me/dashboard'
          ? json({ message: 'private backend exception' }, 403)
          : call.path === '/therapists/me/profile'
            ? deferred<Response>().promise
          : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    expect(screen.getByText('Loading profile…')).toBeInTheDocument()
    expect(calls.map((call) => call.path)).toEqual(['/auth/user'])
    await act(async () => identity.resolve(json({ user, roles: ['therapist'] })))
    expect(await screen.findByRole('alert')).toHaveTextContent('not permitted')
    expect(screen.getAllByText('Professional profile unavailable.').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'تعديل الملف الشخصي' })).toBeDisabled()
    expect(screen.queryByText('Ahmed Mohamed')).not.toBeInTheDocument()
    expect(screen.queryByText('Age 28 · Male')).not.toBeInTheDocument()
    expect(screen.queryByText('private backend exception')).not.toBeInTheDocument()
    expect(screen.getByTestId('workspace')).toHaveAttribute('data-live', 'true')
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('submits all reviewed fields and shows a pending banner without publishing the draft', async () => {
    const interaction = userEvent.setup()
    const submitted = { ...validProfile, specialty: 'trauma', country: 'DE', languages: ['ku', 'de'] }
    const pendingRevision = {
      id: periodId, kind: 'update', status: 'pending', submitted_at: '2026-11-27T12:00:00Z', data: submitted,
    } as const
    let review = profileReview()
    const { api, calls } = await client((call) => {
      if (call.method === 'POST' && call.path.endsWith('/profile-submission')) {
        review = profileReview({ lifecycle_state: 'update_pending', pending_revision: pendingRevision })
        return json({ data: review }, 201)
      }
      if (call.path === '/therapists/me/profile') return json({ data: review })
    })
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الملف الشخصي' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', 'rtl')
    expect(modal().getByLabelText('الاسم')).toHaveValue(validProfile.full_name)
    expect(modal().getByLabelText('البريد الإلكتروني')).toHaveValue(validProfile.email)
    expect(modal().getByLabelText('رقم الجوال')).toHaveAttribute('readonly')
    change('التخصص', 'trauma')
    change('البلد', 'DE')
    const languages = within(modal().getByRole('group', { name: 'اللغات' }))
    await interaction.click(languages.getByRole('checkbox', { name: 'العربية' }))
    await interaction.click(languages.getByRole('checkbox', { name: 'الإنجليزية' }))
    await interaction.click(languages.getByRole('checkbox', { name: 'الكردية' }))
    await interaction.tab()
    expect(languages.getByRole('checkbox', { name: 'الألمانية' })).toHaveFocus()
    await interaction.keyboard(' ')
    expect(languages.getByRole('checkbox', { name: 'الكردية' })).toBeChecked()
    expect(languages.getByRole('checkbox', { name: 'الألمانية' })).toBeChecked()
    fireEvent.click(modal().getByRole('button', { name: 'إرسال التعديلات للمراجعة' }))
    expect(await screen.findByText(/تعديلات ملفك المهني بانتظار المراجعة/)).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST')).toMatchObject({
      path: '/therapists/me/profile-submission', body: submitted,
    })
    expect(screen.getByText('الأردن')).toBeInTheDocument()
    expect(screen.queryByText('ألمانيا')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'تعديل الملف الشخصي' }))
    expect(modal().getByLabelText('البلد')).toHaveValue('DE')
    fireEvent.click(modal().getByRole('button', { name: 'إلغاء' }))
    review = profileReview({ published: submitted })
    fireEvent(window, new Event('focus'))
    expect(await screen.findByText('ألمانيا')).toBeInTheDocument()
    expect(screen.queryByText(/تعديلات ملفك المهني بانتظار المراجعة/)).not.toBeInTheDocument()
  })

  it('shows the last update rejection in settings and keeps published values', async () => {
    const { api } = await client((call) => call.path === '/therapists/me/profile' ? json({
      data: profileReview({ last_review: {
        revision_id: periodId, kind: 'update', status: 'rejected', note: 'يرجى مراجعة معلومات التخصص',
        reviewed_at: '2026-11-27T12:00:00Z', data: { ...validProfile, specialty: 'trauma' },
      } }),
    }) : undefined)
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    expect(await screen.findByText('يرجى مراجعة معلومات التخصص')).toBeInTheDocument()
    expect(screen.queryByText(/تعديلات ملفك المهني بانتظار المراجعة/)).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'تعديل الملف الشخصي' })[0])
    expect(modal().getByLabelText('التخصص')).toHaveValue('trauma')
  })

  it('withdraws by revision only on confirmation, even when the published profile has null fields', async () => {
    const published = { ...validProfile, job_title: null, city: null }
    const { api, calls } = await client((call) => {
      if (call.path === '/therapists/me/profile') return json({ data: { ...pendingProfile(revisionA), published } })
      if (call.method === 'DELETE') return json({ data: profileReview({ lifecycle_state: 'approved', published }) })
    })
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'سحب التعديلات' }))
    expect(modal().getByText(/ستبقى بيانات ملفك المنشور كما هي/)).toBeInTheDocument()
    fireEvent.click(modal().getByRole('button', { name: 'إلغاء' }))
    expect(calls.every(({ method }) => method === 'GET')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'سحب التعديلات' }))
    fireEvent.click(modal().getByRole('button', { name: 'تأكيد السحب' }))
    expect(await screen.findByText(withdrawalSuccess)).toBeInTheDocument()
    expect(calls.filter(({ method }) => method !== 'GET')).toMatchObject([
      { method: 'DELETE', path: `/therapists/me/profile-submission/${revisionA}`, body: undefined },
    ])
    expect(screen.queryByRole('button', { name: 'سحب التعديلات' })).not.toBeInTheDocument()
    expect(screen.queryByText('Unpublished Name')).not.toBeInTheDocument()
  })

  it.each([409, 404])('targets the pinned revision after a refresh and handles withdrawal %s without reporting success', async (status) => {
    const profilePath = '/therapists/me/profile'
    let review = pendingProfile(revisionA)
    const { api, calls } = await client((call) => {
      if (call.path === profilePath) return json({ data: review })
      if (call.method === 'DELETE') {
        review = { ...review, published: { ...validProfile, full_name: 'Latest Published Name' } }
        return json({}, status)
      }
    })
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'سحب التعديلات' }))
    review = {
      ...pendingProfile(revisionB),
      last_review: {
        revision_id: periodId, kind: 'update', status: 'rejected', note: 'سبب المراجعة السابقة',
        reviewed_at: '2026-11-27T12:00:00Z',
      },
    }
    fireEvent(window, new Event('focus'))
    expect(await screen.findByText('سبب المراجعة السابقة')).toBeInTheDocument()
    const previousReads = calls.filter(({ path }) => path === profilePath).length

    fireEvent.click(modal().getByRole('button', { name: 'تأكيد السحب' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر سحب التعديلات')
    expect(calls.filter(({ method }) => method !== 'GET')).toMatchObject([
      { method: 'DELETE', path: `/therapists/me/profile-submission/${revisionA}`, body: undefined },
    ])
    expect(await screen.findByRole('heading', { name: 'Latest Published Name' })).toBeInTheDocument()
    expect(calls.filter(({ path }) => path === profilePath)).toHaveLength(previousReads + 1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'سحب التعديلات' })).toBeInTheDocument()
    expect(screen.queryByText(withdrawalSuccess)).not.toBeInTheDocument()
  })

  it.each([
    [0, 'تعذّر الاتصال بالخادم'],
    [503, 'تعذّر إكمال الطلب'],
  ])('shows withdrawal error %s in the confirmation without reporting success', async (status, message) => {
    const { api } = await client((call) => {
      if (call.path === '/therapists/me/profile') return json({ data: pendingProfile(revisionA) })
      if (call.method === 'DELETE') {
        if (!status) throw new TypeError('Offline')
        return json({}, status)
      }
    })
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'سحب التعديلات' }))
    fireEvent.click(modal().getByRole('button', { name: 'تأكيد السحب' }))
    expect(await modal().findByRole('alert')).toHaveTextContent(message)
    expect(modal().getByRole('button', { name: 'تأكيد السحب' })).toBeEnabled()
    expect(screen.queryByText(withdrawalSuccess)).not.toBeInTheDocument()
  })

  it('renders server option labels and displays raw legacy values', async () => {
    const legacy = { ...validProfile, specialty: 'Counselling', country: 'Jordan', languages: ['ar', 'Legacy language'] }
    const { api } = await client((call) => {
      if (call.path === '/meta/therapist-options') return json({
        data: {
          countries: [{ code: 'SY', name_ar: 'سورية' }],
          languages: [{ code: 'ar', name_ar: 'اللغة العربية' }],
          specialties: [{ code: 'general', name_ar: 'التخصص العام' }],
        },
      })
      if (call.path === '/therapists/me/profile') return json({ data: profileReview({ published: legacy }) })
    })
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    expect(await screen.findByText('اللغة العربية، Legacy language')).toBeInTheDocument()
    expect(screen.getAllByText('Counselling').length).toBeGreaterThan(0)
    expect(screen.getByText('Jordan')).toBeInTheDocument()
    expect(screen.getByText('حالة الموافقة: تمت الموافقة')).toHaveAttribute('dir', 'rtl')
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الملف الشخصي' }))
    expect(modal().getByRole('option', { name: 'سورية' })).toHaveValue('SY')
    expect(modal().getByRole('option', { name: 'التخصص العام' })).toHaveValue('general')
    expect(modal().getByLabelText('التخصص')).toHaveDisplayValue('Counselling')
    expect(modal().getByLabelText('البلد')).toHaveDisplayValue('Jordan')
    const languages = within(modal().getByRole('group', { name: 'اللغات' }))
    expect(languages.getByRole('checkbox', { name: 'اللغة العربية' })).toBeChecked()
    expect(languages.getByRole('checkbox', { name: 'Legacy language' })).toBeChecked()
  })

  it('preserves drafts on sanitized field errors and guards duplicate submissions', async () => {
    const response = deferred<Response>()
    const { api, calls } = await client((call) =>
      call.method === 'POST' ? response.promise : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الملف الشخصي' }))
    const draft = 'Unsaved private profile draft'
    change('النبذة التعريفية', draft)
    const form = modal().getByLabelText('النبذة التعريفية').closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(calls.filter((call) => call.method === 'POST')).toHaveLength(1)
    expect(modal().getByRole('button', { name: 'جارٍ الإرسال…' })).toBeDisabled()
    await act(async () =>
      response.resolve(json({
        message: 'server secret', errors: { email: ['private draft echoed by backend'], 'languages.0': ['invalid'] },
      }, 422)),
    )
    expect(modal().getByRole('alert')).toHaveTextContent('يرجى مراجعة الحقول')
    expect(modal().getByLabelText('البريد الإلكتروني')).toHaveAccessibleDescription(/ربما يكون مستخدمًا/)
    expect(modal().getByRole('group', { name: 'اللغات' })).toHaveAttribute('aria-invalid', 'true')
    expect(modal().getByLabelText('النبذة التعريفية')).toHaveValue(draft)
    expect(screen.queryByText('server secret')).not.toBeInTheDocument()
    expect(screen.queryByText('private draft echoed by backend')).not.toBeInTheDocument()
    expect(screen.queryByText(/تعديلات ملفك المهني بانتظار المراجعة/)).not.toBeInTheDocument()
  })

  it.each([
    [422, 'لا توجد تعديلات'],
    [429, 'تم إرسال طلبات كثيرة'],
    [0, 'تعذّر الاتصال بالخادم'],
  ])('explains profile-submission error %s in Arabic', async (status, message) => {
    const { api } = await client((call) => {
      if (call.method !== 'POST') return
      if (!status) throw new TypeError('Offline')
      return json({ code: status === 422 ? 'no_changes' : undefined }, status)
    })
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الملف الشخصي' }))
    fireEvent.click(modal().getByRole('button', { name: 'إرسال التعديلات للمراجعة' }))
    expect(await modal().findByRole('alert')).toHaveTextContent(message)
  })

  it('replaces the full availability map, preserves every server window and uses server timezone', async () => {
    const { api, calls } = await client((call) =>
      call.method === 'PUT'
        ? json({ data: { ...therapist, availability: call.body?.availability } })
        : undefined,
    )
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /إدارة أوقات العمل/ }))
    expect(modal().getByText(/All times are wall-clock hours in Asia\/Amman/)).toBeInTheDocument()
    expect(modal().getByLabelText('monday start 2')).toHaveValue('13:00')
    change('monday end 1', '11:30')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    await screen.findByText(/Working hours updated on the server/)
    expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
      availability: {
        monday: ['09:00-11:30', '13:00-17:00'],
        tuesday: ['10:00-11:00'],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
      },
    })
  })

  it('rejects overlapping and incomplete availability instead of silently removing windows', async () => {
    const { api, calls } = await client()
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /إدارة أوقات العمل/ }))
    change('monday end 1', '14:00')
    fireEvent.submit(modal().getByLabelText('monday end 1').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('non-overlapping')
    change('monday end 1', '12:00')
    fireEvent.click(modal().getByRole('button', { name: 'Add wednesday window' }))
    fireEvent.submit(modal().getByLabelText('wednesday start 1').closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('complete')
    expect(calls.filter((call) => call.method !== 'GET')).toHaveLength(0)
  })

  it('uses correct password keys, keeps inputs on 422, clears only after success and keeps this session', async () => {
    let attempts = 0
    const { api, calls } = await client((call) =>
      call.path === '/auth/user/password'
        ? ++attempts === 1
          ? json({ errors: { current_password: ['incorrect secret supplied'] } }, 422)
          : json({ message: 'Password changed.' })
        : undefined,
    )
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }))
    change('Current Password', 'old-test-password')
    change('New Password', 'new-test-password1')
    change('Confirm New Password', 'new-test-password1')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Current password: Please check this field.',
    )
    expect(modal().getByLabelText('Current Password')).toHaveValue('old-test-password')
    expect(calls.find((call) => call.path === '/auth/user/password')).toMatchObject({
      method: 'PUT',
      body: {
        current_password: 'old-test-password',
        password: 'new-test-password1',
        password_confirmation: 'new-test-password1',
      },
    })
    expect(screen.queryByText('incorrect secret supplied')).not.toBeInTheDocument()
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    await screen.findByText(/Password changed. Other devices have been signed out/)
    expect(api.getUser()?.id).toBe(userId)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('enforces the shared password policy and clears a reuse error when the new password changes', async () => {
    const { api, calls } = await client((call) =>
      call.path === '/auth/user/password' ? json({ code: 'password_reused' }, 422) : undefined,
    )
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'تغيير كلمة المرور' }))
    change('Current Password', 'old-test-password')
    change('New Password', 'onlyletters')
    change('Confirm New Password', 'onlyletters')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    expect(modal().getByRole('alert')).toHaveTextContent('Password must be at least 8 characters and include a letter and a number.')
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
    change('New Password', 'new-test-password1')
    change('Confirm New Password', 'new-test-password1')
    fireEvent.click(modal().getByRole('button', { name: 'Save Changes' }))
    expect(await modal().findByRole('alert')).toHaveTextContent('The new password must be different from your current password.')
    change('New Password', 'new-test-password2')
    expect(modal().queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([200, 503])(
    'revokes logout and clears local credentials even on status %s, while navigating',
    async (status) => {
      const logoutResponse = deferred<Response>()
      const { api, calls } = await client((call) =>
        call.path === '/auth/logout' ? logoutResponse.promise : undefined,
      )
      const navigate = vi.fn()
      render(<Profile page="settings" api={api} navigate={navigate} />)
      await loaded()
      fireEvent.click(screen.getByRole('button', { name: 'تسجيل الخروج' }))
      expect(modal().getByText(/remote revocation is unknown/)).toBeInTheDocument()
      const button = modal().getByRole('button', { name: 'Log out' })
      fireEvent.click(button)
      fireEvent.click(button)
      await waitFor(() => expect(api.getUser()).toBeNull())
      expect(
        screen.queryByRole('heading', { name: 'Real Professional Name' }),
      ).not.toBeInTheDocument()
      await act(async () => logoutResponse.resolve(json({ message: 'not rendered' }, status)))
      expect(navigate).toHaveBeenCalledWith(
        status === 200 ? '/login' : '/login?logout=revocation-unknown',
      )
      expect(calls.filter((call) => call.path === '/auth/logout')).toHaveLength(1)
      expect(calls.find((call) => call.path === '/auth/logout')).toMatchObject({
        method: 'POST',
        body: undefined,
      })
    },
  )

  it('uses UUID periods, retains idempotency key on uncertain retries and waits for confirmed creation/deletion', async () => {
    const period = {
      id: periodId,
      start_date: '2090-01-01',
      end_date: '2090-01-02',
      reason: 'Travel',
    }
    let rows: (typeof period)[] = []
    let writes = 0
    let deletes = 0
    const { api, calls } = await client((call) => {
      if (call.path === '/therapists/me/blocked-periods') {
        if (call.method === 'GET') return json({ data: rows })
        if (++writes === 1) throw new Error('ambiguous transport failure')
        rows = [period]
        return json({ data: period }, 201)
      }
      if (call.method === 'DELETE') {
        if (++deletes === 1) return json({ message: 'cannot remove' }, 403)
        rows = []
        return json({ message: 'removed' })
      }
    })
    render(<Profile page="settings" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /الإجازات والاستراحات/ }))
    await screen.findByText('No blocked periods.')
    change('Start date', period.start_date)
    change('End date (optional)', period.end_date)
    change('Reason (optional)', 'Travel')
    fireEvent.click(modal().getByRole('button', { name: 'Add blocked period' }))
    await screen.findByText(/previous result is uncertain/)
    expect(modal().getByLabelText('Start date')).toBeDisabled()
    expect(screen.queryByText('Blocked period added on the server.')).not.toBeInTheDocument()
    fireEvent.click(modal().getByRole('button', { name: 'Retry identical submission' }))
    await screen.findByText('Blocked period added on the server.')
    const posts = calls.filter((call) => call.method === 'POST')
    expect(posts).toHaveLength(2)
    expect(posts[0].headers.get('Idempotency-Key')).toBe(posts[1].headers.get('Idempotency-Key'))
    expect(posts[0].body).toEqual({
      start_date: period.start_date,
      end_date: period.end_date,
      reason: 'Travel',
    })
    const remove = await screen.findByRole('button', {
      name: `Remove blocked period ${period.start_date}`,
    })
    fireEvent.click(remove)
    await screen.findByRole('alert')
    expect(screen.getByText('Travel')).toBeInTheDocument()
    fireEvent.click(remove)
    await screen.findByText('Blocked period removed on the server.')
    expect(calls.filter((call) => call.method === 'DELETE').map((call) => call.path)).toEqual([
      `/therapists/me/blocked-periods/${periodId}`,
      `/therapists/me/blocked-periods/${periodId}`,
    ])
    await screen.findByText('No blocked periods.')
  })

  it('loads paginated public FAQs as escaped text, and makes unsupported features unavailable without writes', async () => {
    const { api, calls } = await client((call) =>
      call.path.startsWith('/faqs')
        ? json({
            data: [
              {
                id: periodId,
                question: '<b>Published question</b>',
                answer: '<script>not executed</script>',
              },
            ],
            pagination: { current_page: call.path.endsWith('2') ? 2 : 1, last_page: 2 },
          })
        : undefined,
    )
    const { rerender } = render(<Profile page="help" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: /FAQs/ }))
    await screen.findByText('<b>Published question</b>')
    expect(screen.getByText('<script>not executed</script>').querySelector('script')).toBeNull()
    expect(calls.find((call) => call.path.startsWith('/faqs'))?.headers.has('Authorization')).toBe(
      false,
    )
    fireEvent.click(modal().getByRole('button', { name: 'Next FAQs' }))
    await screen.findByText('Page 2 of 2')
    fireEvent.click(modal().getByRole('button', { name: 'Close dialog' }))
    fireEvent.click(screen.getByRole('button', { name: /Contact support/ }))
    expect(modal().getByRole('button', { name: 'Send Message (unavailable)' })).toBeDisabled()
    fireEvent.click(modal().getByRole('button', { name: 'Close dialog' }))
    rerender(<Profile page="settings" api={api} navigate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /إعدادات الإشعارات/ }))
    expect(modal().getByRole('button', { name: 'Save Preferences (unavailable)' })).toBeDisabled()
    expect(
      modal()
        .getAllByRole('switch')
        .every((element) => element.matches(':disabled')),
    ).toBe(true)
    expect(calls.every((call) => call.method === 'GET')).toBe(true)
  })

  it('aborts and discards an in-flight private draft/save on actor change', async () => {
    const save = deferred<Response>()
    const { api, calls } = await client((call) =>
      call.method === 'POST' ? save.promise : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'تعديل الملف الشخصي' }))
    change('النبذة التعريفية', 'Private old actor draft')
    fireEvent.click(modal().getByRole('button', { name: 'إرسال التعديلات للمراجعة' }))
    const write = calls.find((call) => call.method === 'POST')!
    await act(async () => {
      await api.establish(session({ ...user, id: periodId, name: 'New Actor' }))
    })
    expect(write.signal?.aborted).toBe(true)
    await act(async () =>
      save.resolve(json({ data: profileReview({ published: { ...validProfile, bio: 'Private old actor draft' } }) })),
    )
    expect(screen.queryByText('Private old actor draft')).not.toBeInTheDocument()
    expect(screen.queryByText(/تعديلات ملفك المهني بانتظار المراجعة/)).not.toBeInTheDocument()
  })

  it('refuses dashboard reads when auth/user no longer describes an active verified therapist', async () => {
    const { api, calls } = await client((call) =>
      call.path === '/auth/user'
        ? json({ user: { ...user, is_active: false }, roles: ['therapist'] })
        : undefined,
    )
    render(<Profile page="profile" api={api} navigate={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('active, phone-verified therapist')
    expect(calls.map((call) => call.path)).toEqual(['/auth/user'])
  })
})
