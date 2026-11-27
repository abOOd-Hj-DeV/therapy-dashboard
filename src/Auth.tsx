import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Icon, Logo, Modal } from './ui'
import { asset } from './assets'
import { type ApiClient } from './api'
import { LiveAuthentication } from './api-authentication-live'

export type AuthPage =
  | 'login'
  | 'signup'
  | 'activate'
  | 'verify'
  | 'forgot-password'
  | 'reset-password'
export type AuthProps = {
  page: AuthPage
  navigate: (path: string) => void
  verificationEmail: string
  onCreateAccount: (email: string) => void
  api?: ApiClient
}
const legal =
  "بمتابعتك، توافق على شروط الخدمة وسياسة الخصوصية الخاصة بسكينة، وعلى استلام رسائل بريدية دورية بالتحديثات."

export function Auth(props: AuthProps) {
  if (!props.api) return <DemoAuth {...props} />
  const path = window.location.pathname.replace(/\/$/, '')
  const page =
    props.page === 'login' &&
    (path === '/activate' || path === '/forgot-password' || path === '/reset-password')
      ? (path.slice(1) as AuthPage)
      : props.page
  return <LiveAuthentication key={page} api={props.api} page={page} navigate={props.navigate} />
}

function DemoAuth({ page, navigate, verificationEmail, onCreateAccount }: AuthProps) {
  const [email, setEmail] = useState(page === 'verify' ? verificationEmail : '')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [modal, setModal] = useState<'google' | 'forgot' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const signup = page === 'signup'
  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8 &&
    (!signup || (firstName.trim() && lastName.trim()))

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    timer.current = setTimeout(() => {
      setBusy(false)
      if (signup) onCreateAccount(email)
      else navigate('/dashboard')
    }, 600)
  }

  return (
    <main
      className={`auth-page visual-auth demo-auth ${page === 'verify' ? 'demo-verify' : signup ? 'signup-page' : 'demo-login'}`}
    >
      <img className="auth-glow" src={asset('auth-imgEllipse1559.svg')} alt="" />
      <div className="auth-stack">
        <div className="auth-glass">
          <section className="auth-card" aria-labelledby="auth-heading">
            {page === 'verify' ? (
              <Verification email={email} onVerified={() => navigate('/dashboard')} />
            ) : (
              <>
                <div className="auth-card-content">
                  <div className="auth-intro">
                    <header className="auth-heading">
                      <Logo />
                      <div>
                        <h1 id="auth-heading">{signup ? 'أنشئ حسابك' : 'تسجيل الدخول إلى سكينة'}</h1>
                        <p>مرحباً بعودتك! سجّل الدخول للمتابعة</p>
                      </div>
                    </header>
                    <button className="google-button" onClick={() => setModal('google')}>
                      <Icon name="auth-imgGoogle.svg" />
                      Continue with Google
                      <span />
                    </button>
                  </div>
                  <div className="divider">
                    <span />
                    OR
                    <span />
                  </div>
                  <form id="demo-auth-form" onSubmit={submit} className="auth-form">
                  {signup && (
                    <div className="name-fields">
                      <label>
                        First Name
                        <input
                          name="given-name"
                          autoComplete="given-name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="الاسم الأول"
                          required
                        />
                      </label>
                      <label>
                        Last Name
                        <input
                          name="family-name"
                          autoComplete="family-name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="اسم العائلة"
                          required
                        />
                      </label>
                    </div>
                  )}
                  <label>
                    {signup ? 'البريد المهني' : 'البريد الإلكتروني'}
                    <input
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder={signup ? 'الاسم الأول' : 'أدخل بريدك الإلكتروني'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <span className="password-field">
                      <input
                        name="password"
                        type={visible ? 'text' : 'password'}
                        autoComplete={signup ? 'new-password' : 'current-password'}
                        placeholder="Password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        aria-label={visible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        aria-pressed={visible}
                        onClick={() => setVisible(!visible)}
                      >
                        <Icon name="auth-imgEye.svg" />
                      </button>
                    </span>
                  </label>
                  {!signup && (
                    <button
                      type="button"
                      className="forgot-link"
                      onClick={() => setModal('forgot')}
                    >
                      Forgot Password
                    </button>
                  )}
                  </form>
                </div>
                <button
                  type="submit"
                  form="demo-auth-form"
                  className="primary-button"
                  disabled={!valid || busy}
                >
                  {busy ? (
                    <>
                      <span className="spinner" />
                      {signup ? 'Creating…' : 'جارٍ تسجيل الدخول…'}
                    </>
                  ) : signup ? (
                    'Create'
                  ) : (
                    'Login'
                  )}
                </button>
              </>
            )}
          </section>
        </div>
        {page === 'verify' ? (
          <p className="auth-switch">
            Not receiving code?
            <button onClick={() => setNotice('عرض تجريبي: طُلب رمز جديد. لا يُرسل بريد.')}>
              Resend
            </button>
          </p>
        ) : (
          <p className="auth-switch">
            {signup ? 'لديّ حساب بالفعل' : 'ليس لديك حساب؟'}
            <a
              href={signup ? '/login' : '/signup'}
              onClick={(event) => {
                event.preventDefault()
                navigate(signup ? '/login' : '/signup')
              }}
            >
              {signup ? 'سجّل الدخول الآن!' : 'أنشئ حساباً الآن!'}
            </a>
          </p>
        )}
        <p className="auth-legal">{legal}</p>
        {notice && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}
      </div>
      {modal && (
        <Modal
          title={modal === 'google' ? 'تسجيل الدخول عبر Google' : 'استعادة كلمة المرور'}
          onClose={() => setModal(null)}
        >
          <p>
            {modal === 'google'
              ? 'مصادقة Google غير متصلة في هذا العرض التجريبي.'
              : 'استعادة كلمة المرور تحتاج API المصادقة. لن يُرسل بريد من هذا العرض.'}
          </p>
          <button
            className="primary-button"
            onClick={() => {
              setModal(null)
              navigate('/dashboard')
            }}
          >
            Explore demo dashboard
          </button>
        </Modal>
      )}
    </main>
  )
}

