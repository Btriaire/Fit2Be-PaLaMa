// Fuseau fixe : les bugs de date se voient entre 0 h et 2 h heure de Paris (UTC+1/+2).
export function setup() {
  process.env.TZ = 'Europe/Paris'
}
