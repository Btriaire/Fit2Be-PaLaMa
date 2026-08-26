// Musique de motivation en fond pendant la séance : tire une piste au
// hasard dans le pool "intense" et enchaîne automatiquement une nouvelle
// piste aléatoire à la fin de chaque morceau, en boucle jusqu'à l'arrêt.

import { useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, SkipForward, X } from 'lucide-react'
import { getRandomWorkoutTrack, type WorkoutMusicTrack } from '../lib/workoutMusic'
import {
  clearWorkoutMediaSession,
  setWorkoutMediaSessionHandlers,
  setWorkoutMediaSessionMetadata,
  setWorkoutPlaybackState,
} from '../lib/audio/mediaSession'

export default function WorkoutMusicPlayer() {
  const [enabled, setEnabled] = useState(false)
  const [track, setTrack] = useState<WorkoutMusicTrack | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function start() {
    setTrack(getRandomWorkoutTrack())
    setEnabled(true)
  }

  function stop() {
    setEnabled(false)
    setTrack(null)
    setIsPlaying(false)
    clearWorkoutMediaSession()
  }

  function nextTrack() {
    setTrack((current) => getRandomWorkoutTrack(current?.id))
  }

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }

  useEffect(() => {
    if (!track) return
    setWorkoutMediaSessionMetadata(track.title, track.author)
    setWorkoutMediaSessionHandlers({
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      next: nextTrack,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id])

  useEffect(() => {
    if (enabled && track) audioRef.current?.play().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track])

  if (!enabled) {
    return (
      <button
        onClick={start}
        className="fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900/90 text-zinc-400 shadow-lg active:bg-zinc-800"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
        aria-label="Activer la musique de motivation"
      >
        <Music size={18} />
      </button>
    )
  }

  return (
    <div
      className="fixed inset-x-3 z-40 flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-950/95 p-2.5 shadow-xl backdrop-blur"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
    >
      {track && (
        <audio
          ref={audioRef}
          src={track.audioUrl}
          autoPlay
          onPlay={() => {
            setIsPlaying(true)
            setWorkoutPlaybackState('playing')
          }}
          onPause={() => {
            setIsPlaying(false)
            setWorkoutPlaybackState('paused')
          }}
          onEnded={nextTrack}
        />
      )}
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
        <Music size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{track?.title}</p>
        <p className="truncate text-[11px] text-zinc-500">Motivation · {track?.author}</p>
      </div>
      <button onClick={togglePlay} className="shrink-0 rounded-full bg-zinc-900 p-2 text-zinc-200 active:bg-zinc-800" aria-label={isPlaying ? 'Pause' : 'Lecture'}>
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button onClick={nextTrack} className="shrink-0 rounded-full bg-zinc-900 p-2 text-zinc-200 active:bg-zinc-800" aria-label="Piste suivante">
        <SkipForward size={16} />
      </button>
      <button onClick={stop} className="shrink-0 rounded-full p-2 text-zinc-500 active:bg-zinc-900" aria-label="Arrêter la musique">
        <X size={16} />
      </button>
    </div>
  )
}
