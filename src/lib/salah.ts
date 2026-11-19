export const PRAYERS = [
  { id: 'fajr', name: 'Fajr', time: 'Before sunrise', mark: 'F' },
  { id: 'dhuhr', name: 'Dhuhr', time: 'Midday', mark: 'D' },
  { id: 'asr', name: 'Asr', time: 'Afternoon', mark: 'A' },
  { id: 'maghrib', name: 'Maghrib', time: 'After sunset', mark: 'M' },
  { id: 'isha', name: 'Isha', time: 'Night', mark: 'I' },
] as const

export type PrayerId = (typeof PRAYERS)[number]['id']

export type Completion = {
  prayer_date: string
  prayer_name: PrayerId
}

export function getCompletedCountForDate(completions: Completion[], date: string): number {
  return completions.filter((item) => item.prayer_date === date).length
}

export function getCompletedSetForDate(completions: Completion[], date: string): Set<PrayerId> {
  return new Set(completions.filter((item) => item.prayer_date === date).map((item) => item.prayer_name))
}

