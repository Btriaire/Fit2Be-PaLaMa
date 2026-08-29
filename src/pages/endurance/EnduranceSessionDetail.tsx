import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Timer, Route, HeartPulse, Flame, Zap, Gauge, Mountain, Trash2, TrendingUp, Activity, Pencil, Check, X } from 'lucide-react'
import {
  getEnduranceSession,
  getEnduranceSessions,
  deleteEnduranceSession,
  updateEnduranceActivityType,
  computePaceMinPerKm,
  formatPace,
  ENDURANCE_ACTIVITY_META,
} from '../../lib/endurance'
import { getSettings } from '../../lib/settings'
import { computeCaloriesFromPhaseLog } from '../../lib/met'
import { HR_ZONE_META, computeMaxHr } from '../../lib/heartRate'
import { enduranceSessionLoad } from '../../lib/recovery'
import { computeHrr1min } from '../../lib/healthScreenScan'
import { sessionEfficiency } from '../../lib/progression'
import { formatDate, formatTime } from '../../lib/date'
import { ENDURANCE_PROGRAMS } from '../../lib/endurancePrograms'
import RouteMap from '../../components/RouteMap'
import ActivityHero from '../../components/ActivityHero'
import type { EnduranceActivityType, EnduranceSession } from '../../types'

const PHASE_INTENSITY_COLOR: Record<'facile' | 'modéré' | 'dur', string> = {
  facile: 'var(--color-turquoise)',
  modéré: 'var(--color-indigo)',
  dur: 'var(--color-orange)',
}

/** Dégradé zone 1 (effort léger) → zone 5 (effort max), dérivé des trois
 * couleurs du thème de l'app plutôt que des couleurs zone Apple/Google. */
const HR_ZONE_GRADIENT = [
  'var(--color-turquoise)',
  'color-mix(in srgb, var(--color-turquoise), var(--color-indigo))',
  'var(--color-indigo)',
  'color-mix(in srgb, var(--color-indigo), var(--color-orange))',
  'var(--color-orange)',
]

/** Une métrique individuelle, taguée avec la ou les catégories d'index
 * qu'elle alimente — c'est ce tag qui répond au "pourquoi c'est là". */
function Metric({
  icon,
  label,
  value,
  tag,
}: {
  icon: React.ReactNode
  label: string
  value: string
  tag?: string
}) {
  return (
    <div className="glass rounded-xl p-3">
      <div className="mb-1 flex items-center gap-1.5 text-zinc-500">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      {tag && <p className="mt-0.5 text-[10px] text-zinc-600">{tag}</p>}
    </div>
  )
}

