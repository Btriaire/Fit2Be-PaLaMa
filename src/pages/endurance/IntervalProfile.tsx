import { type EnduranceProgram } from '../../lib/endurancePrograms'
import { INTENSITY_COLOR, programTotalSec } from './enduranceShared'


/** Profil d'intervalles façon appli de fractionné — un bloc par phase, largeur
 * proportionnelle à sa durée, couleur = intensité, curseur = position réelle.
 * Donne une vue d'ensemble du programme (passé/en cours/à venir) qu'un simple
 * % de progression ne montre pas. */
export function IntervalProfile({
  program,
  elapsedSec,
  currentIndex,
  showCursor = true,
}: {
  program: EnduranceProgram
  elapsedSec: number
  currentIndex: number
  showCursor?: boolean
}) {
  const total = programTotalSec(program)
  return (
    <div className="relative mb-2 w-full max-w-sm">
      <div className="flex h-7 w-full overflow-hidden rounded-lg bg-zinc-900">
        {program.phases.map((p, i) => (
          <div
            key={i}
            className="h-full border-r border-black/30 last:border-r-0"
            style={{
              flexGrow: p.durationSec,
              flexBasis: 0,
              backgroundColor: INTENSITY_COLOR[p.intensity],
              opacity: i === currentIndex ? 1 : i < currentIndex ? 0.3 : 0.55,
            }}
          />
        ))}
      </div>
      {showCursor && (
        <div
          className="absolute top-0 h-7 w-0.5 bg-white transition-all"
          style={{ left: `${Math.min(100, (elapsedSec / total) * 100)}%`, boxShadow: '0 0 4px rgba(255,255,255,0.8)' }}
        />
      )}
    </div>
  )
}
