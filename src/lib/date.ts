export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isToday(timestampMs: number): boolean {
  const d = new Date(timestampMs)
  return (
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` ===
    todayStr()
  )
}

export function formatTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(timestampMs: number): string {
  return new Date(timestampMs).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
