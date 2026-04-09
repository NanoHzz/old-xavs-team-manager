import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

const TIMEZONE = 'Australia/Melbourne'

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    timeZone: TIMEZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Convert a datetime-local input value (naive, e.g. "2026-04-11T10:30")
 * to an ISO string with the Melbourne timezone offset so Supabase stores
 * the intended local time correctly.
 */
export function localDateTimeToISO(naiveDatetime: string): string {
  if (!naiveDatetime) return naiveDatetime
  // If already has timezone info, return as-is
  if (naiveDatetime.includes('Z') || naiveDatetime.includes('+') || /T\d{2}:\d{2}.*-\d{2}/.test(naiveDatetime)) {
    return naiveDatetime
  }
  // Get the Melbourne offset for this specific date by creating a formatter
  // that tells us the UTC offset for Melbourne at that point in time
  const d = new Date(naiveDatetime)
  if (isNaN(d.getTime())) return naiveDatetime

  // Use Intl to find Melbourne's offset on this date (handles DST automatically)
  const melbParts = new Intl.DateTimeFormat('en-AU', {
    timeZone: TIMEZONE,
    timeZoneName: 'shortOffset',
  }).formatToParts(d)
  const tzPart = melbParts.find(p => p.type === 'timeZoneName')?.value || '+10'
  // tzPart is like "GMT+10" or "GMT+11" — extract the offset
  const match = tzPart.match(/GMT([+-]\d+)/)
  const offsetHours = match ? parseInt(match[1]) : 10
  const sign = offsetHours >= 0 ? '+' : '-'
  const absHours = String(Math.abs(offsetHours)).padStart(2, '0')

  // Append Melbourne offset: "2026-04-11T10:30" + "+10:00"
  return `${naiveDatetime}${sign}${absHours}:00`
}

/**
 * Convert a UTC/ISO datetime string from the database back to a
 * datetime-local input value in Melbourne time (no timezone suffix).
 */
export function isoToLocalDateTime(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  // Format in Melbourne timezone
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)

  const get = (type: string) => parts.find(p => p.type === type)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}
