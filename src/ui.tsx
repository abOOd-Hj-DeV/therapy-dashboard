import { useEffect, useRef, type ReactNode } from 'react'
import { asset } from './assets'
import './visual-auth-shell.css'

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <img className={`icon ${className}`} src={asset(name)} alt="" aria-hidden="true" />
}

export function Logo({ wordmark = false }: { wordmark?: boolean }) {
  return (
    <span className="brand" aria-label="Sakina">
      <span className="brand-symbol">
        <img src={asset('auth-imgRectangle6.png')} alt="" />
      </span>
      {wordmark && (
        <img className="brand-wordmark" src={asset('dashboard-imgLabel.png')} alt="Sakina" />
      )}
    </span>
  )
}

export function Modal({
  title,
  children,
  onClose,
  className = '',
  closeIcon,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  className?: string
  closeIcon?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const pointerOrigin = useRef<EventTarget | null>(null)
  useEffect(() => {
    const dialog = ref.current!
    const previousFocus = document.activeElement as HTMLElement | null
    let cancelled = false
    const show = () => {
      if (!cancelled) dialog.showModal()
    }
    if (document.fonts) void document.fonts.ready.then(show)
    else show()
    function containFocus(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
        ),
      )
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    dialog.addEventListener('keydown', containFocus)
    return () => {
      cancelled = true
      dialog.removeEventListener('keydown', containFocus)
      dialog.close()
      previousFocus?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby="modal-title"
      onCancel={onClose}
      onPointerDownCapture={(event) => {
        pointerOrigin.current = event.target
      }}
      onClick={(event) => {
        const startedInside = pointerOrigin.current !== null && pointerOrigin.current !== event.currentTarget
        pointerOrigin.current = null
        if (event.target === event.currentTarget && !startedInside) onClose()
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          {closeIcon ?? '×'}
        </button>
      </div>
      {children}
    </dialog>
  )
}
