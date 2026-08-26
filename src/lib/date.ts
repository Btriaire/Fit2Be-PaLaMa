export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dayKey(timestampMs: number): string {
  const d = new Date(timestampMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isToday(timestampMs: number): boolean {
  return dayKey(timestampMs) === todayStr()
}

export function isSameDay(timestampMs: number, dateStr: string): boolean {
  return dayKey(timestampMs) === dateStr
}

export function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + delta)
  return dayKey(d.getTime())
}

export function formatFullDate(dateStr: string): string {
  if (dateStr === todayStr()) return "Aujourd'hui"
  if (dateStr === addDays(todayStr(), -1)) return 'Hier'
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
