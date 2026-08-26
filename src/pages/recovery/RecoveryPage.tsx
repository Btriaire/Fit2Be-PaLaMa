import { useEffect, useState } from 'react'
import { HeartPulse } from 'lucide-react'
import { getDb, newId } from '../../lib/db'
import { todayStr, formatDate } from '../../lib/date'
import type { RecoveryCheckin } from '../../types'

const SCALE_LABELS: Record<number, string> = { 1: 'Très faible', 2: 'Faible', 3: 'Moyen', 4: 'Bon', 5: 'Excellent' }

function computeBodyBattery(c: { sleepQuality: number; muscleFatigue: number; stressLevel: number; motivation: number }) {
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

  async function refresh() {
    const db = await getDb()
    const all = await db.getAllFromIndex('recovery', 'byDate')
    setCheckins(all.reverse())
  }

  useEffect(() => {
    refresh()
  }, [])

  const todayCheckin = checkins.find((c) => c.date === todayStr())
  const score = computeBodyBattery({ sleepQuality, muscleFatigue, stressLevel, motivation })

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

  const scoreColor = score >= 70 ? 'text-purple-300' : score >= 40 ? 'text-orange-400' : 'text-red-400'

  return (
    <div className="px-4 pt-6">
      <header className="mb-6 flex items-center gap-2">
        <HeartPulse className="text-purple-400" size={26} />
        <h1 className="text-xl font-semibold tracking-tight">Récupération</h1>
      </header>

      <div className="glass mb-6 rounded-2xl p-5 text-center">
        <p className="text-xs uppercase tracking-wide text-zinc-500">Body Battery</p>
        <p className={`mt-1 text-5xl font-bold ${scoreColor}`}>{todayCheckin?.bodyBatteryScore ?? score}</p>
        <p className="mt-1 text-xs text-zinc-500">{todayCheckin ? "Check-in du jour enregistré" : 'Aperçu — valide ton check-in'}</p>
      </div>

      <section className="glass mb-6 space-y-4 rounded-2xl p-4">
        <SliderRow label="Qualité du sommeil" value={sleepQuality} onChange={setSleepQuality} />
        <SliderRow label="Fatigue musculaire" value={muscleFatigue} onChange={setMuscleFatigue} invert />
        <SliderRow label="Niveau de stress" value={stressLevel} onChange={setStressLevel} invert />
        <SliderRow label="Motivation" value={motivation} onChange={setMotivation} />
        <button
          onClick={submit}
          className="w-full rounded-xl bg-purple-500 py-3 text-sm font-semibold text-zinc-950 active:bg-purple-400"
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
              n <= value ? 'bg-purple-500' : 'bg-zinc-800'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
