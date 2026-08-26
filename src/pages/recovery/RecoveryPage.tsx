import { useEffect, useState } from 'react'
import { HeartPulse, Dumbbell, Footprints, Activity, Flame } from 'lucide-react'
import { getDb, newId } from '../../lib/db'
import { todayStr, formatDate } from '../../lib/date'
import { getSettings } from '../../lib/settings'
import { computeDailyRecovery, type DailyRecovery, type SessionLoad } from '../../lib/recovery'
import ActivityHero from '../../components/ActivityHero'
import type { RecoveryCheckin } from '../../types'

const SCALE_LABELS: Record<number, string> = { 1: 'Très faible', 2: 'Faible', 3: 'Moyen', 4: 'Bon', 5: 'Excellent' }

const BAND_COLOR: Record<DailyRecovery['band'], string> = {
  aucune: '#71717a',
  légère: '#2f4bd6',
  modérée: '#facc15',
  importante: '#ff5a30',
  intense: '#e2361c',
}

const SOURCE_ICON: Record<SessionLoad['source'], React.ReactNode> = {
  gym: <Dumbbell size={13} className="text-orange-400" />,
  activity: <Footprints size={13} className="text-teal-400" />,
  endurance: <Activity size={13} className="text-teal-400" />,
}

function computeSubjectiveScore(c: { sleepQuality: number; muscleFatigue: number; stressLevel: number; motivation: number }) {
  // Sommeil + motivation pèsent positif, fatigue musculaire + stress pèsent négatif (inversés)
  const positive = c.sleepQuality + c.motivation
  const negative = (6 - c.muscleFatigue) + (6 - c.stressLevel)
  return Math.round(((positive + negative) / 20) * 100)
}

export default function RecoveryPage() {
  const [checkins, setCheckins] = useState<RecoveryCheckin[]>([])
  const [sleepQuality, setSleepQuality] = useState(3)
  const [muscleFatigue, setMuscleFatigue] = useState(3)
  const [stressLevel, setStressLevel] = useState(3)
  const [motivation, setMotivation] = useState(3)
  const [recovery, setRecovery] = useState<DailyRecovery | null>(null)
  const settings = getSettings()

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('recovery', 'byDate')
    setCheckins(all.reverse())
    setRecovery(await computeDailyRecovery(settings.ageYears))
    const today = all.find((c) => c.date === todayStr())
    if (today) {
      setSleepQuality(today.sleepQuality)
      setMuscleFatigue(today.muscleFatigue)
      setStressLevel(today.stressLevel)
      setMotivation(today.motivation)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const todayCheckin = checkins.find((c) => c.date === todayStr())
  const subjective = computeSubjectiveScore({ sleepQuality, muscleFatigue, stressLevel, motivation })
  const loadPenalty = recovery?.bodyBatteryPenalty ?? 0
  // Toujours recalculé en direct — un check-in validé plus tôt dans la
  // journée ne doit pas figer le score si une séance est loggée après coup.
  const score = Math.max(0, subjective - loadPenalty)

  async function submit() {
    const db = await getDb()
    const checkin: RecoveryCheckin = {
      id: todayCheckin?.id ?? newId(),
      date: todayStr(),
      sleepQuality: sleepQuality as 1 | 2 | 3 | 4 | 5,
      muscleFatigue: muscleFatigue as 1 | 2 | 3 | 4 | 5,
      stressLevel: stressLevel as 1 | 2 | 3 | 4 | 5,
      motivation: motivation as 1 | 2 | 3 | 4 | 5,
      bodyBatteryScore: score,
    }
    await db.put('recovery', checkin)
    refresh()
  }

  const scoreColor = score >= 70 ? 'text-indigo-300' : score >= 40 ? 'text-orange-400' : 'text-red-400'
  const bandColor = recovery ? BAND_COLOR[recovery.band] : BAND_COLOR.aucune

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="yoga" className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <HeartPulse className="text-indigo-400" size={24} />
          <h1 className="text-xl font-semibold tracking-tight text-white drop-shadow">Récupération</h1>
        </div>
      </div>

      <div className="px-4 pt-4">

      <div className="glass mb-4 rounded-2xl p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Body Battery</p>
        <p className={`mt-1 text-5xl font-bold ${scoreColor}`}>{score}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {todayCheckin
            ? todayCheckin.bodyBatteryScore !== score
              ? 'Recalculé avec ton activité du jour — mets à jour ton check-in pour le fixer'
              : 'Check-in du jour enregistré'
            : 'Aperçu — valide ton check-in'}
        </p>
      </div>

      {recovery && (
        <section className="glass mb-6 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Charge du jour</h2>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${bandColor}22`, color: bandColor }}
            >
              {recovery.band}
            </span>
          </div>

          <div className="mb-2 flex items-end gap-2">
            <p className="text-3xl font-bold" style={{ color: bandColor }}>
              {recovery.totalLoad}
            </p>
            <p className="mb-1 text-xs text-zinc-500">points de charge (session-RPE)</p>
          </div>

          {recovery.weeklyAvgLoad > 0 && (
            <p className="mb-2 text-[11px] text-zinc-500">
              Moyenne des 7 derniers jours : <span className="text-zinc-300">{recovery.weeklyAvgLoad}</span>
              {recovery.totalLoad > recovery.weeklyAvgLoad * 1.3 && (
                <span className="ml-1 text-orange-400">— journée nettement au-dessus de d'habitude</span>
              )}
            </p>
          )}

          {recovery.peakHrPct != null && (
            <p className="mb-2 flex items-center gap-1 text-[11px] text-zinc-500">
              <Flame size={12} className="text-red-400" /> Pic à {recovery.peakHrPct}% de la FC max aujourd'hui
            </p>
          )}

          <p className="mb-3 text-xs text-zinc-400">{recovery.hint}</p>

          {recovery.sessions.length > 0 && (
            <ul className="space-y-1.5 border-t border-zinc-800 pt-3">
              {recovery.sessions.map((s, i) => (
                <li key={i} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    {SOURCE_ICON[s.source]}
                    {s.label}
                  </span>
                  <span className="text-zinc-500">
                    {s.durationMin}min · RPE {s.effortScore} · <span className="font-mono text-zinc-400">{s.load} pts</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="glass mb-6 space-y-4 rounded-2xl p-4">
        <SliderRow label="Qualité du sommeil" value={sleepQuality} onChange={setSleepQuality} />
        <SliderRow label="Fatigue musculaire" value={muscleFatigue} onChange={setMuscleFatigue} invert />
        <SliderRow label="Niveau de stress" value={stressLevel} onChange={setStressLevel} invert />
        <SliderRow label="Motivation" value={motivation} onChange={setMotivation} />
        <button
          onClick={submit}
          className="w-full rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-zinc-950 active:bg-indigo-400"
        >
          {todayCheckin ? 'Mettre à jour le check-in' : 'Valider le check-in du jour'}
        </button>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-400">Historique</h2>
        <ul className="space-y-2">
          {checkins.map((c) => (
            <li key={c.id} className="glass flex items-center justify-between rounded-xl p-3">
              <p className="text-sm">{formatDate(new Date(c.date).getTime())}</p>
              <p className="font-mono text-sm font-semibold">{c.bodyBatteryScore}</p>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </div>
  )
}

function SliderRow({
  label,
  value,
  onChange,
  invert,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  invert?: boolean
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="text-zinc-300">{label}</span>
        <span className="text-xs text-zinc-500">{SCALE_LABELS[invert ? 6 - value : value]}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`h-8 flex-1 rounded-lg transition-colors ${
              n <= value ? 'bg-indigo-500' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
