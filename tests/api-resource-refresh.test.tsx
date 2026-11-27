import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError, type ApiUser } from '../src/api'
import { useApiResource } from '../src/api-hooks'
import {
  useCareMutation,
  useCareResource,
} from '../src/api-sessions-and-clinical-support'

function makeApi(
  get: (path: string, signal?: AbortSignal) => Promise<unknown>,
  mutate: () => Promise<unknown> = () => Promise.resolve({}),
) {
  const listeners = new Set<() => void>()
  const user = { id: 'therapist-id' } as ApiUser
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    getUser: () => user,
    getSessionKey: () => 1,
    get,
    mutate,
  } as unknown as ApiClient
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function flush() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

const originalOnlineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: online })
}

afterEach(() => {
  vi.useRealTimers()
  if (originalOnlineDescriptor) {
    Object.defineProperty(window.navigator, 'onLine', originalOnlineDescriptor)
  } else {
    Reflect.deleteProperty(window.navigator, 'onLine')
  }
})

describe('background resource refresh', () => {
  it('marks foreground useCareResource reloads stale while background refresh stays quiet', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const background = deferred<{ value: string }>()
    const foreground = deferred<{ value: string }>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockReturnValueOnce(background.promise)
      .mockReturnValueOnce(foreground.promise)
    const api = makeApi(get)
    const { result } = renderHook(() =>
      useCareResource<{ value: string }>(api, '/resource', 'single', { interval: 0 }),
    )

    await flush()
    expect(result.current.data).toEqual({ value: 'initial' })
    expect(result.current.loading).toBe(false)

    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current.data).toEqual({ value: 'initial' })
    expect(result.current.loading).toBe(false)
    await act(async () => {
      background.resolve({ value: 'background' })
      await background.promise
    })

    act(() => result.current.reload())
    expect(result.current.data).toEqual({ value: 'background' })
    expect(result.current.loading).toBe(true)
    await act(async () => {
      foreground.resolve({ value: 'foreground' })
      await foreground.promise
    })
    expect(result.current.data).toEqual({ value: 'foreground' })
    expect(result.current.loading).toBe(false)
  })

  it('marks foreground useApiResource reloads loading while retaining data', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const background = deferred<{ value: string }>()
    const foreground = deferred<{ value: string }>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockReturnValueOnce(background.promise)
      .mockReturnValueOnce(foreground.promise)
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    await flush()
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current.data).toEqual({ value: 'initial' })
    expect(result.current.loading).toBe(false)
    await act(async () => {
      background.resolve({ value: 'background' })
      await background.promise
    })

    act(() => result.current.reload())
    expect(result.current.data).toEqual({ value: 'background' })
    expect(result.current.loading).toBe(true)
    await act(async () => {
      foreground.resolve({ value: 'foreground' })
      await foreground.promise
    })
    expect(result.current.data).toEqual({ value: 'foreground' })
    expect(result.current.loading).toBe(false)
  })

  it('refreshes useApiResource on focus and the visible polling interval without dropping data', async () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const focused = deferred<{ value: string }>()
    const polled = deferred<{ value: string }>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockReturnValueOnce(focused.promise)
      .mockReturnValueOnce(polled.promise)
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    await flush()
    expect(result.current.data).toEqual({ value: 'initial' })

    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current.data).toEqual({ value: 'initial' })
    expect(result.current.loading).toBe(false)
    await act(async () => {
      focused.resolve({ value: 'focused' })
      await focused.promise
    })
    expect(result.current.data).toEqual({ value: 'focused' })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(result.current.data).toEqual({ value: 'focused' })
    expect(result.current.loading).toBe(false)
    await act(async () => {
      polled.resolve({ value: 'polled' })
      await polled.promise
    })
    expect(result.current.data).toEqual({ value: 'polled' })
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('skips useApiResource background refreshes offline and resumes on the online event', async () => {
    vi.useFakeTimers()
    setOnline(false)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const get = vi.fn()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockResolvedValueOnce({ value: 'online' })
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    await flush()
    act(() => window.dispatchEvent(new Event('focus')))
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(get).toHaveBeenCalledTimes(1)

    setOnline(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ value: 'online' })
  })

  it('skips useCareResource background refreshes offline and resumes on the online event', async () => {
    vi.useFakeTimers()
    setOnline(false)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const get = vi.fn()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockResolvedValueOnce({ value: 'online' })
    const api = makeApi(get)
    const { result } = renderHook(() =>
      useCareResource<{ value: string }>(api, '/resource', 'single'),
    )

    await flush()
    act(() => window.dispatchEvent(new Event('focus')))
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(get).toHaveBeenCalledTimes(1)

    setOnline(true)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(get).toHaveBeenCalledTimes(2)
    expect(result.current.data).toEqual({ value: 'online' })
  })

  it('keeps the pending-approval error when useApiResource polling fails transiently', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const pendingApproval = new ApiError(403, {}, 0, 'therapist_pending_approval', {
      approval_status: 'pending',
    })
    const get = vi.fn()
      .mockRejectedValueOnce(pendingApproval)
      .mockRejectedValueOnce(new ApiError(503))
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource(api, '/therapists/me/dashboard'))

    await flush()
    expect(result.current.error).toBe(pendingApproval)
    act(() => window.dispatchEvent(new Event('focus')))
    await flush()

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe(pendingApproval)
  })

  it('clears stale approved data after an authoritative useApiResource 4xx', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const suspended = new ApiError(403, {}, 0, 'therapist_pending_approval', {
      approval_status: 'suspended',
    })
    const get = vi.fn()
      .mockResolvedValueOnce({ therapist: { approval_status: 'approved' } })
      .mockRejectedValueOnce(suspended)
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ therapist: { approval_status: string } }>(
      api,
      '/therapists/me/dashboard',
    ))

    await flush()
    expect(result.current.data?.therapist.approval_status).toBe('approved')
    act(() => window.dispatchEvent(new Event('focus')))
    await flush()

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe(suspended)
  })

  it('keeps a useCareResource error unchanged after a transient background failure', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const pendingApproval = new ApiError(403, {}, 0, 'therapist_pending_approval')
    const get = vi.fn()
      .mockRejectedValueOnce(pendingApproval)
      .mockRejectedValueOnce(new ApiError(503))
    const api = makeApi(get)
    const { result } = renderHook(() =>
      useCareResource<{ value: string }>(api, '/resource', 'single', { interval: 0 }),
    )

    await flush()
    act(() => window.dispatchEvent(new Event('focus')))
    await flush()

    expect(result.current.error).toBe(pendingApproval)
    expect(result.current.data).toBeNull()
  })

  it('clears useCareResource data after an authoritative background 4xx', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const suspended = new ApiError(403, {}, 0, 'therapist_suspended')
    const get = vi.fn()
      .mockResolvedValueOnce({ value: 'approved' })
      .mockRejectedValueOnce(suspended)
    const api = makeApi(get)
    const { result } = renderHook(() =>
      useCareResource<{ value: string }>(api, '/resource', 'single', { interval: 0 }),
    )

    await flush()
    act(() => window.dispatchEvent(new Event('focus')))
    await flush()

    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe(suspended)
  })

  it.each([408, 429])('keeps useApiResource state unchanged after a background %i', async (status) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const foregroundError = new ApiError(503)
    const get = vi.fn()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockRejectedValueOnce(foregroundError)
      .mockRejectedValueOnce(new ApiError(status))
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    await flush()
    act(() => { void result.current.reload() })
    await flush()
    expect(result.current.error).toBe(foregroundError)

    act(() => window.dispatchEvent(new Event('focus')))
    await flush()

    expect(result.current.data).toEqual({ value: 'initial' })
    expect(result.current.error).toBe(foregroundError)
  })

  it('keeps a mounted care-record draft after a background 429', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const foregroundError = new ApiError(503)
    const get = vi.fn()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockRejectedValueOnce(foregroundError)
      .mockRejectedValueOnce(new ApiError(429))
    const api = makeApi(get)

    function Editor() {
      const resource = useCareResource<{ value: string }>(api, '/clinical-record', 'single', {
        interval: 0,
      })
      const [draft, setDraft] = useState('')
      if (!resource.data) return <p>Editor unmounted</p>

      return (
        <>
          <p>{resource.data.value}</p>
          <p role="status">{resource.error instanceof ApiError ? resource.error.status : 'ok'}</p>
          <input aria-label="Clinical draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button onClick={resource.reload}>Reload</button>
        </>
      )
    }

    render(<Editor />)
    await flush()
    fireEvent.change(screen.getByLabelText('Clinical draft'), {
      target: { value: 'Keep this clinical draft' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await flush()
    expect(screen.getByRole('status')).toHaveTextContent('503')

    act(() => window.dispatchEvent(new Event('focus')))
    await flush()

    expect(screen.getByLabelText('Clinical draft')).toHaveValue('Keep this clinical draft')
    expect(screen.queryByText('Editor unmounted')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('503')
  })

  it('drops stale responses and preserves the last data on refresh errors', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const stale = deferred<{ value: string }>()
    const newest = deferred<{ value: string }>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(newest.promise)
    const api = makeApi(get)
    const { result } = renderHook(() => useApiResource<{ value: string }>(api, '/resource'))

    act(() => result.current.reload())
    await act(async () => {
      newest.resolve({ value: 'newest' })
      await newest.promise
    })
    await act(async () => {
      stale.resolve({ value: 'stale' })
      await stale.promise
    })
    expect(result.current.data).toEqual({ value: 'newest' })

    get.mockRejectedValueOnce(new ApiError(503))
    act(() => window.dispatchEvent(new Event('focus')))
    await flush()
    expect(result.current.data).toEqual({ value: 'newest' })
    expect(result.current.error).toBeNull()
  })

  it('keeps drafts during background updates and pauses polling during a care mutation', async () => {
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    const updated = deferred<{ value: string }>()
    const write = deferred<unknown>()
    const get = vi
      .fn<(path: string, signal?: AbortSignal) => Promise<unknown>>()
      .mockResolvedValueOnce({ value: 'initial' })
      .mockReturnValueOnce(updated.promise)
      .mockResolvedValueOnce({ value: 'after-write' })
    const mutate = vi.fn(() => write.promise)
    const api = makeApi(get, mutate)

    function Probe() {
      const resource = useCareResource<{ value: string }>(api, '/resource', 'single', {
        interval: 1_000,
      })
      const mutation = useCareMutation(api, resource.reload)
    const [draft, setDraft] = useState('')
      return (
        <>
          <p>{resource.data?.value}</p>
          <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <button onClick={() => void mutation.run('/write')}>Save</button>
        </>
      )
    }

    render(<Probe />)
    await flush()
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved note' } })
    act(() => window.dispatchEvent(new Event('focus')))
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved note')
    await act(async () => {
      updated.resolve({ value: 'background-update' })
      await updated.promise
    })
    expect(screen.getByText('background-update')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved note')

    fireEvent.click(screen.getByText('Save'))
    expect(mutate).toHaveBeenCalledTimes(1)
    const readsDuringMutation = get.mock.calls.length
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(2_000)
    })
    expect(get).toHaveBeenCalledTimes(readsDuringMutation)

    await act(async () => {
      write.resolve({})
      await write.promise
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(screen.getByText('after-write')).toBeInTheDocument()
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved note')
  })
})