function Verification({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState<string[]>(Array(5).fill(''))
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  function change(index: number, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 5 - index)
    setCode((previous) => {
      const next = [...previous]
      next[index] = ''
      ;[...digits].forEach((digit, offset) => {
        next[index + offset] = digit
      })
      return next
    })
    if (digits) inputs.current[Math.min(index + digits.length, 4)]?.focus()
  }
  return (
    <form
      className="verification"
      onSubmit={(event) => {
        event.preventDefault()
        if (code.every(Boolean)) onVerified()
      }}
    >
      <Icon name="otp-imgMood.svg" className="verification-mood" />
      <header>
        <h1 id="auth-heading">أرسلنا إليك بريداً للتو.</h1>
        <p>أدخل الرمز الذي أرسلناه إليك بالبريد.</p>
      </header>
      <p>{email}</p>
      <div className="otp-inputs" role="group" aria-label="رمز التحقق">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputs.current[index] = node
            }}
            aria-label={`الخانة ${index + 1} من الرمز`}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]"
            value={digit}
            onChange={(e) => change(index, e.target.value)}
            onPaste={(e) => {
              e.preventDefault()
              change(index, e.clipboardData.getData('text'))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' && !digit) inputs.current[Math.max(0, index - 1)]?.focus()
              if (e.key === 'ArrowLeft') inputs.current[Math.max(0, index - 1)]?.focus()
              if (e.key === 'ArrowRight') inputs.current[Math.min(4, index + 1)]?.focus()
            }}
          />
        ))}
      </div>
      <button className="primary-button" disabled={!code.every(Boolean)}>
        Verify
      </button>
    </form>
  )
}
