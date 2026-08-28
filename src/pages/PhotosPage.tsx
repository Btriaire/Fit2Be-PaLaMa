import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ImageIcon, Trash2, X, ChevronRight as ChevronRightIcon, SplitSquareHorizontal } from 'lucide-react'
import { getAllDailyPhotos, deleteDailyPhoto } from '../lib/dailyPhoto'
import { formatFullDate } from '../lib/date'
import type { DailyPhoto } from '../types'

export default function PhotosPage() {
  const navigate = useNavigate()
  const [photos, setPhotos] = useState<DailyPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [sliderPct, setSliderPct] = useState(50)

  useEffect(() => {
    getAllDailyPhotos().then((p) => {
      setPhotos(p)
      setLoading(false)
    })
  }, [])

  async function removePhoto(id: string) {
    if (!confirm('Supprimer cette photo ?')) return
    await deleteDailyPhoto(id)
    setPhotos((prev) => prev.filter((p) => p.id !== id))
    setViewerIndex(null)
  }

  // Photos triées du plus récent au plus ancien — la comparaison se fait
  // toujours contre la toute première photo enregistrée (la référence de
  // départ), c'est l'usage naturel d'un suivi de progression physique.
  const oldest = photos[photos.length - 1]
  const current = viewerIndex != null ? photos[viewerIndex] : null

  return (
    <div className="px-4 pt-4">
      <header className="mb-4 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 active:bg-zinc-900">
          <ChevronLeft size={22} />
        </button>
        <ImageIcon className="text-zinc-300" size={20} />
        <h1 className="text-lg font-semibold tracking-tight">Photos</h1>
      </header>

      {loading && <p className="px-1 text-sm text-zinc-500">Chargement…</p>}

      {!loading && photos.length === 0 && (
        <p className="px-1 text-sm text-zinc-500">
          Aucune photo enregistrée pour l'instant — prends ta première "Photo du jour" depuis l'accueil.
        </p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => {
                setViewerIndex(i)
                setCompareMode(false)
              }}
              className="relative aspect-square overflow-hidden rounded-lg bg-zinc-900"
            >
              <img src={p.dataUrl} alt={p.date} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 text-[9px] text-zinc-200">
                {formatFullDate(p.date)}
              </span>
            </button>
          ))}
        </div>
      )}

      {current && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black" onClick={() => setViewerIndex(null)}>
          <div className="flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+16px)]" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setViewerIndex(null)} className="rounded-full p-1.5 text-white active:bg-white/10">
              <X size={22} />
            </button>
            <p className="text-sm font-medium text-white">{formatFullDate(current.date)}</p>
            <div className="flex items-center gap-1">
              {oldest && oldest.id !== current.id && (
                <button
                  onClick={() => setCompareMode((v) => !v)}
                  className={`rounded-full p-2 active:bg-white/10 ${compareMode ? 'text-orange-400' : 'text-white'}`}
                  aria-label="Comparer avec la première photo"
                >
                  <SplitSquareHorizontal size={20} />
                </button>
              )}
              <button onClick={() => removePhoto(current.id)} className="rounded-full p-2 text-white active:bg-white/10" aria-label="Supprimer">
                <Trash2 size={20} />
              </button>
            </div>
          </div>

          <div className="relative flex-1" onClick={(e) => e.stopPropagation()}>
            {compareMode && oldest ? (
              <div
                className="relative h-full w-full touch-none select-none"
                onPointerDown={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  const move = (clientX: number) => setSliderPct(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
                  move(e.clientX)
                  function onMove(ev: PointerEvent) {
                    move(ev.clientX)
                  }
                  function onUp() {
                    window.removeEventListener('pointermove', onMove)
                    window.removeEventListener('pointerup', onUp)
                  }
                  window.addEventListener('pointermove', onMove)
                  window.addEventListener('pointerup', onUp)
                }}
              >
                <img src={oldest.dataUrl} alt={oldest.date} className="absolute inset-0 h-full w-full object-contain" />
                <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}>
                  <img src={current.dataUrl} alt={current.date} className="h-full w-full object-contain" />
                </div>
                <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${sliderPct}%` }} />
                <div
                  className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-zinc-950"
                  style={{ left: `${sliderPct}%` }}
                >
                  <SplitSquareHorizontal size={14} />
                </div>
                <p className="absolute left-2 top-2 rounded bg-black/50 px-2 py-1 text-[10px] text-zinc-200">{formatFullDate(oldest.date)}</p>
                <p className="absolute right-2 top-2 rounded bg-black/50 px-2 py-1 text-[10px] text-zinc-200">{formatFullDate(current.date)}</p>
              </div>
            ) : (
              <img src={current.dataUrl} alt={current.date} className="h-full w-full object-contain" />
            )}

            {!compareMode && viewerIndex! < photos.length - 1 && (
              <button
                onClick={() => setViewerIndex((i) => (i != null ? i + 1 : i))}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white active:bg-black/60"
                aria-label="Photo précédente"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {!compareMode && viewerIndex! > 0 && (
              <button
                onClick={() => setViewerIndex((i) => (i != null ? i - 1 : i))}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white active:bg-black/60"
                aria-label="Photo suivante"
              >
                <ChevronRightIcon size={22} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
