import rateLimit from "express-rate-limit";

// Brute-force protection for login: a handful of attempts per IP+window,
// then a cooldown. Keyed by IP (default) since login has no authenticated
// user yet. Successful logins don't reset the counter — an attacker who
// eventually finds valid creds shouldn't get unlimited further attempts.
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in a few minutes." },
});

// Looser limiter for registration/password-reset-request endpoints: still
// guards against automated account-creation or email-enumeration abuse
// without punishing normal signup traffic.
export const authActionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});
