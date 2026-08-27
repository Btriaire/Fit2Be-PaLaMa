import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function BackButton({ light = true }: { light?: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      className={`mr-1 flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-medium active:bg-zinc-900 ${
        light ? 'text-white drop-shadow' : 'text-zinc-300'
      }`}
      aria-label="Retour"
    >
      <ArrowLeft size={20} />
    </button>
  )
}
