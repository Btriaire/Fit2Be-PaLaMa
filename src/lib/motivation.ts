// Citations de motivation sportive — pool fixe, une par jour (dérivée de la
// date pour rester stable toute la journée plutôt que de changer à chaque
// rendu), pas d'appel réseau.

export const MOTIVATION_QUOTES: { text: string; author: string }[] = [
  { text: "La douleur que tu ressens aujourd'hui sera la force que tu sentiras demain.", author: 'Arnold Schwarzenegger' },
  { text: "Ce n'est pas ce que tu fais une fois qui compte, mais ce que tu fais jour après jour.", author: 'proverbe' },
  { text: "Le corps atteint ce que l'esprit croit possible.", author: 'inconnu' },
  { text: "Tu n'as pas à être extrême, juste constant.", author: 'inconnu' },
  { text: "La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.", author: 'inconnu' },
  { text: "Chaque séance compte, même celle où tu n'avais pas envie d'y aller.", author: 'inconnu' },
  { text: "La motivation te fait démarrer. L'habitude te fait continuer.", author: 'Jim Ryun' },
  { text: "Un peu, c'est mieux que rien. Rien, c'est ce qui ne te fera jamais progresser.", author: 'inconnu' },
  { text: "Le seul entraînement que tu regrettes, c'est celui que tu n'as pas fait.", author: 'inconnu' },
  { text: "Ton corps peut le supporter. C'est ton mental qu'il faut convaincre.", author: 'inconnu' },
  { text: "Les excuses ne brûlent pas de calories.", author: 'inconnu' },
  { text: "Deviens un peu meilleur chaque jour, pas parfait en un jour.", author: 'inconnu' },
  { text: "La fatigue d'aujourd'hui est la preuve de l'effort d'aujourd'hui.", author: 'inconnu' },
  { text: "On ne regrette jamais une bonne séance. On regrette celles qu'on a sautées.", author: 'inconnu' },
  { text: "Sois plus fort que ta meilleure excuse.", author: 'inconnu' },
  { text: "Le progrès, c'est du courage tous les jours, pas de la perfection.", author: 'inconnu' },
  { text: "Ce que tu fais aujourd'hui peut améliorer tous tes lendemains.", author: 'inconnu' },
  { text: "La seule mauvaise séance est celle qui n'a pas eu lieu.", author: 'inconnu' },
  { text: "Pousse-toi, parce que personne d'autre ne le fera pour toi.", author: 'inconnu' },
  { text: "Petit à petit, l'oiseau fait son nid — et le corps se transforme.", author: 'inconnu' },
]

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86_400_000)
}

/** Une citation stable pour toute la journée (change à minuit). */
export function getQuoteOfTheDay(): { text: string; author: string } {
  const idx = dayOfYear(new Date()) % MOTIVATION_QUOTES.length
  return MOTIVATION_QUOTES[idx]
}
