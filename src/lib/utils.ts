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

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Convert a datetime-local input value (naive, e.g. "2026-04-11T10:30")
 * to a proper ISO string with timezone offset so Supabase stores it correctly.
 * Without this, Supabase treats naive strings as UTC.
 */
export function localDateTimeToISO(naiveDatetime: string): string {
  const d = new Date(naiveDatetime)
  if (isNaN(d.getTime())) return naiveDatetime
  return d.toISOString()
}

/**
 * Convert a UTC/ISO datetime string from the database back to a
 * datetime-local input value (local time, no timezone suffix).
 */
export function isoToLocalDateTime(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const mins = String(d.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${mins}`
}
