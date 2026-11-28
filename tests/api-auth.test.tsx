import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Auth, type AuthPage } from '../src/Auth'
import { ApiClient, type ApiSession } from '../src/api'

const phone = '+4915123456789'
const proof = 'a'.repeat(64)

function json(value: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

function session(role = 'therapist'): ApiSession {
  return {
    user: {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      name: 'Invited Therapist',
      email: 'therapist@example.test',
      whatsapp_number: phone,
      role,
      is_active: true,
      phone_verified_at: '2026-01-01T00:00:00Z',
      timezone: 'UTC',
    },
    access_token: 'test-access-token',
    refresh_token: 'r'.repeat(64),
    token_type: 'Bearer',
    expires_at: new Date(Date.now() + 7200000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 86400000).toISOString(),
  }
}

function challenge() {
  return {
    requires_2fa: true,
    login_challenge: proof,
    challenge_expires_at: new Date(Date.now() + 300000).toISOString(),
    request_reference: 'a1b2c3d4',
  }
}

function setup(page: AuthPage = 'login') {
  const transport = vi.fn<typeof fetch>()
  const api = new ApiClient('https://api.example.test/api/v1', transport)
  const navigate = vi.fn()
  const onCreateAccount = vi.fn()
  const view = render(
    <Auth
      page={page}
      api={api}
      navigate={navigate}
      verificationEmail="unused@example.test"
      onCreateAccount={onCreateAccount}
    />,
  )
  return { transport, api, navigate, onCreateAccount, ...view }
}

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

function login(password = 'x') {
  fill('رقم واتساب', phone)
  fill('كلمة المرور', password)
  fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
}

function newPassword(password = 'new password1') {
  const activating = !!screen.queryByLabelText('رمز التفعيل')
  fill(activating ? 'كلمة المرور الجديدة' : 'كلمة المرور الجديدة', password)
  fill(activating ? 'تأكيد كلمة المرور' : 'تأكيد كلمة المرور', password)
}

function expectPublicRequest(
  transport: ReturnType<typeof vi.fn<typeof fetch>>,
  index: number,
  path: string,
  body: unknown,
) {
  const [url, options] = transport.mock.calls[index]
  expect(url).toBe(`https://api.example.test/api/v1${path}`)
  expect(options?.method).toBe('POST')
  expect(JSON.parse(options?.body as string)).toEqual(body)
  expect(new Headers(options?.headers).get('Authorization')).toBeNull()
  expect(new Headers(options?.headers).get('Content-Type')).toBe('application/json')
  expect(new Headers(options?.headers).get('Accept')).toBe('application/json')
  expect(options?.credentials).toBe('omit')
  expect(options?.signal).toBeInstanceOf(AbortSignal)
}

beforeEach(() => window.history.replaceState({}, '', '/login'))
afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('live authentication public API integration', () => {
  it.each(['2025550107', '12025550107', '+12025550107', '0012025550107', '+1 202 555 0107'])(
    'sends the synthetic US test number %s in E.164',
    async (input) => {
      const { transport } = setup()
      transport.mockResolvedValue(json({}, 401))
      expect(screen.getByLabelText('الدولة أو المنطقة')).toHaveValue('SY')
      fill('الدولة أو المنطقة', 'US')
      fill('رقم واتساب', input)
      fill('كلمة المرور', 'existing')
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' })))
      expectPublicRequest(transport, 0, '/auth/login', {
        whatsapp_number: '+12025550107',
        password: 'existing',
      })
    },
  )

  it('uses the selected country for a local forgot-password number and clears inline phone_invalid', async () => {
    const { transport } = setup('forgot-password')
    transport.mockResolvedValue(json({ code: 'phone_invalid', errors: { whatsapp_number: ['raw'] } }, 422))
    fill('الدولة أو المنطقة', 'DE')
    fill('رقم واتساب', '015123456789')
    fireEvent.click(screen.getByRole('button', { name: 'طلب رمز الاستعادة' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('أدخل رقم واتساب صالحاً.')
    expectPublicRequest(transport, 0, '/auth/forgot-password', { whatsapp_number: phone })
    fill('الدولة أو المنطقة', 'SY')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['otp_invalid', 'رمز التفعيل غير صحيح. المحاولات المتبقية: 2.'],
    ['otp_expired', 'انتهت صلاحية رمز التفعيل. تواصل مع الإدارة للحصول على دعوة جديدة.'],
    ['otp_exhausted', 'استُنفدت محاولات إدخال الرمز. تواصل مع الإدارة للحصول على دعوة جديدة.'],
  ])('handles activation %s without duplicating messages', async (code, message) => {
    const { transport } = setup('activate')
    transport.mockResolvedValue(json({ code, errors: { otp: ['raw'] }, meta: { attempts_left: 2 } }, 422))
    expect(screen.getByLabelText('رقم واتساب')).toHaveAttribute('autocomplete', 'tel')
    expect(screen.getByLabelText('رمز التفعيل')).toHaveAttribute('autocomplete', 'one-time-code')
    expect(screen.getByLabelText('كلمة المرور الجديدة')).toHaveAttribute('autocomplete', 'new-password')
    fill('رقم واتساب', '+12025550107')
    fill('رمز التفعيل', 'ABCD1234')
    newPassword('onlyletters')
    expect(screen.getByRole('alert')).toHaveTextContent('استخدم ٨ أحرف على الأقل، تتضمن حرفًا ورقمًا.')
    newPassword()
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الحساب' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expectPublicRequest(transport, 0, '/auth/activate', {
      whatsapp_number: '+12025550107', code: 'ABCD1234', password: 'new password1', password_confirmation: 'new password1',
    })
    if (code === 'otp_exhausted') {
      expect(screen.getByLabelText('رمز التفعيل')).toHaveValue('')
      expect(screen.getByLabelText('كلمة المرور الجديدة')).toHaveValue('')
    } else {
      expect(screen.getByLabelText('رمز التفعيل')).toHaveAttribute('aria-invalid', 'true')
      fill('رمز التفعيل', 'ABCD1235')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    }
  })

  it('shows a forgot-password delivery failure under the phone field', async () => {
    const { transport } = setup('forgot-password')
    transport.mockResolvedValue(json({ code: 'otp_send_failed', errors: { otp: ['raw'] } }, 503))
    fill('رقم واتساب', phone)
    fireEvent.click(screen.getByRole('button', { name: 'طلب رمز الاستعادة' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('تعذّر إرسال الرمز عبر واتساب.')
    expect(screen.getByLabelText('رقم واتساب')).toHaveAttribute('aria-invalid', 'true')
  })

  it('maps reset expiry and password reuse, counts down resend, and restarts on exhaustion', async () => {
    vi.useFakeTimers()
    const { transport } = setup('reset-password')
    transport
      .mockResolvedValueOnce(json({ code: 'otp_expired' }, 422))
      .mockResolvedValueOnce(json({ code: 'otp_cooldown', meta: { retry_after: 4 } }, 429))
      .mockResolvedValueOnce(json({ code: 'password_reused' }, 422))
      .mockResolvedValueOnce(json({ code: 'otp_exhausted' }, 422))
    fill('رقم واتساب', phone)
    fill('رمز الاستعادة', '123456')
    newPassword()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'استعادة كلمة المرور' })))
    expect(screen.getByRole('alert')).toHaveTextContent('انتهت صلاحية الرمز.')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'إعادة الإرسال' })))
    expect(screen.getByRole('alert')).toHaveTextContent('يمكنك طلب رمز جديد بعد 4 ثانية.')
    expect(screen.getByRole('button', { name: 'إعادة الإرسال (4 ث)' })).toBeDisabled()
    await act(async () => vi.advanceTimersByTime(1000))
    expect(screen.getByRole('button', { name: 'إعادة الإرسال (3 ث)' })).toBeDisabled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'استعادة كلمة المرور' })))
    expect(screen.getByRole('alert')).toHaveTextContent('يجب أن تختلف كلمة المرور الجديدة عن الحالية.')
    fill('كلمة المرور الجديدة', 'different1')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await act(async () => vi.advanceTimersByTime(3000))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'إعادة الإرسال' })))
    expect(screen.getByRole('heading', { name: 'نسيت كلمة المرور؟' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('استُنفدت محاولات هذا الرمز.')
  })

  it('calls the default fetch transport without an illegal receiver', async () => {
    vi.stubGlobal(
      'fetch',
      function (this: unknown) {
        if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation')
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      },
    )
    const api = new ApiClient('https://api.example.test/api/v1')
    await expect(api.request('/auth/privacy-policy', 'GET', { public: true })).resolves.toEqual({
      ok: true,
    })
  })

  it('preserves the original no-api demo login behavior in its isolated component', () => {
    vi.useFakeTimers()
    const navigate = vi.fn()
    render(
      <Auth
        page="login"
        navigate={navigate}
        verificationEmail="demo@example.test"
        onCreateAccount={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    fill('البريد الإلكتروني', 'demo@example.test')
    fill('Password', 'password123')
    fireEvent.click(screen.getByRole('button', { name: 'Login' }))
    expect(navigate).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(600))
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard')
  })

  it('logs in with international WhatsApp and an untrimmed password, only after API success', async () => {
    const { transport, api, navigate } = setup()
    const persisted = vi.spyOn(Storage.prototype, 'setItem')
    const establish = vi.spyOn(api, 'establish')
    let resolve!: (value: Response) => void
    transport.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    fill('رقم واتساب', '0049 (151) 234-56789')
    fill('كلمة المرور', ' x ')
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(navigate).not.toHaveBeenCalled()
    expect(api.getUser()).toBeNull()
    expectPublicRequest(transport, 0, '/auth/login', { whatsapp_number: phone, password: ' x ' })
    const issued = session()
    await act(async () =>
      resolve(json({ ...issued, user: { ...issued.user, patient: { safety_flag: true } } })),
    )
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/dashboard')
    expect(establish.mock.calls[0][0].user).not.toHaveProperty('patient')
    expect(api.getUser()?.role).toBe('therapist')
    expect(persisted).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('refresh:'), issued.refresh_token)
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
  })

  it('does not impose the new-password minimum on login and reports an invalid phone inline', () => {
    const { transport } = setup()
    fill('رقم واتساب', '01234567890')
    fill('كلمة المرور', 'x')
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(screen.getByRole('alert')).toHaveTextContent('أدخل رقم واتساب صالحاً.')
    expect(screen.getByLabelText('رقم واتساب')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('كلمة المرور')).not.toHaveAttribute('minlength')
    fill('رقم واتساب', phone)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled()
    expect(transport).not.toHaveBeenCalled()
  })

  it('sanitizes failed login field errors without navigating or installing a session', async () => {
    const { transport, api, navigate } = setup()
    transport.mockResolvedValue(
      json(
        {
          message: 'raw database exception',
          errors: { whatsapp_number: ['private server detail'] },
        },
        422,
      ),
    )
    login()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'رقم واتساب أو كلمة مرور غير صحيحة.',
    )
    expect(screen.queryByText('تحقق من هذا الحقل.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('رقم واتساب')).toHaveAttribute('aria-invalid', 'false')
    expect(
      screen.queryByText(/raw database exception|private server detail/),
    ).not.toBeInTheDocument()
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('removes Google/demo bypasses and fails closed for a directly opened verification route', () => {
    const { transport, navigate } = setup('verify')
    expect(screen.getByText(/لا يوجد تحدي تسجيل دخول متاح\. سجّل بكلمة مرورك أولاً\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Google|Explore|Verify/ })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('رمز التحقق')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /أنشئ حساباً الآن!/ })).not.toBeInTheDocument()
    expect(transport).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['signup', 'activate'] as const)(
    'treats %s as invitation activation, never patient registration',
    async (page) => {
      const { transport, navigate, onCreateAccount } = setup(page)
      transport.mockResolvedValue(json(session()))
      expect(screen.getByRole('heading', { name: 'تفعيل دعوة المعالج' })).toBeInTheDocument()
      fill('رقم واتساب', phone)
      fill('رمز التفعيل', 'abc12!34')
      newPassword(' new password1 ')
      expect(screen.getByRole('button', { name: 'تفعيل الحساب' })).toBeDisabled()
      fill('رمز التفعيل', 'abc1234')
      expect(screen.getByRole('button', { name: 'تفعيل الحساب' })).toBeDisabled()
      fill('رمز التفعيل', 'abc12345')
      fill('تأكيد كلمة المرور', 'not matching')
      expect(screen.getByRole('button', { name: 'تفعيل الحساب' })).toBeDisabled()
      fill('تأكيد كلمة المرور', ' new password1 ')
      fireEvent.click(screen.getByRole('button', { name: 'تفعيل الحساب' }))
      await waitFor(() => expect(navigate).toHaveBeenCalledExactlyOnceWith('/profile/approval'))
      expectPublicRequest(transport, 0, '/auth/activate', {
        whatsapp_number: phone,
        code: 'ABC12345',
        password: ' new password1 ',
        password_confirmation: ' new password1 ',
      })
      expect(onCreateAccount).not.toHaveBeenCalled()
      expect(transport).toHaveBeenCalledTimes(1)
      expect(screen.getByLabelText('رمز التفعيل')).toHaveValue('')
      expect(screen.getByLabelText('كلمة المرور الجديدة')).toHaveValue('')
    },
  )

  it('supports direct /activate entry when the router supplies its login default', () => {
    window.history.replaceState({}, '', '/activate')
    setup('login')
    expect(screen.getByRole('heading', { name: 'تفعيل دعوة المعالج' })).toBeInTheDocument()
  })

  it('rejects staff activation sessions cleanly and never masquerades as a therapist', async () => {
    const { transport, api, navigate } = setup('activate')
    transport
      .mockResolvedValueOnce(json(session('admin')))
      .mockResolvedValueOnce(json({ message: 'Logged out.' }))
    fill('رقم واتساب', phone)
    fill('رمز التفعيل', 'ABC12345')
    newPassword()
    fireEvent.click(screen.getByRole('button', { name: 'تفعيل الحساب' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('لا يمكن تفعيل هذا الحساب')
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expect(transport.mock.calls[1][0]).toBe('https://api.example.test/api/v1/auth/logout')
    expect(new Headers(transport.mock.calls[1][1]?.headers).get('Authorization')).toBe(
      'Bearer test-access-token',
    )
  })

  it('requests a generic WhatsApp reset, then sends code and both passwords together without auto-login', async () => {
    const { transport, api, navigate } = setup()
    const clear = vi.spyOn(api, 'clear')
    transport
      .mockResolvedValueOnce(json({ message: 'server content must not be rendered' }))
      .mockResolvedValueOnce(json({ message: 'Password updated successfully.' }))
    fireEvent.click(screen.getByRole('button', { name: 'نسيت كلمة المرور' }))
    fill('رقم واتساب', phone)
    fireEvent.click(screen.getByRole('button', { name: 'طلب رمز الاستعادة' }))
    await screen.findByRole('heading', { name: 'استعادة كلمة المرور' })
    expectPublicRequest(transport, 0, '/auth/forgot-password', { whatsapp_number: phone })
    expect(screen.getByText('إذا كان الرقم مؤهلاً، قد يصلك رمز الاستعادة على واتساب.')).toBeInTheDocument()
    expect(screen.queryByText(/a reset code has been sent/)).not.toBeInTheDocument()
    expect(screen.queryByText('server content must not be rendered')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^إعادة الإرسال/ })).toBeDisabled()
    fill('رمز الاستعادة', '001234')
    newPassword('replacement password1')
    fireEvent.click(screen.getByRole('button', { name: 'استعادة كلمة المرور' }))
    await screen.findByRole('heading', { name: 'تسجيل الدخول إلى سكينة' })
    expectPublicRequest(transport, 1, '/auth/reset-password', {
      whatsapp_number: phone,
      otp: '001234',
      password: 'replacement password1',
      password_confirmation: 'replacement password1',
    })
    expect(clear).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/login')
    expect(api.getUser()).toBeNull()
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
  })

  it('enforces six reset digits and minimum/confirmed new passwords on direct reset entry', async () => {
    window.history.replaceState({}, '', '/reset-password')
    const { transport, navigate } = setup('login')
    transport.mockResolvedValue(json({ errors: { otp: ['private reset error'] } }, 422))
    fill('رقم واتساب', phone)
    fill('رمز الاستعادة', '01234')
    newPassword()
    expect(screen.getByRole('button', { name: 'استعادة كلمة المرور' })).toBeDisabled()
    fill('رمز الاستعادة', '012345')
    newPassword('short')
    expect(screen.getByRole('button', { name: 'استعادة كلمة المرور' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتتضمن حرفاً ورقماً.')
    newPassword()
    fill('تأكيد كلمة المرور', 'different password')
    expect(screen.getByRole('button', { name: 'استعادة كلمة المرور' })).toBeDisabled()
    fill('تأكيد كلمة المرور', 'new password1')
    fireEvent.click(screen.getByRole('button', { name: 'استعادة كلمة المرور' }))
    await screen.findByRole('alert')
    expect(screen.queryByText('private reset error')).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('binds six-digit leading-zero OTP verification and resend to the returned proof, reference and expiry', async () => {
    vi.useFakeTimers()
    const { transport, api, navigate } = setup()
    const issued = challenge()
    transport
      .mockResolvedValueOnce(json(issued))
      .mockResolvedValueOnce(
        json({ message: 'If a staff sign-in is pending, a new code has been sent.' }),
      )
      .mockResolvedValueOnce(json({ errors: { otp: ['sensitive provider details'] } }, 422))
    await act(async () => login('staff password'))
    expect(screen.getByRole('heading', { name: 'تحقق من رمز واتساب' })).toBeInTheDocument()
    expect(screen.getByText('a1b2c3d4')).toBeInTheDocument()
    expect(document.querySelector('time')).toHaveAttribute('datetime', issued.challenge_expires_at)
    expect(screen.queryByLabelText('كلمة المرور')).not.toBeInTheDocument()
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^إعادة الإرسال/ })).toBeDisabled()
    fill('رمز التحقق', '00123')
    expect(screen.getByRole('button', { name: 'تحقّق' })).toBeDisabled()
    await act(async () => vi.advanceTimersByTime(60000))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'إعادة الإرسال' })))
    expectPublicRequest(transport, 1, '/auth/login/2fa/resend', {
      whatsapp_number: phone,
      login_challenge: proof,
    })
    expect(document.querySelector('time')).toHaveAttribute('datetime', issued.challenge_expires_at)
    expect(screen.getByLabelText('رمز التحقق')).toHaveValue('')
    fill('رمز التحقق', '001234')
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'تحقّق' })))
    expectPublicRequest(transport, 2, '/auth/login/2fa', {
      whatsapp_number: phone,
      otp: '001234',
      login_challenge: proof,
    })
    expect(screen.getByRole('alert')).toHaveTextContent('تحقق من المعلومات المُدخلة.')
    expect(screen.queryByText('sensitive provider details')).not.toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(api.getUser()).toBeNull()
  })

  it('does not accept a malformed challenge response or fall back to a local verification success', async () => {
    const { transport, api, navigate } = setup()
    transport.mockResolvedValue(json({ ...challenge(), login_challenge: 'missing-proof' }))
    login()
    await screen.findByRole('alert')
    expect(screen.queryByLabelText('رمز التحقق')).not.toBeInTheDocument()
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('drops unusable staff proof on server challenge error and demands fresh password login', async () => {
    const { transport, navigate } = setup()
    transport
      .mockResolvedValueOnce(json(challenge()))
      .mockResolvedValueOnce(json({ errors: { login_challenge: ['raw proof detail'] } }, 422))
    login()
    await screen.findByLabelText('رمز التحقق')
    fill('رمز التحقق', '000123')
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }))
    await screen.findByLabelText('كلمة المرور')
    expect(screen.getByText(/لم يعد تحدي تسجيل الدخول صالحاً\. سجّل الدخول بكلمة مرورك مجدداً\./)).toBeInTheDocument()
    expect(screen.queryByLabelText('رمز التحقق')).not.toBeInTheDocument()
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('rejects successfully verified staff sessions and clears their consumed OTP instead of opening the therapist dashboard', async () => {
    const { transport, api, navigate } = setup()
    transport
      .mockResolvedValueOnce(json(challenge()))
      .mockResolvedValueOnce(json(session('admin')))
      .mockResolvedValueOnce(json({ message: 'Logged out.' }))
    login('staff password')
    await screen.findByLabelText('رمز التحقق')
    fill('رمز التحقق', '012345')
    fireEvent.click(screen.getByRole('button', { name: 'تحقّق' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('هذا الإجراء غير مسموح لحسابك.')
    expect(screen.queryByLabelText('رمز التحقق')).not.toBeInTheDocument()
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
    expect(api.getUser()).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expectPublicRequest(transport, 1, '/auth/login/2fa', {
      whatsapp_number: phone,
      otp: '012345',
      login_challenge: proof,
    })
  })

  it('expires staff challenge locally without extending it or sending a verification request', async () => {
    vi.useFakeTimers()
    const { transport, navigate } = setup()
    transport.mockResolvedValueOnce(json(challenge()))
    await act(async () => login())
    fill('رمز التحقق', '123456')
    await act(async () => vi.advanceTimersByTime(300000))
    expect(screen.getByRole('heading', { name: 'تسجيل الدخول إلى سكينة' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('انتهت صلاحية تحدي تسجيل الدخول.')
    expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
    expect(transport).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('resends reset codes only through forgot-password and honors the phone cooldown', async () => {
    vi.useFakeTimers()
    const { transport } = setup('forgot-password')
    transport.mockImplementation(async () => json({ message: 'generic reset confirmation' }))
    fill('رقم واتساب', phone)
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'طلب رمز الاستعادة' })),
    )
    expect(screen.getByRole('button', { name: /^إعادة الإرسال/ })).toBeDisabled()
    fill('رمز الاستعادة', '001234')
    await act(async () => vi.advanceTimersByTime(60000))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'إعادة الإرسال' })))
    expectPublicRequest(transport, 1, '/auth/forgot-password', { whatsapp_number: phone })
    expect(screen.getByLabelText('رمز الاستعادة')).toHaveValue('')
    expect(screen.getByRole('button', { name: /^إعادة الإرسال/ })).toBeDisabled()
  })

  it('respects Retry-After without automatically retrying login', async () => {
    vi.useFakeTimers()
    const { transport } = setup()
    transport.mockResolvedValue(
      json({ message: 'internal throttling details' }, 429, { 'Retry-After': '5' }),
    )
    await act(async () => login())
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeDisabled()
    expect(screen.getByText('حاول مجدداً بعد 5 ثانية.')).toBeInTheDocument()
    await act(async () => vi.advanceTimersByTime(5000))
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeEnabled()
    expect(transport).toHaveBeenCalledTimes(1)
  })

  it.each(['unmount', 'clear', 'cancel'] as const)(
    'prevents late login from restoring a session after %s and locks duplicate submissions',
    async (reason) => {
      const { transport, api, navigate, unmount } = setup()
      const establish = vi.spyOn(api, 'establish')
      let resolve!: (value: Response) => void
      transport.mockImplementation(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          }),
      )
      fill('رقم واتساب', phone)
      fill('كلمة المرور', 'x')
      const form = screen.getByRole('button', { name: 'تسجيل الدخول' }).closest('form')!
      fireEvent.submit(form)
      fireEvent.submit(form)
      expect(transport).toHaveBeenCalledTimes(1)
      const signal = transport.mock.calls[0][1]?.signal
      if (reason === 'unmount') unmount()
      else if (reason === 'clear') act(() => api.clear())
      else fireEvent.click(screen.getByRole('button', { name: 'نسيت كلمة المرور' }))
      expect(signal?.aborted).toBe(true)
      await act(async () => resolve(json(session())))
      expect(establish).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
      expect(api.getUser()).toBeNull()
      if (reason === 'clear') expect(screen.getByLabelText('كلمة المرور')).toHaveValue('')
    },
  )
})
