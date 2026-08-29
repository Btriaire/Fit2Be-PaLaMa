// Programmes coaching structurés pour le cardio indoor (vélo de salle, tapis)
// — contrairement aux templates Gym (séries/reps), ici la structure est une
// liste ordonnée de phases (échauffement, effort, récup...) que le chrono
// live d'Endurance peut dérouler automatiquement, avec l'intensité et le
// repère chiffré (RPM/vitesse) cible de chacune. Le complément muscu reste
// descriptif (pas de session créée), même logique que
// TrainingTemplate.cardioBlock : pas de modèle de données unique pour une
// séance qui mélange durée cardio et séries de muscu.

import type { EnduranceActivityType } from '../types'

export type PhaseIntensity = 'facile' | 'modéré' | 'dur'

export interface ProgramPhase {
  label: string
  durationSec: number
  intensity: PhaseIntensity
  /** Repère chiffré indicatif (RPM/résistance pour le vélo, vitesse/inclinaison
   * pour le tapis) — pas une consigne rigide, voir EnduranceProgram.fallbackNote. */
  target?: string
}

export interface EnduranceProgram {
  id: string
  name: string
  activityType: Extract<EnduranceActivityType, 'velo-appart' | 'tapis'>
  focus: string
  description: string
  phases: ProgramPhase[]
  muscuAddOn?: { label: string; description: string }
  /** Rappel qu'on peut décrocher des repères chiffrés proposés sans perdre la
   * séance — affiché dans l'aperçu ET pendant le chrono live. */
  fallbackNote: string
}

const FALLBACK_NOTE =
  "Ces repères (RPM, vitesse) sont indicatifs, pas une obligation — si tu ne les tiens pas, baisse l'intensité mais garde la durée de la phase. Le ressenti (essoufflement, capacité à parler) prime toujours sur le chiffre affiché."

function intervals(count: number, work: ProgramPhase, rest: ProgramPhase): ProgramPhase[] {
  return Array.from({ length: count }, () => [work, rest]).flat()
}

export const ENDURANCE_PROGRAMS: EnduranceProgram[] = [
  {
    id: 'velo-zone2',
    name: 'Vélo Zone 2 — Fondamentale',
    activityType: 'velo-appart',
    focus: 'Endurance fondamentale, ~30 min',
    description:
      "Effort continu et modéré (tu dois pouvoir parler sans être essoufflé) — construit la base aérobie sans fatigue résiduelle, à répéter souvent.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 300, intensity: 'facile', target: '70-80 RPM · résistance légère' },
      { label: 'Zone 2 continue', durationSec: 1500, intensity: 'modéré', target: '75-85 RPM · résistance modérée' },
      { label: 'Retour au calme', durationSec: 180, intensity: 'facile', target: '60-70 RPM · résistance légère' },
    ],
    muscuAddOn: {
      label: 'Gainage (optionnel, après)',
      description: 'Planche 2×30s — juste de quoi maintenir le gainage, rien qui fatigue avant la prochaine séance.',
    },
  },
  {
    id: 'velo-hiit',
    name: 'Vélo HIIT — Brûle-graisse',
    activityType: 'velo-appart',
    focus: 'Fractionné haute intensité, ~24 min',
    description:
      "8 répétitions d'1 min à fond / 1 min de récup active — le format le plus efficace pour la dépense calorique et le cardio en peu de temps. Exigeant : hydrate-toi avant.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 300, intensity: 'facile', target: '70-80 RPM · résistance légère' },
      ...intervals(
        8,
        { label: 'Effort', durationSec: 60, intensity: 'dur', target: '95-100+ RPM · résistance forte (sprint)' },
        { label: 'Récup', durationSec: 60, intensity: 'facile', target: '60-70 RPM · résistance très légère' },
      ),
      { label: 'Retour au calme', durationSec: 180, intensity: 'facile', target: '60-70 RPM · résistance légère' },
    ],
  },
  {
    id: 'tapis-fractionne',
    name: 'Tapis Fractionné — Préparation course',
    activityType: 'tapis',
    focus: 'Tempo par intervalles, ~30 min',
    description:
      "6 blocs de 3 min à allure tempo (soutenue mais tenable) entrecoupés de 2 min faciles — développe la vitesse au seuil, utile pour préparer un objectif chronométré.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 480, intensity: 'facile', target: '5-6 km/h marche · 0% incl.' },
      ...intervals(
        6,
        { label: 'Tempo', durationSec: 180, intensity: 'dur', target: '10-11 km/h · 1% incl.' },
        { label: 'Récup', durationSec: 120, intensity: 'facile', target: '6-7 km/h · 0-1% incl.' },
      ),
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.' },
    ],
    muscuAddOn: {
      label: 'Renfo jambes (optionnel, jour séparé)',
      description: "Presse à cuisses + step-ups légers — à faire un autre jour, jamais juste avant une séance clé.",
    },
  },
  {
    id: 'tapis-zone2',
    name: 'Tapis Endurance — Zone 2',
    activityType: 'tapis',
    focus: 'Endurance fondamentale, ~35 min',
    description:
      "Footing continu à allure confortable — la base du volume d'entraînement course à pied, ce sur quoi repose tout le reste de la préparation.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement marche/trot', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.' },
      { label: 'Zone 2 continue', durationSec: 1500, intensity: 'modéré', target: '8-9 km/h · 1% incl.' },
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.' },
    ],
  },
]
