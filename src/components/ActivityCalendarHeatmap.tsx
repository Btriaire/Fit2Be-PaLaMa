import type { ActivityCalendarDay } from '../lib/progression'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

function bucketColor(minutes: number): string {
  if (minutes <= 0) return 'bg-zinc-900'
  if (minutes < 20) return 'bg-orange-900/70'
  if (minutes < 45) return 'bg-orange-700'
  if (minutes < 90) return 'bg-orange-500'
  return 'bg-orange-400'
}

/** Grille "contributions" façon GitHub — une colonne par semaine, une ligne
 * par jour de semaine — pour visualiser la régularité (pas juste le volume)
 * de l'activité sur les ~12 dernières semaines, semaine par semaine et,
 * grâce aux repères de mois, mois par mois. */
export default function ActivityCalendarHeatmap({ days }: { days: ActivityCalendarDay[] }) {
  if (days.length === 0) return null

  // Aligne sur des semaines complètes (lundi -> dimanche) en préfixant des
  // cases vides si le premier jour de la fenêtre n'est pas un lundi.
  const firstDate = new Date(`${days[0].date}T00:00:00`)
  const mondayOffset = (firstDate.getDay() + 6) % 7 // 0 = lundi
  const padded: Array<ActivityCalendarDay | null> = [...Array(mondayOffset).fill(null), ...days]

  const weeks: Array<Array<ActivityCalendarDay | null>> = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))

  // Étiquette de mois affichée sur la première semaine où ce mois apparaît.
  const monthLabelForWeek = new Map<number, string>()
  let lastMonth = -1
  weeks.forEach((week, wi) => {
    const firstReal = week.find((d) => d != null)
    if (!firstReal) return
    const m = new Date(`${firstReal.date}T00:00:00`).getMonth()
    if (m !== lastMonth) {
      monthLabelForWeek.set(wi, MONTH_LABELS_FR[m])
      lastMonth = m
    }
  })

  const activeDays = days.filter((d) => d.minutes > 0).length
  const pct = Math.round((activeDays / days.length) * 100)

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-xs text-zinc-500">Régularité — {days.length} derniers jours</p>
        <p className="text-xs font-semibold text-orange-400">
          {activeDays} jours actifs · {pct}%
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <div className="flex shrink-0 flex-col gap-[3px] pt-[18px]">
          {WEEKDAY_LABELS.map((l, i) => (
            <span key={i} className="flex h-[11px] w-4 items-center text-[9px] text-zinc-600">
              {i % 2 === 1 ? l : ''}
            </span>
          ))}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              <span className="block h-[14px] text-[9px] leading-[14px] text-zinc-600">{monthLabelForWeek.get(wi) ?? ''}</span>
              {week.map((d, di) => (
                <span
                  key={di}
                  title={d ? `${d.date} · ${d.minutes} min` : ''}
                  className={`block h-[11px] w-[11px] rounded-[3px] ${d ? bucketColor(d.minutes) : 'bg-transparent'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1 text-[9px] text-zinc-600">
        Moins
        <span className="h-[10px] w-[10px] rounded-[2px] bg-zinc-900" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-orange-900/70" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-orange-700" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-orange-500" />
        <span className="h-[10px] w-[10px] rounded-[2px] bg-orange-400" />
        Plus
      </div>
    </div>
  )
}
