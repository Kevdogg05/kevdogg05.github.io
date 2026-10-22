import { describe, expect, it } from "vitest";
import { PinLimiter } from "@/server/auth/rate-limit";

describe("PinLimiter", () => {
  it("locks a client out after 5 wrong PINs, doubling each time", () => {
    const limiter = new PinLimiter();
    let now = 0;
    for (let i = 0; i < 4; i++) limiter.recordFailure("kid-tablet", now);
    expect(limiter.retryAfter("kid-tablet", now)).toBe(0);

    limiter.recordFailure("kid-tablet", now);
    expect(limiter.retryAfter("kid-tablet", now)).toBe(60_000);
    expect(limiter.retryAfter("other-device", now)).toBe(0);

    now += 60_000;
    expect(limiter.retryAfter("kid-tablet", now)).toBe(0);
    for (let i = 0; i < 5; i++) limiter.recordFailure("kid-tablet", now);
    expect(limiter.retryAfter("kid-tablet", now)).toBe(120_000);
  });

  it("forgets a client's failures after a correct PIN", () => {
    const limiter = new PinLimiter();
    for (let i = 0; i < 4; i++) limiter.recordFailure("phone", 0);
    limiter.recordSuccess("phone");
    limiter.recordFailure("phone", 0);
    expect(limiter.retryAfter("phone", 0)).toBe(0);
  });

  it("locks the PIN pad for everyone after too many failures overall", () => {
    const limiter = new PinLimiter({ globalAttempts: 20 });
    // A guesser rotating forged client identities never trips the per-client limit...
    for (let i = 0; i < 19; i++) limiter.recordFailure(`forged-${i}`, 1_000);
    expect(limiter.retryAfter("anyone", 1_000)).toBe(0);
    // ...but the household-wide cap still stops them.
    limiter.recordFailure("forged-19", 1_000);
    expect(limiter.retryAfter("anyone", 1_000)).toBe(15 * 60_000);
  });

  it("only counts failures inside the global window", () => {
    const limiter = new PinLimiter({ globalAttempts: 3, globalWindowMs: 1_000 });
    limiter.recordFailure("a", 0);
    limiter.recordFailure("b", 500);
    limiter.recordFailure("c", 1_600); // the first failure has aged out
    expect(limiter.retryAfter("d", 1_600)).toBe(0);
  });
});
