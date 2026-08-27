// Photos réelles par activité (CC BY/CC0, Wikimedia Commons + Openverse/Flickr),
// une par id de MET_ACTIVITIES — mêmes dimensions/traitement que les
// vignettes d'exercice des templates (carré, recadré, compressé).
const modules = import.meta.glob('../assets/activities/*.jpg', { eager: true, import: 'default' }) as Record<string, string>

export const ACTIVITY_PHOTOS: Record<string, string> = {}
for (const path in modules) {
  const id = path.split('/').pop()!.replace('.jpg', '')
  ACTIVITY_PHOTOS[id] = modules[path]
}
