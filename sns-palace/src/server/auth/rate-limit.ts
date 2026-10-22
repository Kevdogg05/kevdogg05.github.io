// Brute-force protection for the PIN pad.
//
// Two layers, both in memory (SnS Palace runs as one server process):
// - per client: 5 wrong PINs locks that client out for 1 minute, doubling on
//   every further lockout up to an hour;
// - household-wide: 20 wrong PINs in 15 minutes from anywhere locks the PIN pad
//   for 15 minutes. The client key comes from X-Forwarded-For, which a client
//   can forge, so this global cap is what actually bounds guessing.

export interface PinLimiterOptions {
  perClientAttempts: number;
  baseLockoutMs: number;
  maxLockoutMs: number;
  globalAttempts: number;
  globalWindowMs: number;
  globalLockoutMs: number;
}

const DEFAULTS: PinLimiterOptions = {
  perClientAttempts: 5,
  baseLockoutMs: 60_000,
  maxLockoutMs: 60 * 60_000,
  globalAttempts: 20,
  globalWindowMs: 15 * 60_000,
  globalLockoutMs: 15 * 60_000,
};

interface ClientState {
  failures: number;
  lockouts: number;
  lockedUntil: number;
  lastFailure: number;
}

export class PinLimiter {
  private readonly options: PinLimiterOptions;
  private readonly clients = new Map<string, ClientState>();
  private globalFailures: number[] = [];
  private globalLockedUntil = 0;

  constructor(options: Partial<PinLimiterOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  /** Milliseconds the client must wait before trying again; 0 if it may try now. */
  retryAfter(client: string, now = Date.now()): number {
    const clientWait = (this.clients.get(client)?.lockedUntil ?? 0) - now;
    return Math.max(0, clientWait, this.globalLockedUntil - now);
  }

  recordFailure(client: string, now = Date.now()): void {
    const o = this.options;
    const state = this.clients.get(client) ?? { failures: 0, lockouts: 0, lockedUntil: 0, lastFailure: 0 };
    // A client that behaved for a long while starts over.
    if (now - state.lastFailure > o.maxLockoutMs) {
      state.failures = 0;
      state.lockouts = 0;
    }
    state.failures += 1;
    state.lastFailure = now;
    if (state.failures >= o.perClientAttempts) {
      state.lockedUntil = now + Math.min(o.baseLockoutMs * 2 ** state.lockouts, o.maxLockoutMs);
      state.lockouts += 1;
      state.failures = 0;
    }
    this.clients.set(client, state);

    this.globalFailures = this.globalFailures.filter((at) => now - at < o.globalWindowMs);
    this.globalFailures.push(now);
    if (this.globalFailures.length >= o.globalAttempts) {
      this.globalLockedUntil = now + o.globalLockoutMs;
      this.globalFailures = [];
    }
    this.prune(now);
  }

  recordSuccess(client: string): void {
    this.clients.delete(client);
  }

  private prune(now: number): void {
    if (this.clients.size < 1000) return;
    for (const [key, state] of this.clients) {
      if (state.lockedUntil < now && now - state.lastFailure > this.options.maxLockoutMs) {
        this.clients.delete(key);
      }
    }
  }
}

// One limiter per server process, kept on globalThis so dev hot reloads reuse it.
const globalForLimiter = globalThis as typeof globalThis & { __snsPalacePinLimiter?: PinLimiter };
export const pinLimiter = (globalForLimiter.__snsPalacePinLimiter ??= new PinLimiter());
