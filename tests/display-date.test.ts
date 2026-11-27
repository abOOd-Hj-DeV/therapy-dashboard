import { describe, expect, it } from 'vitest'
import { formatCalendarDate, formatTimestamp, formatWallDateTime } from '../src/display-date'

describe('display dates', () => {
  it('converts a real offset timestamp across midnight in the named timezone', () => {
    const value = '2026-01-02T00:15:00.123456+02:00'
    expect(formatTimestamp(value, 'America/Los_Angeles')).toBe('1 Jan 2026, 14:15')
    expect(formatTimestamp(value, 'Asia/Damascus')).toBe('2 Jan 2026, 01:15')
    expect(formatTimestamp(value, 'Asia/Damascus', 'ar-SY-u-nu-latn')).toBe('02\u200f/01\u200f/2026، 1:15 ص')
  })

  it('keeps date-only and wall-clock fields on the supplied calendar day', () => {
    expect(formatCalendarDate('2026-01-02')).toBe('2 Jan 2026')
    expect(formatCalendarDate('2024-02-29')).toBe('29 Feb 2024')
    expect(formatWallDateTime('2026-01-02', '00:15:00')).toBe('2 Jan 2026, 00:15')
    expect(formatWallDateTime('2026-01-02', '')).toBe('2 Jan 2026')
  })

  it('returns a blank rather than guessing at invalid or missing data', () => {
    for (const value of [null, undefined, '', 'not a date', '2026-02-30']) {
      expect(formatTimestamp(value, 'Asia/Damascus')).toBe('')
      expect(formatCalendarDate(value)).toBe('')
    }
    expect(formatTimestamp('2026-02-30T00:15:00Z', 'Asia/Damascus')).toBe('')
    expect(formatTimestamp('2026-01-02T00:15:00', 'Asia/Damascus')).toBe('')
    expect(formatTimestamp('2026-01-02T00:15:00Z', 'not/a-zone')).toBe('')
  })
})
