import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartPulse, Dumbbell, Footprints, Activity, Flame, Gauge, Moon, Flame as StreakIcon, Sunrise, Pencil, Check, BatteryCharging, Repeat, History, ClipboardCheck } from 'lucide-react'
import { AreaChart, Area, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getDb, newId } from '../../lib/db'
import { todayStr, formatDate } from '../../lib/date'
import { getSettings } from '../../lib/settings'
import { computeBodyComposition } from '../../lib/met'
import {
  computeDailyRecovery,
  computeAcwr,
  computeSleepDebt,
  computeActivityStreak,
  computeReadiness,
  computeTrainingMonotony,
  type DailyRecovery,
  type SessionLoad,
  type Acwr,
  type AcwrRisk,
  type SleepDebt,
  type ActivityStreak,
  type Readiness,
  type TrainingMonotony,
  type MonotonyRisk,
} from '../../lib/recovery'
import ActivityHero from '../../components/ActivityHero'
import BackButton from '../../components/BackButton'
import { pushRecord, deleteRecord } from '../../lib/cloudSync'
import { analyzeRecovery, type RecoveryInsight } from '../../lib/aiInsights'
import { pullCardiacRangeFromNutriTracker, type RemoteCardiacDay } from '../../lib/nutriTrackerSync'
import { syncGoogleFit } from '../../lib/googleFit'
import { getMuscleGroupFreshness, type MuscleGroupFreshness } from '../../lib/workouts'
import { Sparkles, Loader2 } from 'lucide-react'
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

const ACWR_COLOR: Record<AcwrRisk, string> = {
  'sous-charge': '#2f4bd6',
  optimal: '#2dd4bf',
  'à surveiller': '#facc15',
  'risque élevé': '#e2361c',
}

const MONOTONY_COLOR: Record<MonotonyRisk, string> = {
  faible: '#2dd4bf',
  modéré: '#facc15',
  élevé: '#e2361c',
}

// Qualité du sommeil et stress ont été retirés du check-in (curseurs en trop, jamais très
// fiables en auto-évaluation) : le sommeil vient maintenant des heures réelles saisies
// à côté (curseur "Heures de sommeil"), comparées à l'objectif des Réglages.
function computeSubjectiveScore(c: { sleepHours: number; muscleFatigue: number; motivation: number }, sleepTargetMin: number) {
  const sleepScore = Math.max(1, Math.min(5, Math.round(((c.sleepHours * 60) / sleepTargetMin) * 5)))
  const positive = sleepScore + c.motivation
  const negative = 6 - c.muscleFatigue
  return Math.round(((positive + negative) / 15) * 100)
}

