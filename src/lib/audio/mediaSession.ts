// Contrôles écran verrouillé / centre de contrôle pour la playlist
// d'entraînement — même principe que Halcyon-PaLaMa mais sans seek (une
// playlist qui boucle n'a pas de position à retenir, juste play/pause/next).

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator
}

export function setWorkoutMediaSessionMetadata(title: string, artist: string) {
  if (!isSupported()) return
  navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Fit2Be-PaLaMa' })
}

export function setWorkoutMediaSessionHandlers(handlers: { play: () => void; pause: () => void; next: () => void }) {
  if (!isSupported()) return
  navigator.mediaSession.setActionHandler('play', handlers.play)
  navigator.mediaSession.setActionHandler('pause', handlers.pause)
  navigator.mediaSession.setActionHandler('nexttrack', handlers.next)
}

export function setWorkoutPlaybackState(state: 'playing' | 'paused') {
  if (!isSupported()) return
  navigator.mediaSession.playbackState = state
}

export function clearWorkoutMediaSession() {
  if (!isSupported()) return
  navigator.mediaSession.setActionHandler('play', null)
  navigator.mediaSession.setActionHandler('pause', null)
  navigator.mediaSession.setActionHandler('nexttrack', null)
}
