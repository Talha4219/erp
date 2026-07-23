// Generic circuit breaker with per-call timeout, concurrency limit, failure
// counting, half-open probing, and optional fallback.
//
// Usage:
//   const cb = new CircuitBreaker({ name: 'stripe', timeout: 10_000, maxConcurrent: 3 })
//   await cb.call(() => stripe.paymentIntents.retrieve(id))
//   await cb.call(() => stripe.paymentIntents.retrieve(id), () => cachedResult)

interface CircuitBreakerConfig {
  name: string
  /** Number of consecutive failures before opening the circuit (default 5) */
  failureThreshold?: number
  /** Milliseconds to stay open before transitioning to half-open (default 30s) */
  cooldownPeriod?: number
  /** Per-call timeout in milliseconds (default 10s) */
  timeout?: number
  /** Max concurrent in-flight requests (default 5) */
  maxConcurrent?: number
  /** Max probe requests in half-open state before closing (default 1) */
  halfOpenMaxRequests?: number
  /** Optional callback for monitoring events */
  onStateChange?: (name: string, from: string, to: string) => void
}

type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

export class CircuitBreaker {
  private state: State = 'CLOSED'
  private failureCount = 0
  private lastFailureTime = 0
  private activeCount = 0
  private halfOpenProbeCount = 0

  private readonly cfg: Required<CircuitBreakerConfig>

  constructor(config: CircuitBreakerConfig) {
    this.cfg = {
      failureThreshold: 5,
      cooldownPeriod: 30_000,
      timeout: 10_000,
      maxConcurrent: 5,
      halfOpenMaxRequests: 1,
      onStateChange: () => {},
      ...config,
    }
  }

  /** Expose current state for monitoring / health endpoints */
  getState(): State { return this.state }

  getStats() {
    return {
      name: this.cfg.name,
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.cfg.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      activeCount: this.activeCount,
      maxConcurrent: this.cfg.maxConcurrent,
    }
  }

  /** Reset to healthy (useful after a manual intervention) */
  reset(): void {
    this.state = 'CLOSED'
    this.failureCount = 0
    this.halfOpenProbeCount = 0
  }

  /** Force the circuit open (e.g. known outage) */
  forceOpen(): void {
    this.transitionTo('OPEN')
  }

  /**
   * Execute `fn` through the circuit breaker.
   * If the circuit is OPEN, rejects immediately with an error unless a
   * `fallback` is provided, in which case the fallback is called instead.
   */
  async call<T>(fn: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // ── State check ──────────────────────────────────────────────────
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.cfg.cooldownPeriod) {
        this.transitionTo('HALF_OPEN')
        this.halfOpenProbeCount = 0
      } else {
        return this.rejectOrFallback(fallback, 'circuit open')
      }
    }

    // ── Concurrency check ────────────────────────────────────────────
    if (this.activeCount >= this.cfg.maxConcurrent) {
      return this.rejectOrFallback(fallback, 'concurrency limit reached')
    }

    // ── Half-open probe limit ────────────────────────────────────────
    if (this.state === 'HALF_OPEN' && this.halfOpenProbeCount >= this.cfg.halfOpenMaxRequests) {
      return this.rejectOrFallback(fallback, 'half-open probe limit')
    }

    // ── Execute ──────────────────────────────────────────────────────
    this.activeCount++
    if (this.state === 'HALF_OPEN') this.halfOpenProbeCount++

    try {
      const result = await this.executeWithTimeout(fn)
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    } finally {
      this.activeCount--
    }
  }

  // ── Private helpers ────────────────────────────────────────────────

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const { timeout, name } = this.cfg
    let timer: ReturnType<typeof setTimeout> | undefined

    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${name}: request timed out after ${timeout}ms`))
      }, timeout)
    })

    try {
      const result = await Promise.race([fn(), timeoutPromise])
      return result
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      // First successful probe closes the circuit
      this.transitionTo('CLOSED')
      this.failureCount = 0
      this.halfOpenProbeCount = 0
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.cfg.failureThreshold) {
      this.transitionTo('OPEN')
    }
  }

  private rejectOrFallback<T>(fallback: (() => Promise<T>) | undefined, reason: string): Promise<T> {
    if (fallback) return fallback()
    return Promise.reject(new Error(`${this.cfg.name}: ${reason}`))
  }

  private transitionTo(newState: State): void {
    const prev = this.state
    if (prev === newState) return
    this.state = newState
    this.cfg.onStateChange(this.cfg.name, prev, newState)
  }
}
