import { Dumbbell, Footprints, HeartPulse, Apple } from 'lucide-react'

const MODULES = [
  { icon: Dumbbell, label: 'Gym', color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { icon: Footprints, label: 'Activités', color: 'text-teal-400', bg: 'bg-teal-500/10' },
  { icon: HeartPulse, label: 'Récup', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  { icon: Apple, label: 'Nutrition', color: 'text-teal-400', bg: 'bg-teal-500/10' },
]

export default function CoverPage({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-between overflow-hidden bg-zinc-950 px-6 py-10 text-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-40"
        style={{
          background:
            'radial-gradient(60% 50% at 50% 0%, rgba(249,115,22,0.25), rgba(45,212,191,0.12) 55%, transparent 75%)',
        }}
      />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-teal-500 shadow-[0_0_40px_rgba(249,115,22,0.35)]">
          <Dumbbell size={36} className="text-zinc-950" strokeWidth={2.4} />
        </div>

        <h1 className="mb-2 text-4xl font-extrabold tracking-tight text-zinc-50">VibeFit</h1>
        <p className="mb-10 max-w-xs text-sm leading-relaxed text-zinc-400">
          Ton carnet de gym, tes activités du quotidien, ta récupération et ta nutrition — tout en un,
          <span className="text-zinc-300"> 100% local sur ton téléphone</span>.
        </p>

        <div className="mb-2 grid grid-cols-4 gap-3">
          {MODULES.map(({ icon: Icon, label, color, bg }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${bg}`}>
                <Icon size={20} className={color} />
              </div>
              <span className="text-[11px] text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-xs">
        <button
          onClick={onEnter}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 py-4 text-base font-semibold text-zinc-950 shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
        >
          Commencer
        </button>
        <p className="mt-3 text-[11px] text-zinc-600">Aucune donnée envoyée sur internet — tout reste sur cet appareil.</p>
      </div>
    </div>
  )
}
