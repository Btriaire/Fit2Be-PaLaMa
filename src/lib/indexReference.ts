// Table de référence de tous les calculs/index affichés dans l'app — sert la
// page "?" (ReferencePage) pour que chaque chiffre affiché soit traçable à sa
// formule, son unité et sa source. Un `reference: null` signifie que c'est un
// indice "maison" (composite propre à l'app), pas une formule publiée — on ne
// invente jamais de citation pour un calcul qui n'en a pas.

export interface ReferenceEntry {
  name: string
  formula: string
  unit: string
  normalRange: string
  reference: string | null
  notes?: string
}

export interface ReferenceCategory {
  category: string
  entries: ReferenceEntry[]
}

export const INDEX_REFERENCE: ReferenceCategory[] = [
  {
    category: 'Métabolisme & calories',
    entries: [
      {
        name: 'Métabolisme de base (BMR)',
        formula: '10×poids(kg) + 6.25×taille(cm) − 5×âge + (5 homme / −161 femme)',
        unit: 'kcal/jour',
        normalRange: '≈1400-1800 (femme) · ≈1600-2100 (homme), selon poids/taille/âge',
        reference: 'Mifflin MD, St Jeor ST, et al. Am J Clin Nutr. 1990;51(2):241-247.',
      },
      {
        name: 'Calories d\'activité (MET)',
        formula: 'kcal = MET × poids(kg) × durée(h) × (0.95 si femme)',
        unit: 'kcal',
        normalRange: 'MET repos=1 · marche≈3.5 · musculation≈5.5 · course≈10',
        reference: 'Ainsworth BE, et al. "2011 Compendium of Physical Activities." Med Sci Sports Exerc. 2011;43(8):1575-1581.',
      },
      {
        name: 'Calories via fréquence cardiaque',
        formula: 'Régression FC/poids/âge/sexe (Keytel) — valide seulement si FC moyenne ≥ 90 bpm',
        unit: 'kcal',
        normalRange: 'n/a — dépend de la FC et de la durée',
        reference: 'Keytel LR, Goedecke JH, et al. J Sports Sci. 2005;23(3):289-297.',
        notes: 'Utilisée en priorité sur le MET quand une FC moyenne mesurée est disponible (endurance, gym avec FC mesurée pendant les repos).',
      },
      {
        name: 'Majoration EPOC (musculation)',
        formula: '+10% sur l\'estimation MET',
        unit: '%',
        normalRange: 'n/a',
        reference: 'Schuenke MD, Mikat RP, McBride JM. Eur J Appl Physiol. 2002;86(5):411-417.',
        notes: 'Compense la surconsommation d\'oxygène post-effort (EPOC), significative en musculation et absente d\'un simple MET×durée.',
      },
      {
        name: 'Calories de marche (net du BMR)',
        formula: 'MET marche(4.3) × poids × durée − (BMR journalier × durée / 1440)',
        unit: 'kcal',
        normalRange: 'n/a — dépend du poids et de la durée de marche',
        reference: null,
        notes:
          "La formule MET donne une dépense brute qui inclut la part déjà comptée par le métabolisme de base — négligeable sur une séance courte, mais notable sur une marche de plusieurs heures (randonnée, journée de marche). On retire cette part uniquement pour la marche.",
      },
      {
        name: 'NEAT (calories des pas)',
        formula: '0.0005 × pas × poids(kg)',
        unit: 'kcal',
        normalRange: '≈350 kcal pour 10 000 pas chez un adulte de 70 kg',
        reference: null,
        notes: 'Approximation d\'usage courant en coaching sportif — pas de publication unique de référence.',
      },
    ],
  },
  {
    category: 'Cardio & effort',
    entries: [
      {
        name: 'Fréquence cardiaque maximale',
        formula: '220 − âge',
        unit: 'bpm',
        normalRange: 'ex : 190 bpm à 30 ans',
        reference: 'Fox SM, Naughton JP, Haskell WL. Ann Clin Res. 1971;3(6):404-432.',
        notes: 'Précision ±10-12 bpm selon les individus — remplacée par le pic mesuré sur machine si disponible et plausible.',
      },
      {
        name: 'Zones de fréquence cardiaque',
        formula: '% de la FC max — Z1 50-60% · Z2 60-70% · Z3 70-80% · Z4 80-90% · Z5 90-100%',
        unit: '% FCmax',
        normalRange: 'Z2 = zone "endurance fondamentale"',
        reference: null,
        notes: 'Modèle de zonage standard en sciences du sport, sans papier fondateur unique.',
      },
      {
        name: 'VO2max estimé',
        formula: '15.3 × (FCmax / FCrepos)',
        unit: 'ml/kg/min',
        normalRange: 'Sédentaire ≈35-40 · Entraîné ≈45-55 · Athlète >55',
        reference: 'Uth N, Sørensen H, Overgaard K, Pedersen PK. Eur J Appl Physiol. 2004;91(1):111-115.',
        notes: 'FC repos résolue par priorité NutriTracker (mesure réelle) > FC mesurée en app > valeur saisie en Réglages.',
      },
      {
        name: 'FC de récupération (HRR)',
        formula: 'FC à la fin de l\'effort − FC 1 minute après',
        unit: 'bpm',
        normalRange: '≥12 bpm = récupération normale · <12 bpm = à surveiller',
        reference: 'Cole CR, Blackstone EH, Pashkow FJ, Snader CE, Lauer MS. N Engl J Med. 1999;341(18):1351-1357.',
        notes: 'Importée d\'une capture d\'écran Apple Health/Google Fit ("Fréquence cardiaque après exercice") — l\'app n\'a pas de capteur FC continu propre.',
      },
      {
        name: 'Polarisation cardio',
        formula: '% de temps passé en Z1-2 (facile) / Z3 (modéré) / Z4-5 (dur) sur 28 jours',
        unit: '%',
        normalRange: 'Modèle "polarisé" recommandé ≈80% facile / 20% dur, peu de Z3',
        reference: 'Seiler S. Int J Sports Physiol Perform. 2010;5(3):276-291.',
      },
    ],
  },
  {
    category: 'Récupération & charge d\'entraînement',
    entries: [
      {
        name: 'Charge d\'entraînement (session-RPE)',
        formula: 'RPE ressenti (0-10) × durée de la séance (min)',
        unit: 'points (u.a.)',
        normalRange: 'Légère <150 · Modérée 150-300 · Importante 300-450 · Intense >450 (par jour)',
        reference: 'Foster C. Med Sci Sports Exerc. 1998;30(7):1164-1168. — Foster C, et al. J Strength Cond Res. 2001;15(1):109-115.',
      },
      {
        name: 'ACWR (charge aiguë:chronique)',
        formula: 'Charge moyenne des 7 derniers jours ÷ charge moyenne des 28 derniers jours',
        unit: 'ratio',
        normalRange: 'Zone saine 0.8-1.3 · à surveiller 1.3-1.5 · risque élevé >1.5',
        reference: 'Gabbett TJ. Br J Sports Med. 2016;50(5):273-280.',
      },
      {
        name: 'Monotonie & contrainte',
        formula: 'Monotonie = charge moyenne / écart-type (7j) · Contrainte = charge hebdo × monotonie',
        unit: 'u.a.',
        normalRange: 'Risque élevé si monotonie >2 et contrainte >6000',
        reference: 'Foster C. Med Sci Sports Exerc. 1998;30(7):1164-1168. — Foster C, et al. J Strength Cond Res. 2001;15(1):109-115.',
        notes: 'Facteur de risque indépendant de l\'ACWR : une charge répétée sans variation jour après jour, même raisonnable en volume total.',
      },
      {
        name: 'Body Battery / score subjectif',
        formula: '(sommeil + motivation + (6−fatigue) + (6−stress)) / 20 × 100, moins la pénalité de charge du jour',
        unit: 'score 0-100',
        normalRange: '>70 bonne récupération · <40 récupération insuffisante',
        reference: null,
        notes: 'Indice composite propre à l\'app (inspiré de concepts commerciaux type Garmin Body Battery / Whoop Recovery, formule propre, non publiée).',
      },
      {
        name: 'Score de readiness',
        formula: '35% charge de la veille + 35% sommeil (si connu) + 30% ressenti subjectif',
        unit: 'score 0-100',
        normalRange: '>70 prêt à performer · <40 privilégier repos/séance légère',
        reference: null,
        notes: 'Indice composite propre à l\'app, distinct du Body Battery (qui inclut le check-in du jour même).',
      },
    ],
  },
  {
    category: 'Composition corporelle',
    entries: [
      {
        name: 'IMC (indice de masse corporelle)',
        formula: 'poids(kg) / taille(m)²',
        unit: 'kg/m²',
        normalRange: '<18.5 insuffisance pondérale · 18.5-24.9 normal · 25-29.9 surpoids · ≥30 obésité',
        reference: 'Organisation mondiale de la santé — WHO Technical Report Series 894, 2000.',
      },
      {
        name: 'Masse grasse estimée',
        formula: '1.2×IMC + 0.23×âge − 10.8×(1 si homme, 0 si femme) − 5.4',
        unit: '%',
        normalRange: 'Sain : ≈10-20% (homme) · ≈18-28% (femme)',
        reference: 'Deurenberg P, Weststrate JA, Seidell JC. Br J Nutr. 1991;65(2):105-114.',
      },
      {
        name: 'Masse maigre',
        formula: 'poids(kg) × (1 − %masse grasse)',
        unit: 'kg',
        normalRange: 'n/a — dépend du poids et de la masse grasse',
        reference: 'Deurenberg P, Weststrate JA, Seidell JC. Br J Nutr. 1991;65(2):105-114.',
        notes: 'Dérivée de la masse grasse estimée ci-dessus.',
      },
      {
        name: 'Surface corporelle (BSA)',
        formula: '√(taille(cm) × poids(kg) / 3600)',
        unit: 'm²',
        normalRange: '≈1.6-1.9 m² (femme) · ≈1.7-2.1 m² (homme)',
        reference: 'Mosteller RD. N Engl J Med. 1987;317(17):1098.',
        notes: 'Formule simplifiée, aussi fiable que Du Bois & Du Bois (1916) en usage courant — normalise certaines mesures physiologiques à la taille du corps plutôt qu\'au seul poids.',
      },
    ],
  },
  {
    category: 'Progression & régularité',
    entries: [
      {
        name: 'Indice général',
        formula: '40% index musculaire + 40% index cardiaque + 20% régularité',
        unit: 'score 0-100',
        normalRange: '50 = stable · >50 en progression · <50 en recul',
        reference: null,
        notes: 'Indice composite propre à l\'app, basé sur la comparaison d\'une fenêtre récente à une fenêtre ancienne (pas de "norme" externe).',
      },
      {
        name: 'Indice de diversité',
        formula: 'Entropie de Shannon normalisée sur les minutes gym/endurance/activités/marche',
        unit: 'score 0-100',
        normalRange: '100 = temps réparti également entre les 4 modules · 0 = un seul module',
        reference: 'Shannon CE. Bell Syst Tech J. 1948;27(3):379-423.',
        notes: 'Concept mathématique général (théorie de l\'information), appliqué ici à la répartition du temps d\'activité — pas une norme sportive.',
      },
      {
        name: 'Taux de PR',
        formula: 'Records personnels ÷ nombre total de séries',
        unit: '%',
        normalRange: 'n/a — dépend du niveau et de l\'ancienneté d\'entraînement',
        reference: null,
      },
    ],
  },
]
