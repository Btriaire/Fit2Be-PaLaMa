import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'

// Node ≥ 25 expose un localStorage global incomplet qui masque celui de happy-dom.
class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value))
  }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })
Object.defineProperty(globalThis, 'sessionStorage', { value: new MemoryStorage(), configurable: true })

afterEach(() => {
  localStorage.clear()
})
