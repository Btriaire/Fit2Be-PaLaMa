// Vercel serverless function — rapport hebdomadaire de progression, servi en
// HTML brut pour être ajouté comme source URL par le CLI notebooklm (voir
// weekly-audio.sh sur le VPS, /opt/notebooklm-fit2be). Fit2Be-PaLaMa stocke
// tout en IndexedDB côté client — aucune donnée n'existe côté serveur en
// dehors de ce qui a été synchronisé vers /opt/fit2be-sync (voir
// api/cloudsync.ts) via cloudSync.ts, donc les index qui nécessitent le
// profil (âge, sexe, taille, FC repos) dépendent de settings.ts qui pousse
// désormais un enregistrement "profile" dédié à chaque sauvegarde.
//
// Accès protégé par une clé de requête (?key=) et non par un header Bearer :
// le CLI notebooklm ajoute une source par simple URL, sans en-têtes
// personnalisables — c'est Google qui va chercher le contenu de cette URL.

import { ENDURANCE_PROGRAMS, programDurationMin } from '../src/lib/endurancePrograms'
import { COACHING_TEMPLATES } from '../src/lib/trainingTemplates'

const PROGRAM_CATALOG_HTML = `<ul>
${ENDURANCE_PROGRAMS.map((p) => `<li>[Endurance] ${p.name} — ${p.focus}, niveau ${p.difficulty}, ~${programDurationMin(p)} min</li>`).join('\n')}
${COACHING_TEMPLATES.map((t) => `<li>[Gym] ${t.name} — ${t.focus}${t.difficulty ? `, niveau ${t.difficulty}` : ''}${t.estimatedMin ? `, ~${t.estimatedMin} min` : ''}</li>`).join('\n')}
</ul>`

interface VercelRequest {
  method?: string
  query: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status(code: number): VercelResponse
  setHeader(name: string, value: string): void
  send(body: string): void
  json(body: unknown): void
}

interface CloudRecord {
  id: string
  data: Record<string, unknown>
  updatedAt: number
}

type Period = '7d' | '30d' | '90d' | 'all'
const PERIOD_DAYS: Record<Exclude<Period, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 }
const PERIOD_LABEL: Record<Period, string> = { '7d': 'la semaine écoulée', '30d': 'le mois écoulé', '90d': 'le trimestre écoulé', all: 'depuis le tout début du suivi' }

