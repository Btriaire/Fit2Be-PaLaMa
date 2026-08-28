import { useNavigate } from 'react-router-dom'
import { ChevronLeft, HelpCircle } from 'lucide-react'
import { INDEX_REFERENCE } from '../lib/indexReference'

export default function ReferencePage() {
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-6 pb-8">
      <header className="mb-2 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <HelpCircle className="text-zinc-300" size={20} />
        <h1 className="text-lg font-semibold tracking-tight">Calculs & index</h1>
      </header>
      <p className="mb-5 px-1 text-xs text-zinc-500">
        Toutes les formules utilisées dans l'app, avec unité, valeurs théoriques usuelles et référence de publication quand elle existe.
      </p>

      {INDEX_REFERENCE.map((cat) => (
        <section key={cat.category} className="mb-6">
          <h2 className="mb-2 text-sm font-medium text-zinc-400">{cat.category}</h2>
          <div className="space-y-2">
            {cat.entries.map((e) => (
              <div key={e.name} className="glass rounded-2xl p-4">
                <p className="text-sm font-semibold text-zinc-100">{e.name}</p>
                <p className="mt-1.5 font-mono text-xs leading-snug text-teal-400">{e.formula}</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 font-medium text-zinc-400">{e.unit}</span>
                  <span>{e.normalRange}</span>
                </div>
                {e.notes && <p className="mt-2 text-[11px] leading-snug text-zinc-500">{e.notes}</p>}
                <p className="mt-2 text-[10px] italic leading-snug text-zinc-600">
                  {e.reference ?? 'Indice composite propre à l\'app — pas de référence de publication externe.'}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
