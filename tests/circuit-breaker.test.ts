import { CircuitBreaker } from '@/lib/circuit-breaker'

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 2,
      cooldownPeriod: 200,
      timeout: 100,
      maxConcurrent: 5,
      halfOpenMaxRequests: 1,
    })
  })

  it('passes through successful calls', async () => {
    const result = await cb.call(() => Promise.resolve('ok'))
    expect(result).toBe('ok')
    expect(cb.getState()).toBe('CLOSED')
  })

  it('opens after threshold failures', async () => {
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('CLOSED') // only 1 failure

    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('OPEN')
  })

  it('fast-fails when circuit is open', async () => {
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('OPEN')

    await expect(cb.call(() => Promise.resolve('should not reach')))
      .rejects.toThrow(/circuit open/)
  })

  it('calls fallback when circuit is open', async () => {
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('OPEN')

    const result = await cb.call(
      () => Promise.reject(new Error('no')),
      () => Promise.resolve('fallback')
    )
    expect(result).toBe('fallback')
  })

  it('rejects on timeout', async () => {
    await expect(cb.call(() => sleep(500))).rejects.toThrow(/timed out/)
  })

  it('rejects when concurrency limit is exceeded', async () => {
    const tight = new CircuitBreaker({
      name: 'concurrency',
      failureThreshold: 5,
      timeout: 500,
      maxConcurrent: 1,
    })

    // First call holds the slot
    const slow = tight.call(() => sleep(200))
    await sleep(10) // let the first call start

    // Second call should hit the concurrency limit
    await expect(tight.call(() => Promise.resolve('x')))
      .rejects.toThrow(/concurrency limit/)
    await slow
  })

  it('transitions HALF_OPEN → CLOSED on successful probe', async () => {
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('OPEN')

    // Wait for cooldown
    await sleep(250)

    // First call is a probe — should succeed and close
    const result = await cb.call(() => Promise.resolve('probe'))
    expect(result).toBe('probe')
    expect(cb.getState()).toBe('CLOSED')
  })

  it('transitions HALF_OPEN → OPEN on failed probe', async () => {
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('OPEN')

    // Wait for cooldown
    await sleep(250)

    // First call is a probe — fails, goes back to OPEN
    await expect(cb.call(() => Promise.reject(new Error('probe fail'))))
      .rejects.toThrow(/probe fail/)
    expect(cb.getState()).toBe('OPEN')
  })

  it('fires onStateChange callback', async () => {
    const transitions: string[] = []
    const monitored = new CircuitBreaker({
      name: 'monitored',
      failureThreshold: 1,
      cooldownPeriod: 50,
      timeout: 100,
      maxConcurrent: 5,
      onStateChange: (name, from, to) => transitions.push(`${from}→${to}`),
    })

    await monitored.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(transitions).toContain('CLOSED→OPEN')

    await sleep(60)
    await monitored.call(() => Promise.resolve('ok')).catch(() => {})
    expect(transitions).toContain('OPEN→HALF_OPEN')
    expect(transitions).toContain('HALF_OPEN→CLOSED')
  })

  it('reset() returns to CLOSED', async () => {
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    await cb.call(() => Promise.reject(new Error('fail'))).catch(() => {})
    expect(cb.getState()).toBe('OPEN')
    cb.reset()
    expect(cb.getState()).toBe('CLOSED')
    const result = await cb.call(() => Promise.resolve('works'))
    expect(result).toBe('works')
  })
})