async function fetchStore(baseUrl: string, secret: string, store: string): Promise<CloudRecord[]> {
  try {
    const r = await fetch(`${baseUrl}/api/sync?store=${store}`, { headers: { 'x-sync-secret': secret } })
    if (!r.ok) return []
    const data = (await r.json()) as { records?: CloudRecord[] }
    return data.records ?? []
  } catch {
    return []
  }
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = typeof req.query.key === 'string' ? req.query.key : ''
  const expectedKey = process.env.PROGRESS_REPORT_KEY
  if (!expectedKey || key !== expectedKey) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  const baseUrl = process.env.CLOUDSYNC_BASE_URL
  const secret = process.env.CLOUDSYNC_SECRET
  if (!baseUrl || !secret) {
    res.status(503).json({ error: 'Sync non configurée' })
    return
  }

  const periodParam = typeof req.query.period === 'string' ? req.query.period : '7d'
  const period: Period = (['7d', '30d', '90d', 'all'] as const).includes(periodParam as Period) ? (periodParam as Period) : '7d'

  const [profileRecs, weightRecs, enduranceRecs, workoutRecs] = await Promise.all([
    fetchStore(baseUrl, secret, 'profile'),
    fetchStore(baseUrl, secret, 'weightLogs'),
    fetchStore(baseUrl, secret, 'endurance'),
    fetchStore(baseUrl, secret, 'workouts'),
  ])

  const profile = (profileRecs[0]?.data ?? {}) as {
    firstName?: string
    ageYears?: number
    sex?: 'homme' | 'femme'
    heightCm?: number
    bodyWeightKg?: number
    restingHeartRateBpm?: number
  }
  const ageYears = profile.ageYears ?? 30
  const sex = profile.sex ?? 'homme'
  const heightCm = profile.heightCm ?? 175
  const restingHr = profile.restingHeartRateBpm ?? 60

  const weights = weightRecs.map((r) => r.data as { loggedAt: number; weightKg: number }).sort((a, b) => a.loggedAt - b.loggedAt)
  const enduranceAll = enduranceRecs
    .map((r) => r.data as { startedAt: number; activityType: string; durationMin: number; distanceKm?: number; caloriesBurned: number; avgHeartRate?: number; hrZone?: number; rpe?: number; healthCapture?: { zoneBreakdown?: Array<{ zone: number; minutes: number }> } })
    .sort((a, b) => a.startedAt - b.startedAt)
  const workoutsAll = workoutRecs
    .map((r) => r.data as { startedAt: number; finishedAt?: number; name: string; exercises: Array<{ sets: Array<{ isWarmup: boolean; isPr: boolean; rpe?: number }> }> })
    .filter((w) => w.finishedAt)
    .sort((a, b) => a.startedAt - b.startedAt)

  const now = Date.now()
  const periodStart = period === 'all' ? 0 : now - PERIOD_DAYS[period] * 86_400_000

  const enduranceInPeriod = enduranceAll.filter((s) => s.startedAt >= periodStart)
  const workoutsInPeriod = workoutsAll.filter((w) => w.startedAt >= periodStart)

  // ---- Statut initial ----
  const firstWeight = weights[0]
  const firstEndurance = enduranceAll[0]
  const firstWorkout = workoutsAll[0]
  const trackingStart = Math.min(...[firstWeight?.loggedAt, firstEndurance?.startedAt, firstWorkout?.startedAt].filter((v): v is number => v != null))

  // ---- Poids ----
  const currentWeight = weights[weights.length - 1]?.weightKg ?? profile.bodyWeightKg ?? null
  const weightAtPeriodStart = [...weights].reverse().find((w) => w.loggedAt <= periodStart)?.weightKg ?? firstWeight?.weightKg ?? null
  const weightDeltaPeriod = currentWeight != null && weightAtPeriodStart != null ? round1(currentWeight - weightAtPeriodStart) : null
  const weightDeltaTotal = currentWeight != null && firstWeight ? round1(currentWeight - firstWeight.weightKg) : null

  // ---- Résumé période ----
  const enduranceDistanceKm = round1(enduranceInPeriod.reduce((s, e) => s + (e.distanceKm ?? 0), 0))
  const enduranceCalories = Math.round(enduranceInPeriod.reduce((s, e) => s + e.caloriesBurned, 0))
  const totalSets = workoutsInPeriod.reduce((s, w) => s + w.exercises.reduce((n, e) => n + e.sets.filter((st) => !st.isWarmup).length, 0), 0)
  const totalPr = workoutsInPeriod.reduce((s, w) => s + w.exercises.reduce((n, e) => n + e.sets.filter((st) => st.isPr).length, 0), 0)
  const prRatePct = totalSets > 0 ? round1((totalPr / totalSets) * 100) : null

  // ---- VO2max (Uth et al. 2004) ----
  const maxHr = 220 - ageYears
  const vo2max = restingHr > 0 ? Math.round(15.3 * (maxHr / restingHr)) : null

  // ---- IMC ----
  const bmi = currentWeight != null ? round1(currentWeight / ((heightCm / 100) * (heightCm / 100))) : null

  // ---- Charge cardio (kcal actives, proxy de charge — pas le vrai session-RPE
  // qui nécessite un RPE saisi à chaque séance gym, indisponible ici) ----
  const load7d = Math.round(enduranceAll.filter((e) => e.startedAt >= now - 7 * 86_400_000).reduce((s, e) => s + e.caloriesBurned, 0))
  const load28d = Math.round(enduranceAll.filter((e) => e.startedAt >= now - 28 * 86_400_000).reduce((s, e) => s + e.caloriesBurned, 0))
  const acwr = load28d > 0 ? round1(load7d / (load28d / 4)) : null

  // ---- Polarisation cardio (zones réelles si captures Apple Health/Google
  // Fit disponibles, sinon zone moyenne de séance) ----
  let easyMin = 0, moderateMin = 0, hardMin = 0
  for (const s of enduranceInPeriod) {
    const zb = s.healthCapture?.zoneBreakdown
    if (zb && zb.length > 0) {
      for (const z of zb) {
        if (z.zone <= 2) easyMin += z.minutes
        else if (z.zone === 3) moderateMin += z.minutes
        else hardMin += z.minutes
      }
    } else if (s.hrZone != null) {
      if (s.hrZone <= 2) easyMin += s.durationMin
      else if (s.hrZone === 3) moderateMin += s.durationMin
      else hardMin += s.durationMin
    }
  }
  const polarizedTotal = easyMin + moderateMin + hardMin
  const polarization = polarizedTotal > 0 ? { easyPct: Math.round((easyMin / polarizedTotal) * 100), moderatePct: Math.round((moderateMin / polarizedTotal) * 100), hardPct: Math.round((hardMin / polarizedTotal) * 100) } : null

  // ---- Diversité gym vs endurance (répartition du temps) ----
  const enduranceMinPeriod = enduranceInPeriod.reduce((s, e) => s + e.durationMin, 0)
  const gymMinPeriod = workoutsInPeriod.reduce((s, w) => s + (w.finishedAt! - w.startedAt) / 60000, 0)
  const activityMinTotal = enduranceMinPeriod + gymMinPeriod
  const diversitySplit = activityMinTotal > 0 ? { endurancePct: Math.round((enduranceMinPeriod / activityMinTotal) * 100), gymPct: Math.round((gymMinPeriod / activityMinTotal) * 100) } : null

  const chronology = [
    ...enduranceInPeriod.map((e) => `${fmtDate(e.startedAt)} — Endurance (${e.activityType}) : ${e.durationMin} min${e.distanceKm ? `, ${e.distanceKm} km` : ''}, ${e.caloriesBurned} kcal${e.avgHeartRate ? `, FC moy. ${e.avgHeartRate} bpm` : ''}${e.rpe != null ? `, RPE ${e.rpe}/10` : ''}`),
    ...workoutsInPeriod.map((w) => {
      const sets = w.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.isWarmup).length, 0)
      const pr = w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.isPr).length, 0)
      return `${fmtDate(w.startedAt)} — Musculation "${w.name}" : ${w.exercises.length} exercices, ${sets} séries${pr > 0 ? `, ${pr} record(s) personnel(s)` : ''}`
    }),
  ].sort()

  const html = `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Rapport de progression Fit2Be-PaLaMa</title></head>
<body>
<h1>Rapport de progression — ${PERIOD_LABEL[period]}</h1>
<p>Document généré automatiquement à partir du suivi sportif enregistré dans l'application Fit2Be-PaLaMa. Toutes les données ci-dessous sont réelles, saisies ou synchronisées par l'utilisateur — rien n'est simulé.</p>

<h2>Profil</h2>
<ul>
<li>Âge : ${ageYears} ans, sexe : ${sex}, taille : ${heightCm} cm</li>
<li>FC de repos déclarée : ${restingHr} bpm, FC max théorique : ${maxHr} bpm</li>
<li>Poids actuel : ${currentWeight ?? 'inconnu'} kg${bmi != null ? ` (IMC ${bmi})` : ''}</li>
</ul>

<h2>Statut initial (début du suivi)</h2>
<p>Suivi commencé le ${Number.isFinite(trackingStart) ? fmtDate(trackingStart) : 'date inconnue'}.</p>
${firstWeight ? `<p>Premier poids enregistré : ${firstWeight.weightKg} kg le ${fmtDate(firstWeight.loggedAt)}.</p>` : ''}

<h2>Évolution du poids</h2>
<ul>
<li>Poids en début de période : ${weightAtPeriodStart ?? 'inconnu'} kg</li>
<li>Poids actuel : ${currentWeight ?? 'inconnu'} kg</li>
<li>Variation sur la période : ${weightDeltaPeriod != null ? `${weightDeltaPeriod > 0 ? '+' : ''}${weightDeltaPeriod} kg` : 'non calculable'}</li>
<li>Variation depuis le tout début du suivi : ${weightDeltaTotal != null ? `${weightDeltaTotal > 0 ? '+' : ''}${weightDeltaTotal} kg` : 'non calculable'}</li>
</ul>

<h2>Résumé de la période</h2>
<ul>
<li>${enduranceInPeriod.length} sortie(s) endurance, ${enduranceDistanceKm} km au total, ${enduranceCalories} kcal brûlées</li>
<li>${workoutsInPeriod.length} séance(s) de musculation, ${totalSets} série(s) travaillante(s)${totalPr > 0 ? `, dont ${totalPr} record(s) personnel(s)` : ''}</li>
${prRatePct != null ? `<li>Taux de records personnels : ${prRatePct}% des séries — indicateur de progression en force (formule : records ÷ séries totales)</li>` : ''}
</ul>

<h2>Analyse des indices (à interpréter, pas juste énumérer)</h2>
<ul>
<li><strong>VO2max estimé</strong> : ${vo2max ?? '—'} ml/kg/min (formule Uth et al. 2004 : 15.3 × FCmax/FCrepos). Repères : sédentaire ≈35-40, entraîné ≈45-55, athlète &gt;55.</li>
${acwr != null ? `<li><strong>Charge cardio aiguë:chronique (ACWR)</strong> : ${acwr} (kcal actives des 7 derniers jours ÷ moyenne quotidienne des 28 derniers jours). Zone saine 0.8-1.3 ; au-delà de 1.5, risque de surcharge à surveiller.</li>` : ''}
${polarization ? `<li><strong>Polarisation cardio</strong> sur la période : ${polarization.easyPct}% facile, ${polarization.moderatePct}% modéré, ${polarization.hardPct}% dur. Le modèle "polarisé" recommandé en sciences du sport vise environ 80% facile / 20% dur, avec peu de zone modérée.</li>` : ''}
${diversitySplit ? `<li><strong>Répartition du temps d'entraînement</strong> : ${diversitySplit.endurancePct}% endurance, ${diversitySplit.gymPct}% musculation.</li>` : ''}
</ul>

<h2>Détail chronologique des séances de la période</h2>
<ul>
${chronology.length > 0 ? chronology.map((c) => `<li>${c}</li>`).join('\n') : '<li>Aucune séance enregistrée sur cette période.</li>'}
</ul>

<h2>Programmes coaching disponibles dans l'application (pour recommandations concrètes)</h2>
<p>Ces programmes existent déjà dans l'app et peuvent être proposés nommément comme prochaine étape concrète :</p>
${PROGRAM_CATALOG_HTML}

<h2>Consigne pour l'analyse</h2>
<p>À partir de ces données réelles : fais une synthèse honnête de la progression sur ${PERIOD_LABEL[period]}, en comparant à la période précédente et au statut initial quand c'est pertinent. Mets en avant les vrais progrès. Sois franc sur les points à travailler (charge, régularité, équilibre gym/endurance, récupération). Termine par une conclusion globale claire, et propose concrètement 1 à 2 programmes précis du catalogue ci-dessus adaptés à la situation actuelle — cite leur nom exact.</p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.status(200).send(html)
}
