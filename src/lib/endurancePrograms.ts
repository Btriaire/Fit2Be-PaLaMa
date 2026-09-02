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
  /** Vitesse tapis ciblée (km/h) — champ structuré (contrairement à `target`,
   * en texte libre) pour pouvoir tracer le profil vitesse/pente du programme
   * personnalisé, façon graphique tapis pré-réglé. */
  speedKmh?: number
  /** Pente tapis ciblée — niveau d'inclinaison 1 à 25 (repère habituel des
   * tapis de course), pas un pourcentage. Utilisé par les programmes
   * personnalisés (voir CustomProgramBuilder). */
  inclineLevel?: number
  /** Pente tapis ciblée en % — utilisé par les programmes intégrés
   * ci-dessous, qui expriment tous la pente en pourcentage plutôt qu'en
   * niveau. Deux champs distincts plutôt qu'une conversion approximative
   * entre deux échelles différentes selon la marque de tapis. */
  inclinePercent?: number
}

export interface EnduranceProgram {
  id: string
  name: string
  activityType: Extract<EnduranceActivityType, 'velo-appart' | 'tapis'>
  focus: string
  description: string
  /** Niveau global du programme — sert à le proposer en priorité selon
   * l'état de forme déclaré avant la séance (voir coachingFilter.ts). */
  difficulty: PhaseIntensity
  phases: ProgramPhase[]
  muscuAddOn?: { label: string; description: string }
  /** Rappel qu'on peut décrocher des repères chiffrés proposés sans perdre la
   * séance — affiché dans l'aperçu ET pendant le chrono live. */
  fallbackNote: string
}

/** Durée totale du programme en minutes, dérivée de ses phases — sert au
 * filtre "temps disponible" avant la proposition d'un programme. */
export function programDurationMin(program: EnduranceProgram): number {
  return Math.round(program.phases.reduce((sum, p) => sum + p.durationSec, 0) / 60)
}