export default function RecoveryPage() {
  const navigate = useNavigate()
  const [checkins, setCheckins] = useState<RecoveryCheckin[]>([])
  // Durée en heures, saisie manuellement : Google Fit ne transmet plus le sommeil depuis
  // le 20/09 et rien d'autre ne l'alimente côté serveur — c'est le seul repli qui marche
  // vraiment (voir lib/fitHealth.ts effectiveSleepMinutes).
  const [sleepHours, setSleepHours] = useState(7)
  const [muscleFatigue, setMuscleFatigue] = useState(3)
  const [motivation, setMotivation] = useState(3)
  const [recovery, setRecovery] = useState<DailyRecovery | null>(null)
  const [acwr, setAcwr] = useState<Acwr | null>(null)
  const [sleepDebt, setSleepDebt] = useState<SleepDebt | null>(null)
  const [streak, setStreak] = useState<ActivityStreak | null>(null)
  const [readiness, setReadiness] = useState<Readiness | null>(null)
  const [monotony, setMonotony] = useState<TrainingMonotony | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [editing, setEditing] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<RecoveryInsight | null>(null)
  const [aiError, setAiError] = useState(false)
  const [cardiac, setCardiac] = useState<RemoteCardiacDay[]>([])
  const [muscleFreshness, setMuscleFreshness] = useState<MuscleGroupFreshness[]>([])
  const settings = getSettings()

  async function refresh() {
    // Cette page est parfois la première ouverte dans une session — ne pas
    // dépendre du sync en arrière-plan lancé au boot de l'app (App.tsx), qui
    // peut ne pas encore avoir fini, sinon le sommeil/les pas affichés
    // restent ceux du dernier cache local, potentiellement périmés.
    await syncGoogleFit()
    const db = await getDb()
    const all = await db.getAllFromIndex('recovery', 'byDate')
    setCheckins(all.reverse())
    setRecovery(await computeDailyRecovery(settings.ageYears))
    setAcwr(await computeAcwr(settings.ageYears))
    setSleepDebt(await computeSleepDebt(settings.sleepTargetMin))
    setStreak(await computeActivityStreak(settings.ageYears))
    setMonotony(await computeTrainingMonotony(settings.ageYears))
    pullCardiacRangeFromNutriTracker(14).then(setCardiac)
    setMuscleFreshness(await getMuscleGroupFreshness())
    const today = all.find((c) => c.date === todayStr())
    if (today) {
      setSleepHours(today.sleepHours ?? 7)
      setMuscleFatigue(today.muscleFatigue)
      setMotivation(today.motivation)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const todayCheckin = checkins.find((c) => c.date === todayStr())
  const subjective = computeSubjectiveScore({ sleepHours, muscleFatigue, motivation }, settings.sleepTargetMin)
  const loadPenalty = recovery?.bodyBatteryPenalty ?? 0
  // Toujours recalculé en direct — un check-in validé plus tôt dans la
  // journée ne doit pas figer le score si une séance est loggée après coup.
  const score = Math.max(0, subjective - loadPenalty)

  useEffect(() => {
    computeReadiness(settings.ageYears, subjective, settings.sleepTargetMin).then(setReadiness)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjective, recovery])

  async function submit() {
    const db = await getDb()
    // La date n'est pas une clé unique en base (seul l'id l'est) — un check-in
    // du jour peut exister sous un id différent de celui déjà en mémoire
    // (ex: rechargement entre-temps). On les fusionne au lieu d'en créer un
    // second, pour garantir qu'un jour = un seul check-in.
    const existingForToday = await db.getAllFromIndex('recovery', 'byDate', todayStr())
    const keepId = todayCheckin?.id ?? existingForToday[0]?.id ?? newId()
    for (const extra of existingForToday) {
      if (extra.id !== keepId) {
        await db.delete('recovery', extra.id)
        deleteRecord('recovery', extra.id)
      }
    }
    const checkin: RecoveryCheckin = {
      id: keepId,
      date: todayStr(),
      sleepHours,
      muscleFatigue: muscleFatigue as 1 | 2 | 3 | 4 | 5,
      motivation: motivation as 1 | 2 | 3 | 4 | 5,
      bodyBatteryScore: score,
    }
    await db.put('recovery', checkin)
    pushRecord('recovery', checkin.id, checkin)
    refresh()
    setSavedFlash(true)
    setTimeout(() => {
      setSavedFlash(false)
      setEditing(false)
    }, 1500)
  }

  const showForm = !todayCheckin || editing
  const chartData = useMemo(
    () =>
      [...checkins]
        .reverse()
        .slice(-30)
        .map((c) => ({ label: formatDate(new Date(c.date).getTime()), score: c.bodyBatteryScore })),
    [checkins],
  )

  const scoreColor = score >= 70 ? 'text-indigo-300' : score >= 40 ? 'text-orange-400' : 'text-red-400'
  const bandColor = recovery ? BAND_COLOR[recovery.band] : BAND_COLOR.aucune

  return (
    <div>
      <div className="relative">
        <ActivityHero heroKey="yoga" className="h-40" />
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
          <BackButton />
          <HeartPulse className="text-indigo-400" size={24} />
          <h1 className="flex-1 text-xl font-semibold tracking-tight text-white drop-shadow">Récupération</h1>
          <button
            onClick={() => navigate('/reference')}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-950/40 text-xs font-bold text-zinc-200 active:bg-zinc-900"
            aria-label="Détail des calculs et index"
          >
            ?
          </button>
        </div>
      </div>

      <div className="px-4 pt-4">

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-5 text-center">
          <p className={`flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-zinc-500`}>
            <BatteryCharging size={12} className={scoreColor} /> Body Battery
          </p>
          <p className={`mt-1 text-4xl font-bold ${scoreColor}`}>{score}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {todayCheckin
              ? todayCheckin.bodyBatteryScore !== score
                ? 'Recalculé avec ton activité'
                : 'Check-in enregistré'
              : 'Aperçu — valide ton check-in'}
          </p>
        </div>
        <div className="glass rounded-2xl p-5 text-center">
          <p className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-zinc-500">
            <Sunrise size={12} /> Readiness
          </p>
          <p className="mt-1 text-4xl font-bold text-teal-400">{readiness ? readiness.score : '—'}</p>
          <p className="mt-1 text-[10px] text-zinc-500">
            {readiness?.sleepComponent != null ? 'Charge + sommeil + ressenti' : 'Charge + ressenti (pas de sommeil connu)'}
          </p>
        </div>
      </div>

      <div className="glass mb-4 rounded-2xl p-3.5">
        <p className="mb-2 flex items-center gap-1 text-xs text-zinc-500">
          <HeartPulse size={12} /> Cardio & tension (NutriTracker)
        </p>
        {cardiac.length > 0 ? (
          (() => {
            const latest = cardiac[0]
            return (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xl font-bold text-red-400">
                    {latest.heartRateResting ?? latest.heartRateAvg ?? '—'}
                    <span className="ml-1 text-[10px] font-normal text-zinc-600">bpm</span>
                  </p>
                  <p className="text-[10px] text-zinc-600">{latest.heartRateResting != null ? 'FC repos' : 'FC moyenne'} · {latest.date}</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-indigo-300">
                    {latest.systolicBP != null && latest.diastolicBP != null ? `${latest.systolicBP}/${latest.diastolicBP}` : '—'}
                    <span className="ml-1 text-[10px] font-normal text-zinc-600">mmHg</span>
                  </p>
                  <p className="text-[10px] text-zinc-600">Tension artérielle</p>
                </div>
              </div>
            )
          })()
        ) : (
          <p className="text-xl font-bold text-zinc-600">—</p>
        )}
      </div>

      <div className="glass mb-4 rounded-2xl p-3.5">
        <div className="mb-1 flex items-center justify-between">
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <Gauge size={12} style={{ color: acwr ? ACWR_COLOR[acwr.risk] : undefined }} /> Charge aiguë/chronique (ACWR)
          </p>
          {acwr && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${ACWR_COLOR[acwr.risk]}22`, color: ACWR_COLOR[acwr.risk] }}
            >
              {acwr.ratio != null ? acwr.risk : 'pas de données'}
            </span>
          )}
        </div>
        <p className="text-xl font-bold" style={{ color: acwr ? ACWR_COLOR[acwr.risk] : undefined }}>
          {acwr?.ratio ?? '—'}
        </p>
        <p className="mt-0.5 text-[10px] text-zinc-600">
          {acwr ? `Charge 7j : ${acwr.acute} pts/j · Charge 28j : ${acwr.chronic} pts/j` : 'Zone saine ≈ 0.8-1.3'}
        </p>
      </div>

      {acwr && acwr.ratio != null && (acwr.risk === 'à surveiller' || acwr.risk === 'risque élevé') && (
        <div
          className="mb-4 rounded-2xl border p-3 text-xs"
          style={{ borderColor: `${ACWR_COLOR[acwr.risk]}55`, backgroundColor: `${ACWR_COLOR[acwr.risk]}11`, color: ACWR_COLOR[acwr.risk] }}
        >
          <span className="flex items-center gap-1.5 font-semibold">
            <Gauge size={13} /> Charge {acwr.risk} (ACWR {acwr.ratio})
          </span>
          <p className="mt-1 text-zinc-400">
            Ta charge des 7 derniers jours ({acwr.acute} pts/j) est nettement au-dessus de ta charge habituelle sur 28 jours ({acwr.chronic}{' '}
            pts/j). {acwr.risk === 'risque élevé' ? 'Un jour de repos ou une séance légère est recommandé.' : 'Surveille la fatigue ces prochains jours.'}
          </p>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="glass rounded-2xl p-3.5">
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <Moon size={12} className={sleepDebt && sleepDebt.totalDebtMin > 120 ? 'text-red-400' : 'text-indigo-300'} /> Dette de sommeil (7j)
          </p>
          <p className={`mt-1 text-xl font-bold ${sleepDebt && sleepDebt.totalDebtMin > 120 ? 'text-red-400' : 'text-indigo-300'}`}>
            {sleepDebt && sleepDebt.daysWithData > 0 ? (sleepDebt.totalDebtMin > 0 ? `-${Math.round(sleepDebt.totalDebtMin / 60)}h` : '0h') : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">
            {sleepDebt && sleepDebt.daysWithData > 0 ? `Moy. ${sleepDebt.avgSleepMin ? Math.round(sleepDebt.avgSleepMin / 60) : '—'}h/nuit` : 'Pas de données Google Fit'}
          </p>
        </div>
        <div className="glass rounded-2xl p-3.5">
          <p className="flex items-center gap-1 text-xs text-zinc-500">
            <StreakIcon size={12} className="text-orange-400" /> {streak && streak.activeDaysStreak > 0 ? 'Jours actifs' : 'Jours de repos'}
          </p>
          <p className="mt-1 text-xl font-bold text-orange-400">
            {streak ? (streak.activeDaysStreak > 0 ? streak.activeDaysStreak : streak.restDaysStreak) : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-zinc-600">d'affilée</p>
        </div>
      </div>

      {monotony && (
        <div className="glass mb-4 rounded-2xl p-3.5">
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Repeat size={12} style={{ color: MONOTONY_COLOR[monotony.risk] }} /> Monotonie & Contrainte (7j)
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${MONOTONY_COLOR[monotony.risk]}22`, color: MONOTONY_COLOR[monotony.risk] }}
            >
              {monotony.weeklyLoad > 0 ? monotony.risk : 'pas de données'}
            </span>
          </div>
          <div className="flex items-baseline gap-4">
            <p>
              <span className="text-xl font-bold" style={{ color: MONOTONY_COLOR[monotony.risk] }}>
                {monotony.weeklyLoad > 0 ? monotony.monotony : '—'}
              </span>
              <span className="ml-1 text-[10px] text-zinc-600">monotonie</span>
            </p>
            <p>
              <span className="text-xl font-bold" style={{ color: MONOTONY_COLOR[monotony.risk] }}>
                {monotony.weeklyLoad > 0 ? monotony.strain : '—'}
              </span>
              <span className="ml-1 text-[10px] text-zinc-600">contrainte</span>
            </p>
          </div>
          <p className="mt-1 text-[10px] text-zinc-600">
            Méthode Foster (2001) — charge répétée sans variation jour après jour, facteur de risque indépendant de l'ACWR.
          </p>
        </div>
      )}

      <button
        onClick={async () => {
          setAiLoading(true)
          setAiError(false)
          setAiResult(null)
          const result = await analyzeRecovery({
            recentCheckins: checkins.slice(0, 14),
            dailyRecovery: recovery,
            acwr,
            sleepDebt,
            streak,
            readiness,
            monotony,
            cardiac: cardiac.slice(0, 7),
            muscleFreshness,
            bodyComposition: computeBodyComposition(settings),
          })
          setAiLoading(false)
          if (!result) setAiError(true)
          else setAiResult(result)
        }}
        disabled={aiLoading}
        className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-indigo-500/15 py-3 text-sm font-semibold text-indigo-300 active:bg-indigo-500/25 disabled:opacity-60"
      >
        {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        Analyse IA de la récupération
      </button>
      {aiError && <p className="-mt-2 mb-4 text-center text-xs text-red-400">Analyse indisponible pour le moment.</p>}
      {aiResult && (
        <div className="mb-4 space-y-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm leading-snug text-zinc-200">{aiResult.summary}</p>
          </div>
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              backgroundColor: aiResult.riskLevel === 'élevé' ? '#e2361c22' : aiResult.riskLevel === 'modéré' ? '#facc1522' : '#2dd4bf22',
              color: aiResult.riskLevel === 'élevé' ? '#e2361c' : aiResult.riskLevel === 'modéré' ? '#facc15' : '#2dd4bf',
            }}
          >
            Risque {aiResult.riskLevel}
          </span>
          {aiResult.signals.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-400">Signaux</p>
              <ul className="space-y-0.5 text-xs text-zinc-400">
                {aiResult.signals.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
          {aiResult.suggestions.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-indigo-300">Suggestions</p>
              <ul className="space-y-0.5 text-xs text-zinc-400">
                {aiResult.suggestions.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {recovery && (
        <section className="glass mb-6 rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <Flame size={13} style={{ color: bandColor }} /> Charge du jour
            </h2>
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

          <p className="mb-2 text-xs text-zinc-400">{recovery.hint}</p>
          {recovery.recommendedRestHours > 0 && (
            <p className="mb-3 flex items-center gap-1 text-[11px] text-zinc-500">
              <Sunrise size={12} className="text-orange-400" /> Repos recommandé avant un effort similaire :{' '}
              <span className="font-mono text-zinc-300">{recovery.recommendedRestHours}h</span>
            </p>
          )}

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

      {muscleFreshness.length > 0 && (
        <section className="glass mb-6 rounded-2xl p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <Dumbbell size={13} className="text-teal-400" /> Fraîcheur par groupe musculaire
          </p>
          <div className="flex flex-wrap gap-1.5">
            {muscleFreshness.map((f) => (
              <span
                key={f.muscleGroup}
                className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                  f.daysSinceLast == null
                    ? 'bg-zinc-900 text-zinc-600'
                    : f.daysSinceLast <= 1
                      ? 'bg-red-500/15 text-red-400'
                      : f.daysSinceLast <= 3
                        ? 'bg-orange-500/15 text-orange-400'
                        : 'bg-teal-500/15 text-teal-400'
                }`}
              >
                {f.muscleGroup} · {f.daysSinceLast == null ? 'jamais' : `${f.daysSinceLast}j`}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">Rouge = sollicité très récemment, vert = frais et prêt à retravailler.</p>
        </section>
      )}

      <section className="glass mb-6 rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
            <ClipboardCheck size={13} className="text-indigo-300" />
            {showForm && todayCheckin ? 'Modifier le check-in du jour' : 'Check-in du jour'}
          </h2>
          {!showForm && (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-medium text-indigo-300 active:bg-zinc-800"
            >
              <Pencil size={11} /> Modifier
            </button>
          )}
        </div>

        {!showForm && todayCheckin ? (
          <div>
            <p className="mb-3 flex items-center gap-1.5 text-xs text-teal-400">
              <Check size={13} /> Déjà validé aujourd'hui — modifie-le plutôt que d'en refaire un nouveau.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SummaryStat label="Heures de sommeil" value={todayCheckin.sleepHours != null ? formatHoursLabel(todayCheckin.sleepHours) : '—'} />
              <SummaryStat label="Fatigue musculaire" value={SCALE_LABELS[6 - todayCheckin.muscleFatigue]} />
              <SummaryStat label="Motivation" value={SCALE_LABELS[todayCheckin.motivation]} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="text-zinc-300">Heures de sommeil</span>
                <span className="text-xs text-zinc-500">{formatHoursLabel(sleepHours)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={12}
                step={0.25}
                value={sleepHours}
                onChange={(e) => setSleepHours(Number(e.target.value))}
                aria-label="Heures de sommeil"
                aria-valuetext={formatHoursLabel(sleepHours)}
                className="h-11 w-full cursor-pointer accent-indigo-500"
              />
              <p className="mt-1 text-[10px] text-zinc-600">Google Fit ne remonte plus le sommeil depuis le 20/09 : cette valeur remplace la sienne partout.</p>
            </div>
            <div className="flex items-end justify-center gap-8 py-2">
              <DjFader label="Fatigue musculaire" value={muscleFatigue} onChange={setMuscleFatigue} invert color="#e2361c" />
              <DjFader label="Motivation" value={motivation} onChange={setMotivation} color="#2f4bd6" />
            </div>
            <div className="flex gap-2">
              {todayCheckin && (
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-400 active:bg-zinc-800"
                >
                  Annuler
                </button>
              )}
              <button
                onClick={submit}
                className="flex-1 rounded-xl bg-indigo-500 py-3 text-sm font-semibold text-zinc-950 active:bg-indigo-400"
              >
                {savedFlash ? 'Enregistré ✓' : todayCheckin ? 'Mettre à jour le check-in' : 'Valider le check-in du jour'}
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-zinc-400">
          <History size={15} className="text-zinc-500" /> Historique
        </h2>
        {chartData.length >= 2 && (
          <div className="glass mb-3 rounded-2xl p-3">
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="bbFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#a1a1aa' }}
                    formatter={(v) => [v, 'Body Battery']}
                  />
                  <Area type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} fill="url(#bbFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {checkins.length === 0 && <p className="px-1 text-sm text-zinc-500">Pas encore de check-in enregistré.</p>}
        <ul className="space-y-2">
          {checkins.map((c) => {
            const isToday = c.date === todayStr()
            return (
              <li
                key={c.id}
                className={`glass flex items-center justify-between rounded-xl p-3 ${isToday ? 'ring-1 ring-indigo-500/40' : ''}`}
              >
                <p className={`text-sm ${isToday ? 'font-medium text-indigo-300' : ''}`}>
                  {isToday ? "Aujourd'hui" : formatDate(new Date(c.date).getTime())}
                </p>
                <p className="font-mono text-sm font-semibold">{c.bodyBatteryScore}</p>
              </li>
            )
          })}
        </ul>
      </section>
      </div>
    </div>
  )
}

function formatHoursLabel(h: number): string {
  const totalMin = Math.round(h * 60)
  return `${Math.floor(totalMin / 60)}h${String(totalMin % 60).padStart(2, '0')}`
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 px-3 py-2">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="font-medium text-zinc-200">{value}</p>
    </div>
  )
}

// Curseur vertical façon fader de console DJ : un <input type="range"> horizontal pivoté
// à -90°, repères de graduation façon table de mixage, jauge colorée qui monte avec la valeur.
function DjFader({
  label,
  value,
  onChange,
  invert,
  color,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  invert?: boolean
  color: string
}) {
  const fillPct = ((value - 1) / 4) * 100
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold" style={{ color }}>
        {SCALE_LABELS[invert ? 6 - value : value]}
      </span>
      <div className="relative flex h-36 w-16 items-center justify-center rounded-2xl bg-zinc-900 py-3">
        {/* Graduations façon table de mixage */}
        <div className="pointer-events-none absolute inset-y-3 left-1/2 flex w-8 -translate-x-1/2 flex-col justify-between">
          {[5, 4, 3, 2, 1].map((n) => (
            <div key={n} className="h-px w-full bg-zinc-800" />
          ))}
        </div>
        {/* Rail rempli depuis le bas, sous le curseur pivoté */}
        <div
          className="pointer-events-none absolute bottom-3 left-1/2 w-1.5 -translate-x-1/2 rounded-full transition-[height]"
          style={{ height: `calc(${fillPct}% * 0.86)`, backgroundColor: color }}
        />
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          aria-valuetext={SCALE_LABELS[invert ? 6 - value : value]}
          className="h-16 w-32 -rotate-90 cursor-pointer touch-none appearance-none bg-transparent
            [&::-moz-range-thumb]:h-9 [&::-moz-range-thumb]:w-14 [&::-moz-range-thumb]:rounded-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-zinc-950 [&::-moz-range-thumb]:bg-zinc-200 [&::-moz-range-thumb]:shadow-lg
            [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent
            [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-transparent
            [&::-webkit-slider-thumb]:mt-[-13.5px] [&::-webkit-slider-thumb]:h-9 [&::-webkit-slider-thumb]:w-14 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-zinc-950 [&::-webkit-slider-thumb]:bg-zinc-200 [&::-webkit-slider-thumb]:shadow-lg"
        />
      </div>
      <span className="text-sm font-medium text-zinc-200">{label}</span>
    </div>
  )
}