export default function EnduranceSessionDetail() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<EnduranceSession | null | undefined>(undefined)
  const [editingType, setEditingType] = useState(false)
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false)
  const [programHistory, setProgramHistory] = useState<EnduranceSession[]>([])
  const settings = getSettings()

  useEffect(() => {
    if (!sessionId) return
    getEnduranceSession(sessionId).then((s) => setSession(s ?? null))
  }, [sessionId])

  useEffect(() => {
    if (!session?.programId) {
      setProgramHistory([])
      return
    }
    getEnduranceSessions().then((all) =>
      setProgramHistory(all.filter((s) => s.programId === session.programId && s.id !== session.id).slice(0, 5)),
    )
  }, [session])

  async function remove() {
    if (!session || !confirm('Supprimer cette sortie ?')) return
    await deleteEnduranceSession(session.id)
    navigate('/endurance')
  }

  async function changeActivityType(activityType: EnduranceActivityType) {
    if (!session) return
    const updated = await updateEnduranceActivityType(session.id, activityType, settings)
    if (updated) setSession(updated)
    setEditingType(false)
  }

  if (session === undefined) {
    return <p className="px-4 pt-6 text-sm text-zinc-500">Chargement…</p>
  }
  if (session === null) {
    return <p className="px-4 pt-6 text-sm text-zinc-500">Sortie introuvable.</p>
  }

  const meta = ENDURANCE_ACTIVITY_META[session.activityType]
  const pace = session.distanceKm ? computePaceMinPerKm(session.durationMin, session.distanceKm) : null
  const zoneMeta = session.hrZone ? HR_ZONE_META[session.hrZone] : null
  const maxHr = computeMaxHr(settings.ageYears)
  const avgHrPct = session.avgHeartRate ? Math.round((session.avgHeartRate / maxHr) * 100) : null
  const peakHrPct = session.machineStats?.peakHeartRate ? Math.round((session.machineStats.peakHeartRate / maxHr) * 100) : null
  const load = enduranceSessionLoad(session, settings.ageYears, meta.label)
  const efficiency = sessionEfficiency(session)
  const hrr = session.healthCapture ? computeHrr1min(session.healthCapture.recoveryPoints) : null
  const zoneTotalMin = session.healthCapture?.zoneBreakdown.reduce((s, z) => s + z.minutes, 0) ?? 0

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey={session.activityType} className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <button onClick={() => navigate(-1)} className="rounded-full bg-zinc-950/40 p-1.5 text-white active:bg-zinc-900">
            <ChevronLeft size={22} />
          </button>
          <button onClick={remove} className="rounded-full bg-zinc-950/40 p-1.5 text-white active:bg-red-500/40">
            <Trash2 size={18} />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-4 pb-3">
          <div>
            <h1 className="text-xl font-semibold text-white drop-shadow">{meta.label}</h1>
            <p className="text-xs text-zinc-300 drop-shadow">
              {formatDate(session.startedAt)} · {formatTime(session.startedAt)}
            </p>
          </div>
          <button
            onClick={() => setEditingType((v) => !v)}
            className="rounded-full bg-zinc-950/40 p-2 text-white active:bg-zinc-900"
            aria-label="Changer le type d'activité"
          >
            <Pencil size={16} />
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">
        {session.photoDataUrl && (
          <button onClick={() => setPhotoViewerOpen(true)} className="glass mb-4 block w-full overflow-hidden rounded-2xl">
            <img src={session.photoDataUrl} alt="Capture scannée" className="max-h-64 w-full object-contain" />
          </button>
        )}

        {editingType && (
          <div className="mb-4 grid grid-cols-2 gap-1.5">
            {(Object.keys(ENDURANCE_ACTIVITY_META) as EnduranceActivityType[]).map((key) => (
              <button
                key={key}
                onClick={() => changeActivityType(key)}
                className={`flex items-center justify-between rounded-lg px-2.5 py-2.5 text-left text-xs font-medium ${
                  key === session.activityType ? 'bg-teal-500 text-zinc-950' : 'bg-zinc-900 text-zinc-300'
                }`}
              >
                {ENDURANCE_ACTIVITY_META[key].label}
                {key === session.activityType && <Check size={14} />}
              </button>
            ))}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Metric icon={<Timer size={13} />} label="Durée" value={`${session.durationMin} min`} />
          {session.distanceKm != null && <Metric icon={<Route size={13} />} label="Distance" value={`${session.distanceKm} km`} />}
          {pace && <Metric icon={<Gauge size={13} />} label="Allure" value={formatPace(pace)} />}
          <Metric icon={<Flame size={13} />} label="Calories" value={`${session.caloriesBurned} kcal`} tag="→ Balance kcal, indice cardiaque" />
        </div>

        {(session.avgHeartRate || zoneMeta) && (
          <section className="glass mb-4 rounded-2xl p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <HeartPulse size={13} className="text-red-400" /> Fréquence cardiaque
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {session.avgHeartRate != null && (
                <Metric
                  icon={<HeartPulse size={13} />}
                  label="FC moyenne"
                  value={`${session.avgHeartRate} bpm${avgHrPct ? ` · ${avgHrPct}%` : ''}`}
                  tag="→ Charge du jour, indice cardiaque"
                />
              )}
              {session.machineStats?.peakHeartRate != null && (
                <Metric
                  icon={<Flame size={13} className="text-red-400" />}
                  label="FC pic"
                  value={`${session.machineStats.peakHeartRate} bpm${peakHrPct ? ` · ${peakHrPct}%` : ''}`}
                  tag="→ Pic d'effort du jour"
                />
              )}
            </div>
            {zoneMeta && (
              <p className="mt-3 flex items-center gap-2 text-xs">
                <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${zoneMeta.color}22`, color: zoneMeta.color }}>
                  Zone {session.hrZone} · {zoneMeta.label}
                </span>
              </p>
            )}
          </section>
        )}

        {session.healthCapture && (session.healthCapture.zoneBreakdown.length > 0 || session.healthCapture.recoveryPoints.length > 0) && (
          <section className="glass mb-4 rounded-2xl p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <HeartPulse size={13} className="text-indigo-300" /> Apple Health / Google Fit
            </h2>
            {session.healthCapture.zoneBreakdown.length > 0 && (
              <div className="mb-3 space-y-1.5">
                {session.healthCapture.zoneBreakdown.map((z) => {
                  const pct = zoneTotalMin > 0 ? Math.round((z.minutes / zoneTotalMin) * 100) : 0
                  return (
                    <div key={z.zone} className="flex items-center gap-2 text-[11px]">
                      <span className="w-12 shrink-0 text-zinc-500">Zone {z.zone}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: HR_ZONE_GRADIENT[z.zone - 1] }} />
                      </div>
                      <span className="w-16 shrink-0 text-right font-mono text-zinc-500">{z.minutes.toFixed(1)} min</span>
                    </div>
                  )
                })}
              </div>
            )}
            {session.healthCapture.recoveryPoints.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] text-zinc-600">
                  Récupération après effort{hrr != null ? ` · HRR 1min : -${hrr} bpm` : ''}
                </p>
                <div className="flex items-end gap-3">
                  {session.healthCapture.recoveryPoints.map((p, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <span className="text-[11px] font-mono text-zinc-300">{p.bpm}</span>
                      <span className="text-[9px] text-zinc-600">{p.minutesAfter === 0 ? 'fin' : `+${p.minutesAfter}min`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {session.machineStats && (
          <section className="glass mb-4 rounded-2xl p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <Zap size={13} className="text-orange-400" /> Données machine
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {session.machineStats.avgWatts != null && (
                <Metric icon={<Zap size={13} />} label="Puissance moy." value={`${session.machineStats.avgWatts} W`} tag="→ Efficacité cardiaque (W/bpm)" />
              )}
              {session.machineStats.peakWatts != null && <Metric icon={<Zap size={13} />} label="Puissance pic" value={`${session.machineStats.peakWatts} W`} />}
              {session.machineStats.avgSpeedKph != null && <Metric icon={<Gauge size={13} />} label="Vitesse moy." value={`${session.machineStats.avgSpeedKph} km/h`} />}
              {session.machineStats.peakSpeedKph != null && <Metric icon={<Gauge size={13} />} label="Vitesse pic" value={`${session.machineStats.peakSpeedKph} km/h`} />}
              {session.machineStats.avgMets != null && (
                <Metric icon={<Activity size={13} />} label="METs moy." value={`${session.machineStats.avgMets}`} tag="→ Effort ressenti (RPE-éq.)" />
              )}
              {session.machineStats.elevationGainM != null && (
                <Metric icon={<Mountain size={13} />} label="Dénivelé" value={`+${session.machineStats.elevationGainM} m`} />
              )}
            </div>
          </section>
        )}

        {session.programId && session.phaseLog && session.phaseLog.length > 0 && (
          <section className="glass mb-4 rounded-2xl p-4">
            <h2 className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <Flame size={13} className="text-orange-400" />
              {ENDURANCE_PROGRAMS.find((p) => p.id === session.programId)?.name ?? 'Programme coaching'}
            </h2>
            <p className="mb-3 text-[10px] text-zinc-600">Détail réel phase par phase — calories intégrées sur la durée effective, pas planifiée.</p>
            <ul className="space-y-1.5">
              {session.phaseLog.map((p, i) => {
                const kcal = computeCaloriesFromPhaseLog([p], settings)
                const skipped = p.actualSec < p.plannedSec - 5
                return (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-900/70 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PHASE_INTENSITY_COLOR[p.intensity] }} />
                      {p.label}
                      {skipped && <span className="text-[10px] text-zinc-600">(écourtée)</span>}
                    </span>
                    <span className="flex items-center gap-2 font-mono text-zinc-500">
                      {Math.round(p.actualSec / 60)} min
                      <span className="text-orange-400">{kcal} kcal</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {programHistory.length > 0 && (
          <section className="glass mb-4 rounded-2xl p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <TrendingUp size={13} className="text-indigo-300" /> Progression sur ce programme
            </h2>
            <ul className="space-y-1.5">
              {programHistory.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">{formatDate(s.startedAt)}</span>
                  <span className="flex items-center gap-2 font-mono text-zinc-500">
                    {s.caloriesBurned} kcal
                    {s.rpe != null && <span className="text-zinc-600">· RPE {s.rpe}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="glass mb-4 rounded-2xl p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <TrendingUp size={13} className="text-indigo-300" /> Contribution aux index
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Metric
              icon={<Flame size={13} />}
              label="Effort (RPE-éq.)"
              value={`${load.effortScore} / 10`}
              tag={`→ Charge du jour : ${load.load} pts`}
            />
            <Metric
              icon={<TrendingUp size={13} />}
              label="Efficacité cardiaque"
              value={efficiency != null ? efficiency.toFixed(2) : '—'}
              tag={efficiency != null ? '→ Indice cardiaque (tendance)' : 'FC requise pour ce calcul'}
            />
          </div>
        </section>

        {session.route && session.route.length > 1 && (
          <section className="mb-4">
            <h2 className="mb-2 text-sm font-medium text-zinc-400">Trajet</h2>
            <RouteMap route={session.route} className="h-56 w-full" />
          </section>
        )}

        <button
          onClick={() => navigate(`/endurance/history/${session.activityType}`)}
          className="mb-8 flex w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-800 py-3 text-sm font-medium text-zinc-300 active:bg-zinc-900"
        >
          <TrendingUp size={16} /> Voir la progression sur {meta.label.toLowerCase()}
        </button>
      </div>

      {photoViewerOpen && session.photoDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setPhotoViewerOpen(false)}>
          <img src={session.photoDataUrl} alt="Capture scannée" className="max-h-full max-w-full rounded-xl object-contain" />
          <button
            onClick={() => setPhotoViewerOpen(false)}
            className="absolute right-4 top-[calc(env(safe-area-inset-top)+16px)] rounded-full bg-zinc-950/60 p-2 text-white active:bg-zinc-900"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  )
}
