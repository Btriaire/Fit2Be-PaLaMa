// Templates d'entraînement ciblant des chefs musculaires précis (pas juste
// un groupe musculaire), avec équipement de salle classique (barre,
// haltères, machine, poulie, poids du corps) et une prescription
// séries/reps + un repère technique par exercice.

export interface TemplateExercise {
  exerciseId: string
  targetSets: number
  targetReps: string
  /** Chef musculaire ciblé + repère technique d'exécution. */
  note: string
}

export interface TrainingTemplate {
  id: string
  name: string
  focus: string
  description: string
  exercises: TemplateExercise[]
}

export const TRAINING_TEMPLATES: TrainingTemplate[] = [
  {
    id: 'tpl-pectoraux',
    name: 'Pectoraux — 3 chefs',
    focus: 'Chef claviculaire, sternocostal, faisceau interne',
    description:
      "Travaille le haut, le milieu et le bas des pecs avec un angle dédié à chaque chef, plus un mouvement d'isolation pour la contraction interne.",
    exercises: [
      {
        exerciseId: 'incline-db-press',
        targetSets: 4,
        targetReps: '8-10',
        note: "Chef claviculaire (haut des pecs). Banc à 30-45°, coudes alignés sous les haltères, ne pas descendre plus bas que les épaules.",
      },
      {
        exerciseId: 'bench-press',
        targetSets: 4,
        targetReps: '6-8',
        note: "Chef sternocostal (milieu). Barre descend au niveau du sternum, coudes à ~45° du buste, omoplates serrées.",
      },
      {
        exerciseId: 'decline-barbell-bench-press',
        targetSets: 3,
        targetReps: '8-10',
        note: "Chef sternocostal bas. Banc en angle négatif, trajectoire courte, garde le contrôle à la descente.",
      },
      {
        exerciseId: 'cable-crossover',
        targetSets: 3,
        targetReps: '12-15',
        note: "Fibres internes, étirement + contraction complète. Poulies hautes, croise les mains devant le bas-ventre, souffle à la contraction.",
      },
      {
        exerciseId: 'butterfly',
        targetSets: 3,
        targetReps: '12-15',
        note: "Isolation totale, tension constante sur l'ensemble du pec. Coudes légèrement fléchis, ne verrouille jamais en fin de course.",
      },
    ],
  },
  {
    id: 'tpl-dos',
    name: 'Dos — Épaisseur & largeur',
    focus: 'Grand dorsal, trapèzes, rhomboïdes, érecteurs',
    description:
      "Combine tirages verticaux pour la largeur et tirages horizontaux pour l'épaisseur, avec un mouvement de force en fin de séance.",
    exercises: [
      {
        exerciseId: 'pull-up',
        targetSets: 4,
        targetReps: '6-10',
        note: "Grand dorsal, largeur du dos. Prise large pronation, tire les coudes vers le bas et non le corps vers la barre.",
      },
      {
        exerciseId: 'lat-pulldown',
        targetSets: 3,
        targetReps: '10-12',
        note: "Alternative/complément aux tractions. Tire la barre devant, buste légèrement en arrière, contraction 1s en bas.",
      },
      {
        exerciseId: 'barbell-row',
        targetSets: 4,
        targetReps: '8-10',
        note: "Épaisseur du dos (rhomboïdes, trapèzes moyens). Buste penché à 45°, tire la barre vers le nombril, dos toujours plat.",
      },
      {
        exerciseId: 'seated-cable-rows',
        targetSets: 3,
        targetReps: '10-12',
        note: "Milieu du dos, rétraction des omoplates. Dos droit, tire vers l'abdomen sans te pencher en arrière.",
      },
      {
        exerciseId: 'barbell-shrug',
        targetSets: 3,
        targetReps: '12-15',
        note: "Trapèzes supérieurs. Haussement pur des épaules vers les oreilles, pas de rotation, pas de triche avec les bras.",
      },
      {
        exerciseId: 'deadlift',
        targetSets: 3,
        targetReps: '5',
        note: "Chaîne postérieure complète, érecteurs du rachis. Barre proche des tibias, pousse le sol plutôt que de tirer la barre.",
      },
    ],
  },
  {
    id: 'tpl-epaules',
    name: 'Épaules — 3 faisceaux',
    focus: 'Faisceau antérieur, latéral, postérieur',
    description:
      "Un mouvement de poussée pour l'antérieur, de l'isolation pour le faisceau latéral (largeur d'épaule) et du tirage horizontal pour le postérieur, souvent délaissé.",
    exercises: [
      {
        exerciseId: 'overhead-press',
        targetSets: 4,
        targetReps: '6-8',
        note: "Faisceau antérieur + moyen. Barre part devant le visage, gainage serré, ne cambre pas le bas du dos.",
      },
      {
        exerciseId: 'side-lateral-raise',
        targetSets: 4,
        targetReps: '12-15',
        note: "Faisceau latéral — c'est lui qui donne la largeur d'épaule. Coudes légèrement fléchis, monte jusqu'à l'horizontale, pas plus haut.",
      },
      {
        exerciseId: 'dumbbell-shoulder-press',
        targetSets: 3,
        targetReps: '8-10',
        note: "Antérieur/moyen, amplitude complète. Descend jusqu'à ce que les coudes soient sous les épaules.",
      },
      {
        exerciseId: 'cable-rear-delt-fly',
        targetSets: 3,
        targetReps: '12-15',
        note: "Faisceau postérieur, souvent le plus faible. Poulies croisées, buste penché en avant, tire vers l'arrière coudes hauts.",
      },
      {
        exerciseId: 'face-pull',
        targetSets: 3,
        targetReps: '15',
        note: "Postérieur + rotateurs externes, protège la santé de l'épaule. Corde tirée vers le visage, coudes hauts, écarte bien les mains.",
      },
    ],
  },
  {
    id: 'tpl-bras',
    name: 'Bras — Biceps & Triceps',
    focus: 'Chef long/court du biceps, 3 chefs du triceps',
    description:
      "Un angle par chef : le biceps long s'étire mieux bras derrière le corps, le court se contracte mieux au pupitre ; le triceps répond à l'étirement en extension et à la contraction en poussée.",
    exercises: [
      {
        exerciseId: 'incline-dumbbell-curl',
        targetSets: 3,
        targetReps: '10-12',
        note: "Chef long du biceps (étirement maximal). Banc incliné, bras tendus derrière le buste, ne balance pas les épaules.",
      },
      {
        exerciseId: 'preacher-curl',
        targetSets: 3,
        targetReps: '10-12',
        note: "Chef court du biceps (pic). Pupitre qui bloque la triche, ne verrouille pas complètement les coudes en bas.",
      },
      {
        exerciseId: 'hammer-curls',
        targetSets: 3,
        targetReps: '10-12',
        note: "Brachial + avant-bras, épaissit le bras vu de côté. Prise neutre (paumes face à face) du début à la fin.",
      },
      {
        exerciseId: 'dips',
        targetSets: 4,
        targetReps: '8-12',
        note: "Chef latéral + longue portion du triceps. Buste droit (pas penché en avant) pour cibler le triceps plutôt que les pecs.",
      },
      {
        exerciseId: 'ez-bar-skullcrusher',
        targetSets: 3,
        targetReps: '10-12',
        note: "Chef long du triceps (étirement). Coudes fixes au-dessus du visage, seuls les avant-bras bougent.",
      },
      {
        exerciseId: 'triceps-pushdown-rope-attachment',
        targetSets: 3,
        targetReps: '12-15',
        note: "Chef latéral, finisher. Écarte la corde en fin de mouvement, coudes collés au corps sans bouger.",
      },
    ],
  },
  {
    id: 'tpl-jambes',
    name: 'Jambes — Quadriceps, Ischios, Fessiers, Mollets',
    focus: 'Vaste externe/interne, ischio-jambiers, fessiers, gastrocnémien/soléaire',
    description:
      "Séance complète bas du corps : un mouvement polyarticulaire lourd, de l'isolation quadriceps, un mouvement de hanche pour ischios/fessiers, et les deux muscles du mollet (genou tendu et fléchi).",
    exercises: [
      {
        exerciseId: 'squat',
        targetSets: 4,
        targetReps: '6-8',
        note: "Quadriceps global + fessiers, le mouvement de base. Descend hanche sous le genou, garde les talons au sol.",
      },
      {
        exerciseId: 'leg-press',
        targetSets: 3,
        targetReps: '10-12',
        note: "Quadriceps en sécurité. Pieds bas et rapprochés sur le plateau pour insister sur le quadriceps plutôt que les fessiers.",
      },
      {
        exerciseId: 'leg-extensions',
        targetSets: 3,
        targetReps: '12-15',
        note: "Isolation vaste externe/interne. Contraction 1s en haut de chaque répétition, redescends lentement.",
      },
      {
        exerciseId: 'romanian-deadlift',
        targetSets: 4,
        targetReps: '8-10',
        note: "Ischio-jambiers + fessiers en étirement. La hanche recule en premier, dos plat, la barre frôle les jambes.",
      },
      {
        exerciseId: 'lying-leg-curls',
        targetSets: 3,
        targetReps: '12-15',
        note: "Isolation pure des ischio-jambiers. Contraction complète en haut, bassin collé au banc.",
      },
      {
        exerciseId: 'standing-calf-raises',
        targetSets: 4,
        targetReps: '15-20',
        note: "Gastrocnémien (mollet, genou tendu). Amplitude complète, pause en haut et en bas.",
      },
      {
        exerciseId: 'seated-calf-raise',
        targetSets: 3,
        targetReps: '15-20',
        note: "Soléaire (genou fléchi), complète le développement du mollet là où le mouvement debout ne suffit pas.",
      },
    ],
  },
  {
    id: 'tpl-machine-full-body',
    name: 'Full Body — 100% Machines',
    focus: 'Corps entier, guidé, faible risque technique',
    description:
      "Séance complète sans barre ni haltère libre : trajectoire guidée sur chaque mouvement, idéal quand la salle est bondée ou pour progresser en sécurité sur les fondamentaux.",
    exercises: [
      {
        exerciseId: 'leg-press',
        targetSets: 4,
        targetReps: '10-12',
        note: "Quadriceps + fessiers, guidé. Pieds au centre du plateau, ne verrouille jamais complètement les genoux en haut.",
      },
      {
        exerciseId: 'machine-bench-press',
        targetSets: 4,
        targetReps: '8-10',
        note: "Pectoraux, trajectoire fixe. Règle le siège pour que la poignée soit à hauteur de poitrine.",
      },
      {
        exerciseId: 'leverage-high-row',
        targetSets: 4,
        targetReps: '10-12',
        note: "Dos, épaisseur. Poitrine calée contre l'appui, tire les coudes vers l'arrière sans à-coup.",
      },
      {
        exerciseId: 'machine-shoulder-military-press',
        targetSets: 3,
        targetReps: '8-10',
        note: "Épaules, faisceau antérieur. Dos bien plaqué au dossier, ne cambre pas pour finir la répétition.",
      },
      {
        exerciseId: 'lying-leg-curls',
        targetSets: 3,
        targetReps: '12-15',
        note: "Ischio-jambiers, isolation. Bassin collé au banc, contraction complète en haut.",
      },
      {
        exerciseId: 'standing-calf-raises',
        targetSets: 3,
        targetReps: '15-20',
        note: "Mollets. Amplitude complète, pause en haut et en bas de chaque répétition.",
      },
    ],
  },
  {
    id: 'tpl-machine-haut',
    name: 'Haut du corps — Machines',
    focus: 'Pectoraux, dos, épaules, bras — 100% guidé',
    description:
      "Toute la séance du haut du corps sur machines : parfait pour un retour après blessure, un débutant, ou simplement varier des barres/haltères.",
    exercises: [
      {
        exerciseId: 'leverage-incline-chest-press',
        targetSets: 4,
        targetReps: '8-10',
        note: "Haut des pecs, guidé. Poignées à hauteur de clavicule avant de démarrer.",
      },
      {
        exerciseId: 'leverage-high-row',
        targetSets: 4,
        targetReps: '10-12',
        note: "Épaisseur du dos. Tire les coudes vers l'arrière, contraction 1s en fin de mouvement.",
      },
      {
        exerciseId: 'lying-t-bar-row',
        targetSets: 3,
        targetReps: '10-12',
        note: "Milieu du dos. Buste calé, tire vers le bas-ventre sans cambrer.",
      },
      {
        exerciseId: 'machine-shoulder-military-press',
        targetSets: 3,
        targetReps: '8-10',
        note: "Épaules, faisceau antérieur/moyen. Amplitude complète, contrôle la descente.",
      },
      {
        exerciseId: 'reverse-machine-flyes',
        targetSets: 3,
        targetReps: '12-15',
        note: "Faisceau postérieur d'épaule, souvent négligé. Coudes hauts, ouvre largement sans à-coup.",
      },
      {
        exerciseId: 'machine-bicep-curl',
        targetSets: 3,
        targetReps: '10-12',
        note: "Biceps, isolation stricte. Coudes fixes contre l'appui, pas de triche avec les épaules.",
      },
      {
        exerciseId: 'machine-triceps-extension',
        targetSets: 3,
        targetReps: '10-12',
        note: "Triceps, finisher. Coudes collés au corps, extension complète sans verrouiller brutalement.",
      },
    ],
  },
  {
    id: 'tpl-machine-bas',
    name: 'Bas du corps — Machines',
    focus: 'Quadriceps, ischios, fessiers, mollets, adducteurs/abducteurs',
    description:
      "Jambes complètes sur machines guidées, y compris le travail latéral de hanche (adducteurs/abducteurs) rarement fait avec des poids libres.",
    exercises: [
      {
        exerciseId: 'hack-squat',
        targetSets: 4,
        targetReps: '8-10',
        note: "Quadriceps global, guidé en sécurité. Dos plaqué au support, descend jusqu'à ce que les cuisses soient parallèles.",
      },
      {
        exerciseId: 'leg-press',
        targetSets: 3,
        targetReps: '10-12',
        note: "Complément quadriceps/fessiers. Pieds bas et rapprochés pour insister sur le quadriceps.",
      },
      {
        exerciseId: 'leg-extensions',
        targetSets: 3,
        targetReps: '12-15',
        note: "Isolation quadriceps. Contraction 1s en haut, redescends lentement.",
      },
      {
        exerciseId: 'seated-leg-curl',
        targetSets: 3,
        targetReps: '12-15',
        note: "Ischio-jambiers, isolation assise. Dos droit contre le dossier, amplitude complète.",
      },
      {
        exerciseId: 'thigh-abductor',
        targetSets: 3,
        targetReps: '15-20',
        note: "Fessier moyen, stabilité de hanche. Mouvement contrôlé, pas d'élan.",
      },
      {
        exerciseId: 'thigh-adductor',
        targetSets: 3,
        targetReps: '15-20',
        note: "Adducteurs, équilibre du travail de hanche. Amplitude complète des deux côtés.",
      },
      {
        exerciseId: 'seated-calf-raise',
        targetSets: 3,
        targetReps: '15-20',
        note: "Soléaire (genou fléchi). Amplitude complète, pause en haut.",
      },
    ],
  },
]
