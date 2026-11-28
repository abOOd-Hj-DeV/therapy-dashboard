import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { RedFlags } from '../src/RedFlags'
import type { ApiClient } from '../src/api'

const fixturePath = process.env.SAKINA_FLAG_BRIDGE_LOG

test.skipIf(!fixturePath)('Therapist renders actor-scoped safety flag JSON emitted by disposable Laravel', async () => {
  const line = readFileSync(fixturePath!, 'utf8')
    .split('\n').find(value => value.startsWith('FLAG_BRIDGE:therapist:'))!
  const response = JSON.parse(line.slice('FLAG_BRIDGE:therapist:'.length))
  const user = { id: 'synthetic-therapist' }
  const api = {
    getUser: () => user,
    getSessionKey: () => 1,
    subscribe: () => () => undefined,
    get: vi.fn().mockResolvedValue(response),
  } as unknown as ApiClient

  render(<RedFlags api={api} navigate={vi.fn()} />)
  expect(await screen.findByText('طلب دعم عاجل من التطبيق')).toBeInTheDocument()
  expect(screen.getByText('إشارة سلامة من تقييم')).toBeInTheDocument()
  expect(screen.getByText('بلاغ سلامة يحتاج إلى مراجعة')).toBeInTheDocument()
  expect(screen.getAllByRole('radio', { name: 'إعادة تفعيل الحساب' }).filter(control => !(control as HTMLInputElement).disabled)).toHaveLength(2)
})
