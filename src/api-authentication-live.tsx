import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/max'
import {
  ApiClient,
  ApiError,
  apiErrorMessage,
  apiId,
  type ApiSession,
  type LoginChallenge,
} from './api'
import type { AuthPage } from './Auth'
import { Icon } from './ui'
import { AuthCardShell } from './AuthCardShell'
import { passwordPolicyMessage, validNewPassword } from './auth-policy'
import { formatTimestamp } from './display-date'

type Phase = 'login' | 'activate' | 'forgot' | 'reset' | 'otp'
type Challenge = LoginChallenge & { phone: string }
type Operation = { controller: AbortController }
type AuthResponse = ApiSession | LoginChallenge

function phoneCountries(language: 'ar' | 'en') {
  const regionNames = new Intl.DisplayNames([language], { type: 'region' })
  return getCountries().map((code) => ({
    code,
    name: regionNames.of(code) ?? code,
    dial: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, language))
}
const countries = { ar: phoneCountries('ar'), en: phoneCountries('en') }
const invalidPhoneMessage = 'أدخل رقم واتساب صالحاً.'
const rejectedCredentials = 'رقم واتساب أو كلمة مرور غير صحيحة.'

function invitationError(error: ApiError) {
  switch (error.code) {
    case 'phone_invalid': return 'أدخل رقم واتساب صالحًا.'
    case 'otp_invalid': return error.meta.attempts_left === undefined
      ? 'رمز التفعيل غير صحيح.'
      : `رمز التفعيل غير صحيح. المحاولات المتبقية: ${error.meta.attempts_left}.`
    case 'otp_expired': return 'انتهت صلاحية رمز التفعيل. تواصل مع الإدارة للحصول على دعوة جديدة.'
    case 'otp_exhausted': return 'استُنفدت محاولات إدخال الرمز. تواصل مع الإدارة للحصول على دعوة جديدة.'
  }
  if (error.status === 403) return 'لا يمكن تفعيل هذا الحساب في بوابة المعالجين.'
  if (error.status === 429) return 'محاولات كثيرة. انتظر قليلًا ثم أعد المحاولة.'
  if (error.status === 0 || error.status === 408) return 'تعذّر الاتصال. تحقّق من اتصالك بالإنترنت وأعد المحاولة.'
  if (error.status === 422) return 'تحقّق من بيانات التفعيل وحاول مرة أخرى.'
  return 'تعذّر تفعيل الحساب الآن. أعد المحاولة.'
}

function internationalPhone(value: string, region: CountryCode): string | null {
  const input = value.trim().replace(/^00/, '+')
  const number = parsePhoneNumberFromString(input, { defaultCountry: region, extract: false })
  return number?.isValid() && !number.ext ? number.number : null
}

function otpError(failure: ApiError): string | null {
  switch (failure.code) {
    case 'otp_invalid':
      return failure.meta.attempts_left === undefined
        ? 'الرمز غير صحيح.'
        : `الرمز غير صحيح. لديك ${failure.meta.attempts_left} محاولات متبقية.`
    case 'otp_expired':
      return 'انتهت صلاحية الرمز. اختر «إعادة الإرسال» لطلب رمز جديد.'
    case 'otp_exhausted':
      return 'استُنفدت محاولات هذا الرمز. ابدأ من جديد.'
    case 'otp_cooldown':
      return failure.retryAfter
        ? `يمكنك طلب رمز جديد بعد ${failure.retryAfter} ثانية.`
        : 'انتظر قبل طلب رمز جديد.'
    case 'otp_send_failed':
      return 'تعذّر إرسال الرمز عبر واتساب. حاول بعد قليل.'
    default:
      return null
  }
}

function initialPhase(page: AuthPage): Phase {
  if (page === 'signup' || page === 'activate') return 'activate'
  if (page === 'forgot-password') return 'forgot'
  if (page === 'reset-password') return 'reset'
  return 'login'
}

export function LiveAuthentication({
  api,
  page,
  navigate,
}: {
  api: ApiClient
  page: AuthPage
  navigate: (path: string) => void
}) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(page))
  const activating = phase === 'activate'
  const phoneError = activating ? 'أدخل رقم واتساب صالحًا.' : invalidPhoneMessage
  const phoneLabel = activating ? 'رقم واتساب' : 'رقم واتساب'
  const passwordLabel = phase === 'login' ? 'Password' : activating ? 'كلمة المرور الجديدة' : 'كلمة المرور الجديدة'
  const [phone, setPhone] = useState('')
  const [region, setRegion] = useState<CountryCode>('SY')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [otp, setOtp] = useState('')
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState(
    page === 'verify' ? 'لا يوجد تحدي تسجيل دخول متاح. سجّل بكلمة مرورك أولاً.' : '',
  )
  const revocationUnknown = phase === 'login' &&
    new URLSearchParams(window.location.search).get('logout') === 'revocation-unknown'
  const [resendUntil, setResendUntil] = useState(0)
  const [retryUntil, setRetryUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const operation = useRef<Operation | null>(null)
  const mounted = useRef(false)
  const establishing = useRef(false)
  const boundApi = useRef(api)

  function clearSecrets() {
    setPassword('')
    setConfirmation('')
    setActivationCode('')
    setOtp('')
    setChallenge(null)
    setVisible(false)
  }

  function cancel() {
    operation.current?.controller.abort()
    operation.current = null
    setBusy(false)
    clearSecrets()
    setFields({})
    setError('')
    setNotice('')
    setResendUntil(0)
  }

  useEffect(() => {
    mounted.current = true
    if (boundApi.current !== api) {
      boundApi.current = api
      setPassword('')
      setConfirmation('')
      setActivationCode('')
      setOtp('')
      setChallenge(null)
      setPhone('')
      setFields({})
      setError('')
      setNotice('')
      setVisible(false)
      setResendUntil(0)
      setRetryUntil(0)
      setBusy(false)
      setPhase(initialPhase(page))
    }
    const unsubscribe = api.subscribe(() => {
      // establish installs a validated session synchronously. All other session
      // changes (including logout while login is pending) invalidate this operation.
      if (establishing.current) return
      operation.current?.controller.abort()
      operation.current = null
      setBusy(false)
      setPassword('')
      setConfirmation('')
      setActivationCode('')
      setOtp('')
      setChallenge(null)
      setPhone('')
      setFields({})
      setError('')
      setNotice('')
      setVisible(false)
      setResendUntil(0)
      setPhase(initialPhase(page))
    })
    return () => {
      mounted.current = false
      operation.current?.controller.abort()
      operation.current = null
      unsubscribe()
    }
  }, [api, page])

  useEffect(() => {
    if (!challenge && !resendUntil && !retryUntil) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [challenge, resendUntil, retryUntil])

  useEffect(() => {
    if (challenge && Date.parse(challenge.challenge_expires_at) <= now) {
      operation.current?.controller.abort()
      operation.current = null
      setBusy(false)
      setChallenge(null)
      setOtp('')
      setPassword('')
      setConfirmation('')
      setPhase('login')
      setFields({})
      setError('انتهت صلاحية تحدي تسجيل الدخول. سجّل الدخول بكلمة مرورك مجدداً.')
      setNotice('')
    }
  }, [challenge, now])

  async function run<T>(
    path: string,
    body: unknown,
    success: (response: T, current: () => boolean) => void | Promise<void>,
  ) {
    // The ref locks synchronously, before a render can disable the button.
    if (operation.current || Date.now() < retryUntil) return
    const pending: Operation = { controller: new AbortController() }
    operation.current = pending
    const current = () =>
      mounted.current && operation.current === pending && !pending.controller.signal.aborted
    setBusy(true)
    setError('')
    setFields({})
    setNotice('')
    try {
      const response = await api.request<T>(path, 'POST', {
        body,
        public: true,
        signal: pending.controller.signal,
      })
      if (!current()) return
      await success(response, current)
    } catch (failure) {
      if (!current()) return
      if (failure instanceof ApiError) {
        const codeMessage = otpError(failure)
        if (activating) {
          const message = invitationError(failure)
          const field = failure.code === 'phone_invalid' ? 'whatsapp_number' :
            failure.code === 'otp_invalid' || failure.code === 'otp_expired' ? 'code' :
              ['whatsapp_number', 'code', 'password', 'password_confirmation'].find((name) => Object.hasOwn(failure.fields, name))
          if (failure.code === 'otp_exhausted') {
            clearSecrets()
            setError(message)
          } else if (field) setFields({ [field]: message })
          else setError(message)
        } else if (failure.code === 'phone_invalid' && phase !== 'otp') {
          setFields({ whatsapp_number: invalidPhoneMessage })
        } else if (failure.code === 'password_reused' && phase !== 'login') {
          setFields({ password: 'يجب أن تختلف كلمة المرور الجديدة عن الحالية.' })
        } else if (failure.code === 'otp_exhausted') {
          clearSecrets()
          setResendUntil(0)
          setPhase(phase === 'otp' ? 'login' : phase === 'reset' ? 'forgot' : phase)
          setError(codeMessage ?? apiErrorMessage(failure))
        } else if (codeMessage) {
          const field = phase === 'forgot' ? 'whatsapp_number' : phase === 'login' ? null : 'otp'
          if (field) setFields({ [field]: codeMessage })
          else setError(codeMessage)
        } else if (
          phase === 'login' &&
          (failure.status === 401 ||
            failure.status === 422 && (Object.hasOwn(failure.fields, 'whatsapp_number') ||
              Object.hasOwn(failure.fields, 'password')))
        ) {
          setError(rejectedCredentials)
        } else if (Object.hasOwn(failure.fields, 'login_challenge')) {
          clearSecrets()
          setPhase('login')
          setNotice('لم يعد تحدي تسجيل الدخول صالحاً. سجّل الدخول بكلمة مرورك مجدداً.')
        } else {
          const field = ['whatsapp_number', 'code', 'otp', 'password', 'password_confirmation'].find(
            (name) => Object.hasOwn(failure.fields, name),
          )
          if (field) setFields({ [field]: apiErrorMessage(failure) })
          else setError(apiErrorMessage(failure))
        }
        if (failure.retryAfter > 0) {
          const deadline = Date.now() + failure.retryAfter * 1000
          if (failure.code === 'otp_cooldown' && (phase === 'otp' || phase === 'reset')) {
            setResendUntil(deadline)
          } else {
            setRetryUntil(deadline)
          }
          setNow(Date.now())
        }
      } else setError(activating ? 'تعذّر تفعيل الحساب الآن. أعد المحاولة.' : apiErrorMessage(failure))
    } finally {
      if (current()) {
        operation.current = null
        setBusy(false)
      }
    }
  }

  async function signIn(response: AuthResponse, current: () => boolean) {
    if (!current()) return
    clearSecrets()
    if ('requires_2fa' in response && response.requires_2fa === true) {
      if (
        typeof response.login_challenge !== 'string' ||
        !/^[A-Za-z0-9]{64}$/.test(response.login_challenge) ||
        typeof response.request_reference !== 'string' ||
        !/^[a-fA-F0-9]{8}$/.test(response.request_reference) ||
        typeof response.challenge_expires_at !== 'string' ||
        !(Date.parse(response.challenge_expires_at) > Date.now())
      )
        throw new ApiError(502)
      const normalized = internationalPhone(phone, region)
      if (!normalized) throw new ApiError(422)
      setChallenge({
        requires_2fa: true,
        login_challenge: response.login_challenge,
        challenge_expires_at: response.challenge_expires_at,
        request_reference: response.request_reference,
        phone: normalized,
      })
      setPhase('otp')
      setNow(Date.now())
      setResendUntil(Date.now() + 60000)
      return
    }
    if (phase === 'otp') setPhase('login')
    const supplied = response as ApiSession
    if (!supplied?.user || typeof supplied.user.id !== 'string') throw new ApiError(502)
    // Keep only documented identity fields: raw /auth user serialization can also
    // contain unrelated patient/clinical relations that must not enter this portal.
    const identity = supplied.user
    if (
      typeof identity.name !== 'string' ||
      (identity.email !== null && typeof identity.email !== 'string') ||
      typeof identity.whatsapp_number !== 'string' ||
      typeof identity.role !== 'string' ||
      typeof identity.is_active !== 'boolean' ||
      (identity.phone_verified_at !== null && typeof identity.phone_verified_at !== 'string') ||
      typeof identity.timezone !== 'string'
    )
      throw new ApiError(502)
    const accepted: ApiSession = {
      access_token: supplied.access_token,
      refresh_token: supplied.refresh_token,
      token_type: supplied.token_type,
      expires_at: supplied.expires_at,
      refresh_expires_at: supplied.refresh_expires_at,
      user: {
        id: apiId(identity.id),
        name: identity.name,
        email: identity.email,
        whatsapp_number: identity.whatsapp_number,
        role: identity.role,
        is_active: identity.is_active,
        phone_verified_at: identity.phone_verified_at,
        timezone: identity.timezone,
      },
    }
    // ApiClient rejects patient/staff/inactive/unverified sessions and attempts
    // to revoke their issued access token rather than treating them as therapists.
    establishing.current = true
    let established: Promise<void>
    try {
      established = api.establish(accepted)
    } finally {
      establishing.current = false
    }
    await established
    if (!current()) return
    clearSecrets()
    setPhone('')
    navigate(activating ? '/profile/approval' : '/dashboard')
  }

  const normalizedPhone = internationalPhone(phone, region)
  const newPasswordValid = validNewPassword(password) && confirmation === password
  const otpValid = /^[0-9]{6}$/.test(otp)
  const challengeValid = !!challenge && Date.parse(challenge.challenge_expires_at) > now
  const valid =
    phase === 'otp'
      ? otpValid && challengeValid
      : phase === 'forgot' ||
          (phase === 'login'
            ? password.length > 0
            : newPasswordValid &&
              (phase === 'activate' ? /^[A-Za-z0-9]{8}$/.test(activationCode.trim()) : otpValid))
  const retrySeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000))
  const resendSeconds = Math.max(0, Math.ceil((Math.max(resendUntil, retryUntil) - now) / 1000))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (phase !== 'otp' && !normalizedPhone) {
      setFields((previous) => ({ ...previous, whatsapp_number: phoneError }))
      return
    }
    if (!valid || operation.current || Date.now() < retryUntil) return
    if (phase === 'otp') {
      if (!challenge || Date.parse(challenge.challenge_expires_at) <= Date.now()) return
      void run<AuthResponse>(
        '/auth/login/2fa',
        { whatsapp_number: challenge.phone, otp, login_challenge: challenge.login_challenge },
        signIn,
      )
    } else if (phase === 'login') {
      void run<AuthResponse>('/auth/login', { whatsapp_number: normalizedPhone, password }, signIn)
    } else if (phase === 'activate') {
      void run<ApiSession>(
        '/auth/activate',
        {
          whatsapp_number: normalizedPhone,
          code: activationCode.trim().toUpperCase(),
          password,
          password_confirmation: confirmation,
        },
        signIn,
      )
    } else if (phase === 'forgot') {
      void run<{ message: string }>(
        '/auth/forgot-password',
        { whatsapp_number: normalizedPhone },
        () => {
          clearSecrets()
          setPhone(normalizedPhone ?? '')
          setPhase('reset')
          setNotice('إذا كان هذا الرقم مسجلاً، فقد أُرسل رمز استعادة. تحقق من واتساب.')
          setResendUntil(Date.now() + 60000)
          setNow(Date.now())
        },
      )
    } else {
      void run<{ message: string }>(
        '/auth/reset-password',
        {
          whatsapp_number: normalizedPhone,
          otp,
          password,
          password_confirmation: confirmation,
        },
        () => {
          clearSecrets()
          setPhone('')
          // Reset revokes all sessions. The resulting clear intentionally cancels
          // the old operation; reset never establishes or navigates to a dashboard.
          api.clear()
          setPhase('login')
          setNotice('حُدّثت كلمة المرور بنجاح. سجّل الدخول بكلمة مرورك الجديدة.')
          navigate('/login')
        },
      )
    }
  }

  function resend() {
    if (operation.current || Date.now() < Math.max(resendUntil, retryUntil)) return
    if (phase === 'otp') {
      if (!challenge || Date.parse(challenge.challenge_expires_at) <= Date.now()) return
      void run<{ message: string }>(
        '/auth/login/2fa/resend',
        { whatsapp_number: challenge.phone, login_challenge: challenge.login_challenge },
        () => {
          setOtp('')
          setResendUntil(Date.now() + 60000)
          setNow(Date.now())
          setNotice('إذا كان هناك تسجيل دخول للطاقم معلّق، فقد أُرسل رمز جديد. تحقق من واتساب.')
        },
      )
    } else if (phase === 'reset') {
      if (!normalizedPhone) {
        setFields((previous) => ({ ...previous, whatsapp_number: invalidPhoneMessage }))
        return
      }
      void run<{ message: string }>(
        '/auth/forgot-password',
        { whatsapp_number: normalizedPhone },
        () => {
          setOtp('')
          setResendUntil(Date.now() + 60000)
          setNow(Date.now())
          setNotice('إذا كان هذا الرقم مسجلاً، فقد أُرسل رمز استعادة. تحقق من واتساب.')
        },
      )
    }
  }

  function changePhase(next: Phase) {
    cancel()
    setPhase(next)
  }

  function fieldError(name: string) {
    const message = fields[name] ??
      (name === 'password' && phase !== 'login' && password && !validNewPassword(password)
        ? activating ? 'استخدم ٨ أحرف على الأقل، تتضمن حرفًا ورقمًا.' : passwordPolicyMessage
        : '')
    return message ? <span className="live-auth-field-error" role="alert">{message}</span> : null
  }

  function editField(name: string) {
    setFields((previous) => Object.fromEntries(Object.entries(previous).filter(([key]) => key !== name)))
    if (error === rejectedCredentials) setError('')
  }

  const challengeExpiry = formatTimestamp(challenge?.challenge_expires_at, undefined)
  const title =
    phase === 'activate'
      ? 'تفعيل دعوة المعالج'
      : phase === 'forgot'
        ? 'نسيت كلمة المرور؟'
        : phase === 'reset'
          ? 'استعادة كلمة المرور'
          : phase === 'otp'
            ? 'تحقق من رمز واتساب'
            : 'تسجيل الدخول إلى سكينة'
  const action =
    phase === 'activate'
      ? 'تفعيل الحساب'
      : phase === 'forgot'
        ? 'طلب رمز الاستعادة'
        : phase === 'reset'
          ? 'استعادة كلمة المرور'
          : phase === 'otp'
            ? 'Verify'
            : 'Login'

  return (
    <AuthCardShell
      title={title}
      arabic={activating}
      description={activating
        ? 'أدخل رمز الدعوة الذي وصلك عبر واتساب، ثم اختر كلمة مرور لحسابك.'
        : phase === 'otp'
          ? 'أدخل الرمز المكوّن من ست خانات المرسل عبر واتساب لطلب تسجيل الدخول هذا.'
          : phase === 'reset'
            ? 'أدخل رمز الاستعادة المكوّن من ست خانات وكلمة مرورك الجديدة معاً.'
            : 'استخدم رقم واتساب المحلي أو الدولي.'}
      footer={(
        <>
          {(phase === 'otp' || phase === 'reset') && (
            <p className="auth-switch">
              لم يصلك الرمز؟
              <button type="button" disabled={busy || resendSeconds > 0 || (phase === 'otp' && !challengeValid)} onClick={resend}>
                {resendSeconds > 0 ? `إعادة الإرسال (${resendSeconds} ث)` : 'إعادة الإرسال'}
              </button>
            </p>
          )}
          <p className="auth-switch">
            {phase === 'login' ? (
              <>
                لديك دعوة إدارية؟
                <a href="/activate" onClick={(event) => {
                  event.preventDefault()
                  cancel()
                  navigate('/activate')
                }}>
                  تفعيل الدعوة
                </a>
              </>
            ) : (
              <button type="button" onClick={() => activating ? navigate('/login') : changePhase('login')}>
                {activating ? 'العودة إلى تسجيل الدخول' : 'إلغاء والعودة لتسجيل الدخول'}
              </button>
            )}
          </p>
          <p className="auth-legal">
            {activating
              ? 'هذه البوابة للمعالجين المدعوين فقط. يبقى رمز الوصول في الذاكرة، وتحفظ علامة التبويب رمز تجديد الجلسة لتبقى مسجّل الدخول بعد إعادة تحميل الصفحة.'
              : 'هذه البوابة للمعالجين المدعوين فقط. تسجيل الدخول عبر Google والتسجيل العام للمعالجين غير متاحين. يبقى رمز الوصول في الذاكرة، وتحفظ علامة التبويب رمز تجديد الجلسة لتبقى مسجّل الدخول بعد إعادة التحميل.'}
          </p>
        </>
      )}
    >
            {phase === 'activate' && (
              <p className="live-auth-help">
                الدعوة صالحة لمدة ٢٤ ساعة. إذا انتهت صلاحيتها، اطلب دعوة جديدة من الإدارة.
                تفعيل الحساب يسبق إرسال الملف المهني للمراجعة ولا يعني الموافقة عليه.
              </p>
            )}
            {phase === 'otp' && challenge && (
              <div className="auth-notice live-auth-request">
                <p>{challenge.phone}</p>
                <p>Request reference: {challenge.request_reference}</p>
                <p>
                  {challengeExpiry ? (
                    <>تنتهي صلاحية التحدي في <time dateTime={challenge.challenge_expires_at}>{challengeExpiry}</time>.</>
                  ) : 'وقت انتهاء التحدي غير متاح.'}{' '}
                  إعادة الإرسال لا تمدد هذه الصلاحية.
                </p>
              </div>
            )}
            <form onSubmit={submit} className="auth-form" aria-busy={busy}>
              {phase !== 'otp' && (
                <label>
                  {activating ? 'البلد أو المنطقة' : 'الدولة أو المنطقة'}
                  <select value={region} disabled={busy} onChange={(event) => {
                    editField('whatsapp_number')
                    setRegion(event.target.value as CountryCode)
                  }}>
                    {countries[activating ? 'ar' : 'en'].map(({ code, name, dial }) => (
                      <option key={code} value={code}>{name} (+{dial})</option>
                    ))}
                  </select>
                </label>
              )}
              {phase !== 'otp' && (
                <label>
                  {phoneLabel}
                  <input
                    name="whatsapp_number"
                    type="tel"
                    autoComplete="tel"
                    aria-label={phoneLabel}
                    aria-describedby="auth-phone-help"
                    placeholder="09XXXXXXXX"
                    dir="ltr"
                    value={phone}
                    onChange={(event) => {
                      editField('whatsapp_number')
                      setPhone(event.target.value)
                    }}
                    onBlur={() => {
                      if (phone && !normalizedPhone)
                        setFields((previous) => ({ ...previous, whatsapp_number: phoneError }))
                    }}
                    aria-invalid={Object.hasOwn(fields, 'whatsapp_number')}
                    disabled={busy}
                    required
                  />
                  <span id="auth-phone-help" className="live-auth-help">
                    {activating ? 'اختر بلدك للرقم المحلي، أو أدخل الرقم الدولي مبتدئًا بـ + أو 00.' :
                      'لرقم محلي، اختر دولتك. الأرقام الدولية قد تبدأ بـ + أو 00.'}
                  </span>
                  {fieldError('whatsapp_number')}
                </label>
              )}
              {phase === 'activate' && (
                <label>
                  رمز التفعيل
                  <input
                    name="code"
                    aria-label="رمز التفعيل"
                    dir="ltr"
                    autoComplete="one-time-code"
                    value={activationCode}
                    onChange={(event) => {
                      editField('code')
                      setActivationCode(event.target.value)
                    }}
                    minLength={8}
                    maxLength={8}
                    pattern="[A-Za-z0-9]{8}"
                    placeholder="٨ أحرف أو أرقام"
                    aria-invalid={Object.hasOwn(fields, 'code')}
                    disabled={busy}
                    required
                  />
                  {fieldError('code')}
                </label>
              )}
              {(phase === 'otp' || phase === 'reset') && (
                <label>
                  {phase === 'reset' ? 'رمز الاستعادة' : 'رمز التحقق'}
                  <input
                    name="otp"
                    aria-label={phase === 'reset' ? 'رمز الاستعادة' : 'رمز التحقق'}
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    value={otp}
                    onChange={(event) => {
                      editField('otp')
                      setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                    }}
                    aria-invalid={Object.hasOwn(fields, 'otp')}
                    disabled={busy}
                    required
                  />
                  {fieldError('otp')}
                </label>
              )}
              {(phase === 'login' || phase === 'activate' || phase === 'reset') && (
                <label>
                  {passwordLabel}
                  <span className="password-field">
                    <input
                      name="password"
                      aria-label={passwordLabel}
                      type={visible ? 'text' : 'password'}
                      autoComplete={phase === 'login' ? 'current-password' : 'new-password'}
                      minLength={phase === 'login' ? undefined : 8}
                      value={password}
                      onChange={(event) => {
                        editField('password')
                        setPassword(event.target.value)
                      }}
                      aria-invalid={Object.hasOwn(fields, 'password') || (phase !== 'login' && !!password && !validNewPassword(password))}
                      disabled={busy}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={activating ? visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور' : visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      aria-pressed={visible}
                      onClick={() => setVisible(!visible)}
                    >
                      <Icon name="auth-imgEye.svg" />
                    </button>
                  </span>
                  {fieldError('password')}
                </label>
              )}
              {(phase === 'activate' || phase === 'reset') && (
                <label>
                  {activating ? 'تأكيد كلمة المرور' : 'تأكيد كلمة المرور'}
                  <input
                    name="password_confirmation"
                    aria-label={activating ? 'تأكيد كلمة المرور' : 'تأكيد كلمة المرور'}
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmation}
                    onChange={(event) => {
                      editField('password_confirmation')
                      setConfirmation(event.target.value)
                    }}
                    aria-invalid={Object.hasOwn(fields, 'password_confirmation')}
                    disabled={busy}
                    required
                  />
                  {fieldError('password_confirmation')}
                </label>
              )}
              {phase === 'login' && (
                <button type="button" className="forgot-link" onClick={() => changePhase('forgot')}>
                  نسيت كلمة المرور
                </button>
              )}
              <button
                type="submit"
                className="primary-button"
                disabled={!valid || busy || retrySeconds > 0}
              >
                {busy ? activating ? 'جارٍ التفعيل…' : 'يرجى الانتظار…' : action}
              </button>
            </form>
            {error && <p className="live-auth-feedback" role="alert">{error}</p>}
            {retrySeconds > 0 && error && <p className="live-auth-feedback" role="status">
              {activating ? `يمكنك المحاولة مجددًا بعد ${retrySeconds} ثانية.` : `حاول مجدداً بعد ${retrySeconds} ثانية.`}
            </p>}
            {revocationUnknown && (
              <p className="auth-notice" role="status">
                سُجّل خروجك محلياً. تعذّر تأكيد إلغاء الجلسة على الخادم؛ سجّل الدخول واستخدم «تسجيل الخروج من جميع الأجهزة» قبل ترك جهاز مشترك.
              </p>
            )}
            {notice && (
              <p className="auth-notice" role="status">
                {notice}
              </p>
            )}
            {phase === 'reset' && (
              <p className="live-auth-help">تنتهي صلاحية رموز الاستعادة بعد خمس دقائق. اطلب رمزاً آخر عند الحاجة.</p>
            )}
    </AuthCardShell>
  )
}
