type DisplayLocale = 'en-GB' | 'ar-SY-u-nu-latn'

function calendarInstant(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN
  const instant = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value
    ? instant
    : NaN
}

export function formatCalendarDate(value: string | null | undefined, locale: DisplayLocale = 'en-GB') {
  const instant = calendarInstant(value)
  return Number.isFinite(instant)
    ? new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium' }).format(instant)
    : ''
}

export function formatTimestamp(
  value: string | number | null | undefined,
  timeZone: string | undefined,
  locale: DisplayLocale = 'en-GB',
) {
  const instant = typeof value === 'number' ? value
    : value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) &&
      Number.isFinite(calendarInstant(value.slice(0, 10))) ? Date.parse(value) : NaN
  if (!Number.isFinite(instant)) return ''
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, dateStyle: 'medium', timeStyle: 'short' }).format(instant)
  } catch {
    return ''
  }
}

export function formatWallDateTime(date: string | null, time: string) {
  const calendarDate = formatCalendarDate(date)
  if (!calendarDate) return ''
  const clock = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time) ? time.slice(0, 5) : ''
  return clock ? `${calendarDate}, ${clock}` : calendarDate
}
