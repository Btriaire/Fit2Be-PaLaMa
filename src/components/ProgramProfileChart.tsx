import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProgramPhase } from '../lib/endurancePrograms'

/** Profil vitesse/pente d'un programme tapis, façon graphique d'un tapis de
 * course pré-réglé (vitesse en bleu, pente en jaune, sur la durée du
 * programme) — ne trace que ce qui a été saisi en champs structurés
 * (speedKmh/inclineLevel), pas le texte libre `target`. */
export default function ProgramProfileChart({ phases }: { phases: ProgramPhase[] }) {
  const hasIncline = phases.some((p) => p.inclineLevel != null || p.inclinePercent != null)
  const hasData = phases.some((p) => p.speedKmh != null) || hasIncline
  if (!hasData) return null
  const inclineUnit = phases.some((p) => p.inclineLevel != null) ? 'niveau' : '%'

  let t = 0
  const data: Array<{ tMin: number; vitesse: number | null; pente: number | null }> = []
  for (const p of phases) {
    const pente = p.inclineLevel ?? p.inclinePercent ?? null
    data.push({ tMin: Math.round((t / 60) * 10) / 10, vitesse: p.speedKmh ?? null, pente })
    t += p.durationSec
    data.push({ tMin: Math.round((t / 60) * 10) / 10, vitesse: p.speedKmh ?? null, pente })
  }

  return (
    <div className="mb-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-2">
      <div className="mb-1 flex items-center gap-3 px-1 text-[10px]">
        <span className="flex items-center gap-1 text-teal-400">
          <span className="h-1.5 w-3 rounded-full bg-teal-400" /> Vitesse (km/h)
        </span>
        <span className="flex items-center gap-1 text-orange-400">
          <span className="h-1.5 w-3 rounded-full bg-orange-400" /> Pente ({inclineUnit})
        </span>
      </div>
      <div className="h-28 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="tMin" tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} unit="min" />
            <YAxis tick={{ fill: '#71717a', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 11 }} labelStyle={{ color: '#a1a1aa' }} labelFormatter={(l) => `${l} min`} />
            <Area type="stepAfter" dataKey="vitesse" stroke="#2dd4bf" fill="#2dd4bf" fillOpacity={0.15} strokeWidth={2} connectNulls />
            <Area type="stepAfter" dataKey="pente" stroke="#e2361c" fill="#e2361c" fillOpacity={0.15} strokeWidth={2} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
