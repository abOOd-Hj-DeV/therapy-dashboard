import { useEffect, useId, useRef, type ReactNode } from 'react'
import { asset } from './assets'
import { Logo } from './ui'

export function AuthCardShell({ title, description, arabic, focusHeading, children, footer }: {
  title: string
  description?: string
  arabic?: boolean
  focusHeading?: boolean
  children?: ReactNode
  footer?: ReactNode
}) {
  const heading = useId()
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusHeading && !document.activeElement?.closest('form')) headingRef.current?.focus()
  }, [focusHeading, title])
  return (
    <main className="auth-page visual-auth live-auth" lang={arabic ? 'ar' : undefined} dir={arabic ? 'rtl' : undefined}>
      <img className="auth-glow" src={asset('auth-imgEllipse1559.svg')} alt="" />
      <div className="auth-stack">
        <div className="auth-glass">
          <section className="auth-card" aria-labelledby={heading}>
            <header className="auth-heading">
              <Logo />
              <div>
                <h1 id={heading} ref={headingRef} tabIndex={focusHeading ? -1 : undefined}>{title}</h1>
                {description && <p>{description}</p>}
              </div>
            </header>
            {children}
          </section>
        </div>
        {footer}
      </div>
    </main>
  )
}
