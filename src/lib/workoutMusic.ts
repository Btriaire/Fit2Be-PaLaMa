// Musique de motivation pour l'entraînement — même principe que le moteur
// musical de Halcyon-PaLaMa (piste réelle CC BY, tirée au hasard, jouée en
// boucle dans la playlist), mais avec un pool exclusivement intense/énergique
// au lieu de zen : rock/électro instrumental orienté sport.

export interface WorkoutMusicTrack {
  id: string
  title: string
  author: string
  license: string
  url: string
  audioUrl: string
  durationSeconds: number
}

export const WORKOUT_MUSIC_TRACKS: WorkoutMusicTrack[] = [
  {
    id: 'rocket',
    title: 'Rocket',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-01-rocket.mp3',
    durationSeconds: 147,
  },
  {
    id: 'hitman',
    title: 'Hitman',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-02-hitman.mp3',
    durationSeconds: 201,
  },
  {
    id: 'killers',
    title: 'Killers',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-03-killers.mp3',
    durationSeconds: 305,
  },
  {
    id: 'wallpaper',
    title: 'Wallpaper',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-04-wallpaper.mp3',
    durationSeconds: 220,
  },
  {
    id: 'hard-boiled',
    title: 'Hard Boiled',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-05-hard-boiled.mp3',
    durationSeconds: 181,
  },
  {
    id: 'volatile-reaction',
    title: 'Volatile Reaction',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-06-volatile-reaction.mp3',
    durationSeconds: 165,
  },
  {
    id: 'hyperfun',
    title: 'Hyperfun',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-07-hyperfun.mp3',
    durationSeconds: 233,
  },
  {
    id: 'cipher2',
    title: 'Cipher2',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-08-cipher2.mp3',
    durationSeconds: 231,
  },
  {
    id: 'aggressor',
    title: 'Aggressor',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-09-aggressor.mp3',
    durationSeconds: 239,
  },
  {
    id: 'ambush',
    title: 'Ambush',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-10-ambush.mp3',
    durationSeconds: 42,
  },
  {
    id: 'exciting-trailer',
    title: 'Exciting Trailer',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-11-exciting-trailer.mp3',
    durationSeconds: 75,
  },
  {
    id: 'call-to-adventure',
    title: 'Call to Adventure',
    author: 'Kevin MacLeod',
    license: 'CC BY 4.0',
    url: 'https://incompetech.com/music/royalty-free/',
    audioUrl: '/audio/workout/workout-12-call-to-adventure.mp3',
    durationSeconds: 247,
  },
]

export function getRandomWorkoutTrack(excludeId?: string): WorkoutMusicTrack {
  const pool = excludeId ? WORKOUT_MUSIC_TRACKS.filter((t) => t.id !== excludeId) : WORKOUT_MUSIC_TRACKS
  const candidates = pool.length > 0 ? pool : WORKOUT_MUSIC_TRACKS
  return candidates[Math.floor(Math.random() * candidates.length)]
}
