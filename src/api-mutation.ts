import { useEffect, useRef, useState } from 'react'
import type { ApiClient } from './api'

// A synchronous lock prevents double clicks before React updates. Aborting/unmounting
// and actor checks also protect against transports that resolve despite cancellation.
export function useMutation(api: ApiClient) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const active = useRef(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
      request.current?.abort()
    }
  }, [api])
  async function run<T>(
    work: (signal: AbortSignal) => Promise<T>,
    success: (value: T) => void,
    failed?: (error: unknown) => void,
  ) {
    if (request.current || !active.current || !api.getUser()) return
    const actor = api.getSessionKey()
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(null)
    const current = () =>
      active.current && !controller.signal.aborted && api.getSessionKey() === actor
    try {
      const value = await work(controller.signal)
      if (current()) success(value)
    } catch (cause) {
      if (current()) {
        setError(cause)
        failed?.(cause)
      }
    } finally {
      if (request.current === controller) request.current = null
      if (current()) setPending(false)
    }
  }
  return { pending, error, run }
}
