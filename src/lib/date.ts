export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function daysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number)
  const [endYear, endMonth, endDay] = end.split('-').map(Number)
  const startDayNumber = Date.UTC(startYear, startMonth - 1, startDay)
  const endDayNumber = Date.UTC(endYear, endMonth - 1, endDay)
  return Math.max(0, Math.floor((endDayNumber - startDayNumber) / 86_400_000))
}

export function formatLongDate(key: string): string {
  return dateFromKey(key).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export function isFuture(key: string, today: string): boolean {
  return key > today
}