export const FALLBACK_NOTE =
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
    difficulty: 'modéré',
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
    difficulty: 'dur',
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
    difficulty: 'modéré',
    description:
      "6 blocs de 3 min à allure tempo (soutenue mais tenable) entrecoupés de 2 min faciles — développe la vitesse au seuil, utile pour préparer un objectif chronométré.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 480, intensity: 'facile', target: '5-6 km/h marche · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
      ...intervals(
        6,
        { label: 'Tempo', durationSec: 180, intensity: 'dur', target: '10-11 km/h · 1% incl.', speedKmh: 10.5, inclinePercent: 1 },
        { label: 'Récup', durationSec: 120, intensity: 'facile', target: '6-7 km/h · 0-1% incl.', speedKmh: 6.5, inclinePercent: 0.5 },
      ),
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
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
    difficulty: 'modéré',
    description:
      "Footing continu à allure confortable — la base du volume d'entraînement course à pied, ce sur quoi repose tout le reste de la préparation.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement marche/trot', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
      { label: 'Zone 2 continue', durationSec: 1500, intensity: 'modéré', target: '8-9 km/h · 1% incl.', speedKmh: 8.5, inclinePercent: 1 },
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
    ],
  },
  {
    id: 'velo-facile',
    name: 'Vélo Facile — Récupération active',
    activityType: 'velo-appart',
    focus: 'Très léger, ~15 min — jour de récup ou reprise',
    difficulty: 'facile',
    description:
      "Effort minimal, juste de quoi faire circuler le sang sans ajouter de fatigue — pour un lendemain de grosse séance, ou une reprise après une pause.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Pédalage facile', durationSec: 900, intensity: 'facile', target: '60-70 RPM · résistance très légère' },
    ],
  },
  {
    id: 'velo-difficile',
    name: 'Vélo Difficile — Sprints Courts',
    activityType: 'velo-appart',
    focus: 'Sprints maximaux, ~20 min — niveau confirmé',
    difficulty: 'dur',
    description:
      "10 sprints de 30s à effort maximal / 90s de récup — plus court et plus intense que le HIIT classique, sollicite la filière anaérobie. Échauffement obligatoire avant de sprinter.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 300, intensity: 'facile', target: '70-80 RPM · résistance légère' },
      ...intervals(
        10,
        { label: 'Sprint', durationSec: 30, intensity: 'dur', target: '100+ RPM · résistance forte (effort max)' },
        { label: 'Récup', durationSec: 90, intensity: 'facile', target: '60-65 RPM · résistance très légère' },
      ),
      { label: 'Retour au calme', durationSec: 180, intensity: 'facile', target: '60-70 RPM · résistance légère' },
    ],
  },
  {
    id: 'tapis-facile',
    name: 'Tapis Facile — Marche active',
    activityType: 'tapis',
    focus: 'Marche continue, ~20 min — récup ou débutant',
    difficulty: 'facile',
    description:
      "Marche à allure soutenue mais sans effort respiratoire — bon point d'entrée si tu débutes le tapis, ou séance de récup entre deux sorties plus dures.",
    fallbackNote: FALLBACK_NOTE,
    phases: [{ label: 'Marche continue', durationSec: 1200, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 }],
  },
  {
    id: 'tapis-difficile',
    name: 'Tapis Difficile — Fractionné Intense',
    activityType: 'tapis',
    focus: "Fractionné court et rapide, ~26 min — niveau confirmé",
    difficulty: 'dur',
    description:
      "8 répétitions de 400m environ (90s à allure rapide) / 90s de récup — travaille la VMA, plus exigeant que le fractionné tempo. Réservé à ceux qui courent déjà régulièrement.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 480, intensity: 'facile', target: '6-7 km/h · 0% incl.', speedKmh: 6.5, inclinePercent: 0 },
      ...intervals(
        8,
        { label: 'Rapide', durationSec: 90, intensity: 'dur', target: '13-14 km/h · 0-1% incl.', speedKmh: 13.5, inclinePercent: 0.5 },
        { label: 'Récup', durationSec: 90, intensity: 'facile', target: '6-7 km/h · 0% incl.', speedKmh: 6.5, inclinePercent: 0 },
      ),
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
    ],
  },
  {
    id: 'tapis-pyramide',
    name: 'Tapis Pyramide — Vitesse progressive',
    activityType: 'tapis',
    focus: 'Paliers en pyramide, ~40 min',
    difficulty: 'modéré',
    description:
      "La vitesse monte palier par palier jusqu'à un pic, puis redescend symétriquement — inspiré d'un programme tapis pré-réglé classique. Plus varié qu'un tempo continu, sans la difficulté du fractionné court.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
      { label: 'Palier 1', durationSec: 240, intensity: 'modéré', target: '7 km/h · 0% incl.', speedKmh: 7, inclinePercent: 0 },
      { label: 'Palier 2', durationSec: 240, intensity: 'modéré', target: '8 km/h · 0% incl.', speedKmh: 8, inclinePercent: 0 },
      { label: 'Palier 3', durationSec: 240, intensity: 'dur', target: '9.5 km/h · 1% incl.', speedKmh: 9.5, inclinePercent: 1 },
      { label: 'Pic', durationSec: 360, intensity: 'dur', target: '11 km/h · 1-2% incl.', speedKmh: 11, inclinePercent: 1.5 },
      { label: 'Palier 4', durationSec: 240, intensity: 'dur', target: '9.5 km/h · 1% incl.', speedKmh: 9.5, inclinePercent: 1 },
      { label: 'Palier 5', durationSec: 240, intensity: 'modéré', target: '8 km/h · 0% incl.', speedKmh: 8, inclinePercent: 0 },
      { label: 'Palier 6', durationSec: 240, intensity: 'modéré', target: '7 km/h · 0% incl.', speedKmh: 7, inclinePercent: 0 },
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '5-6 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
    ],
  },
  {
    id: 'tapis-pyramide-douce',
    name: 'Tapis Pyramide Douce — Marche/Trot',
    activityType: 'tapis',
    focus: 'Paliers en pyramide, léger, ~24 min — débutant ou reprise',
    difficulty: 'facile',
    description:
      "Même principe que la pyramide vitesse, mais entre marche rapide et trot léger — garde le côté varié et motivant d'un profil qui monte puis redescend, sans jamais sortir du confortable.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 240, intensity: 'facile', target: '4.5 km/h · 0% incl.', speedKmh: 4.5, inclinePercent: 0 },
      { label: 'Palier 1', durationSec: 180, intensity: 'facile', target: '5.5 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
      { label: 'Palier 2', durationSec: 180, intensity: 'modéré', target: '6.5 km/h · 0% incl.', speedKmh: 6.5, inclinePercent: 0 },
      { label: 'Pic', durationSec: 240, intensity: 'modéré', target: '7.5 km/h · 1% incl.', speedKmh: 7.5, inclinePercent: 1 },
      { label: 'Palier 3', durationSec: 180, intensity: 'modéré', target: '6.5 km/h · 0% incl.', speedKmh: 6.5, inclinePercent: 0 },
      { label: 'Palier 4', durationSec: 180, intensity: 'facile', target: '5.5 km/h · 0% incl.', speedKmh: 5.5, inclinePercent: 0 },
      { label: 'Retour au calme', durationSec: 240, intensity: 'facile', target: '4.5 km/h · 0% incl.', speedKmh: 4.5, inclinePercent: 0 },
    ],
  },
  {
    id: 'tapis-pyramide-incline',
    name: 'Tapis Pyramide Inclinaison — Marche active',
    activityType: 'tapis',
    focus: 'Paliers d\'inclinaison, vitesse constante, ~24 min',
    difficulty: 'facile',
    description:
      "La vitesse ne bouge pas (marche active) — c'est l'inclinaison qui monte en pyramide jusqu'à une petite côte, puis redescend. Sollicite bien les jambes et le cardio sans le choc de la course, et reste varié grâce au profil de côte.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 240, intensity: 'facile', target: '5 km/h · 0% incl.', speedKmh: 5, inclinePercent: 0 },
      { label: 'Palier 1', durationSec: 180, intensity: 'facile', target: '5.5 km/h · 2% incl.', speedKmh: 5.5, inclinePercent: 2 },
      { label: 'Palier 2', durationSec: 180, intensity: 'modéré', target: '5.5 km/h · 4% incl.', speedKmh: 5.5, inclinePercent: 4 },
      { label: 'Pic', durationSec: 240, intensity: 'modéré', target: '5.5 km/h · 6% incl.', speedKmh: 5.5, inclinePercent: 6 },
      { label: 'Palier 3', durationSec: 180, intensity: 'modéré', target: '5.5 km/h · 4% incl.', speedKmh: 5.5, inclinePercent: 4 },
      { label: 'Palier 4', durationSec: 180, intensity: 'facile', target: '5.5 km/h · 2% incl.', speedKmh: 5.5, inclinePercent: 2 },
      { label: 'Retour au calme', durationSec: 240, intensity: 'facile', target: '5 km/h · 0% incl.', speedKmh: 5, inclinePercent: 0 },
    ],
  },
  {
    id: 'tapis-pyramide-intense',
    name: 'Tapis Pyramide Intense — Double pic',
    activityType: 'tapis',
    focus: 'Deux pics de vitesse, ~33 min — niveau confirmé',
    difficulty: 'dur',
    description:
      "Une première pyramide jusqu'à un pic soutenu, une courte récup active, puis un second pic encore plus rapide avec un peu d'inclinaison — plus exigeant que la pyramide simple, sur la filière aérobie haute.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 300, intensity: 'facile', target: '6 km/h · 0% incl.', speedKmh: 6, inclinePercent: 0 },
      { label: 'Montée 1', durationSec: 180, intensity: 'modéré', target: '9 km/h · 0% incl.', speedKmh: 9, inclinePercent: 0 },
      { label: 'Montée 2', durationSec: 180, intensity: 'dur', target: '10.5 km/h · 1% incl.', speedKmh: 10.5, inclinePercent: 1 },
      { label: 'Pic 1', durationSec: 240, intensity: 'dur', target: '12 km/h · 1% incl.', speedKmh: 12, inclinePercent: 1 },
      { label: 'Récup active', durationSec: 180, intensity: 'modéré', target: '8 km/h · 0% incl.', speedKmh: 8, inclinePercent: 0 },
      { label: 'Pic 2', durationSec: 240, intensity: 'dur', target: '13 km/h · 2% incl.', speedKmh: 13, inclinePercent: 2 },
      { label: 'Descente 1', durationSec: 180, intensity: 'dur', target: '10.5 km/h · 1% incl.', speedKmh: 10.5, inclinePercent: 1 },
      { label: 'Descente 2', durationSec: 180, intensity: 'modéré', target: '9 km/h · 0% incl.', speedKmh: 9, inclinePercent: 0 },
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '6 km/h · 0% incl.', speedKmh: 6, inclinePercent: 0 },
    ],
  },
  {
    id: 'tapis-pyramide-cote',
    name: 'Tapis Pyramide Vitesse + Côte',
    activityType: 'tapis',
    focus: 'Vitesse ET inclinaison en pyramide, ~27 min — niveau avancé',
    difficulty: 'dur',
    description:
      "Vitesse et inclinaison montent ensemble jusqu'à un pic en côte à allure rapide — la version la plus exigeante de la pyramide, proche d'un travail de VMA en côte. Réservé à ceux qui courent déjà régulièrement.",
    fallbackNote: FALLBACK_NOTE,
    phases: [
      { label: 'Échauffement', durationSec: 300, intensity: 'facile', target: '6 km/h · 0% incl.', speedKmh: 6, inclinePercent: 0 },
      { label: 'Montée 1', durationSec: 180, intensity: 'dur', target: '10 km/h · 2% incl.', speedKmh: 10, inclinePercent: 2 },
      { label: 'Montée 2', durationSec: 180, intensity: 'dur', target: '11 km/h · 4% incl.', speedKmh: 11, inclinePercent: 4 },
      { label: 'Pic', durationSec: 300, intensity: 'dur', target: '12 km/h · 6% incl.', speedKmh: 12, inclinePercent: 6 },
      { label: 'Descente 1', durationSec: 180, intensity: 'dur', target: '11 km/h · 4% incl.', speedKmh: 11, inclinePercent: 4 },
      { label: 'Descente 2', durationSec: 180, intensity: 'dur', target: '10 km/h · 2% incl.', speedKmh: 10, inclinePercent: 2 },
      { label: 'Retour au calme', durationSec: 300, intensity: 'facile', target: '6 km/h · 0% incl.', speedKmh: 6, inclinePercent: 0 },
    ],
  },
]
