type Entry<T> = { value: T; expiresAt: number }

class TtlCache {
  private store = new Map<string, Entry<unknown>>()

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  delete(key: string) {
    this.store.delete(key)
  }

  invalidatePrefix(prefix: string) {
    Array.from(this.store.keys()).forEach((k) => {
      if (k.startsWith(prefix)) this.store.delete(k)
    })
  }

  wrap<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== undefined) return Promise.resolve(cached)
    return fn().then((value) => {
      this.set(key, value, ttlMs)
      return value
    })
  }
}

export const cache = new TtlCache()
