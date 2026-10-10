# Plan d'amélioration Fit2Be — octobre 2026

Base : inventaire du code (pages, tailles, flux de données) et les parcours
récents (check-in, Activité, Gym, synchro montre). Chaque point a un
statut : **à faire**, **en cours**, **fait**.

## 1. Usability / parcours

| # | Problème observé | Action | Statut |
|---|---|---|---|
| U1 | 4 pages à plus de 500 lignes (Réglages, Accueil, Formulaire sortie, Récup, Gym) : difficiles à faire évoluer | Découper en sections (composants par bloc) | à faire |
| U2 | Le même concept a des noms différents selon l'écran (« Séances 7 j », « Séances »…) | Glossaire unique (`lib/labels.ts`) | à faire |
| U3 | Une correction se fait à plusieurs endroits (sortie, séance, série) | Même patron « Modifier » partout | en partie (sorties, séances, séries faits) |
| U4 | Le check-in est ouvert en permanence tant qu'il n'est pas fait | Réduire à une ligne de résumé après 1 saisie | à faire |
| U5 | Bouton « Ajouter » dupliqué (Accueil, Activité, Gym) | Un seul point d'entrée « + » contextuel | à faire |

## 2. Ergonomie

| # | Problème | Action | Statut |
|---|---|---|---|
| E1 | Curseurs de check-in : texte d'aide tronqué sur une ligne | Jusqu'à 2 lignes, densité conservée | fait |
| E2 | Zones tactiles parfois < 44 px (boutons « Ajouter », chips) | Audit des cibles, minimum 44 px | à faire |
| E3 | Listes longues (volume, historique) | Grilles et groupement par jour, « voir plus » | fait (volume, historique) |
| E4 | Formulaires avec plusieurs onglets | Garder un seul champ mis en avant | à faire |
| E5 | Pas de retour sur « mise à jour en cours » après une modification | Heure du dernier enregistrement affichée en permanence | fait |

## 3. Efficience (performance, données, synchro)

| # | Problème | Action | Statut |
|---|---|---|---|
| F1 | Le journal Activité et l'Accueil relisent toute la base à chaque changement | Requêtes par jour / index IndexedDB | à faire |
| F2 | La synchro tourne à chaque ouverture (Accueil, Endurance, Gym) | Délai minimal commun (déjà en place via `refreshFitData`), à étendre aux pages | en partie |
| F3 | Les calculs (ACWR, monotonie, volume) recalculés à chaque rendu | Mémoïsation et calcul hors rendu | à faire |
| F4 | Restauration VPS : rejouée à chaque lancement connecté | Fusion incrémentale (`updatedAt` depuis la dernière synchro) | à faire |
| F5 | Envois fire-and-forget : une séance peut ne jamais partir si iOS suspend l'app | Renvoi au lancement des enregistrements absents du VPS (`pushMissingToCloud`) | fait (renvoi) ; diagnostic du 1er octobre à confirmer avec l'utilisateur |

## 4. Paramètres

| # | Problème | Action | Statut |
|---|---|---|---|
| P1 | Réglages : 11 sections dans une seule page | Titres par thème ; bloc « Objectifs » séparé de « Entraînement et santé » | en partie (découpage en pages à faire) |
| P2 | Objectif de sommeil, FC repos, zones : réglables mais peu expliqués | Une phrase d'explication sous chaque réglage (repos, FC repos, sommeil) | fait (3 réglages) |
| P3 | Export/import JSON sans aperçu | Afficher le nombre d'éléments avant import | à faire |
| P4 | Pas de réglage de la fréquence de synchro | Option « auto / manuel » | à faire |

## 5. Physio (cohérence des calculs)

| # | Problème | Action | Statut |
|---|---|---|---|
| H1 | Le sommeil sans source Google Fit repose sur un check-in manuel | Afficher explicitement la source et son âge | en partie (badge Google Fit) |
| H2 | La fatigue générale et musculaire pèsent autant que le sommeil dans le score | Revoir les pondérations, les documenter dans la page Référence | à faire |
| H3 | Zones FC : formule Tanaka fixe, pas de correction selon la FC repos mesurée | Proposer Karvonen par défaut quand la FC repos est renseignée | à faire |
| H4 | Calories d'une marche : formule NEAT, pas de réglage de la marche par pas | Recalibrer avec une pesée ou un test | à faire |
| H5 | Score de readiness dépend de données parfois absentes | Afficher « données insuffisantes » plutôt qu'un chiffre | à faire |

## Ordre proposé

1. **F5** (séances non envoyées) : perte de données possible, priorité absolue.
2. **U4, E1, E5** : check-in et feedback, déjà utilisés chaque jour.
3. **P1, P2** : réglages lisibles.
4. **F1, F3** : performance une fois les parcours stabilisés.
5. **H2, H3, H5** : cohérence physio, à valider avec un jugement sur les pondérations.
