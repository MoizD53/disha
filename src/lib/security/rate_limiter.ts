// Simple in-memory rate limiter for MVP purposes
// In a distributed production environment, use Redis or similar.

interface RateLimitInfo {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitInfo>();

export function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const record = store.get(ip);

  if (!record) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (now > record.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

export function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, record] of store.entries()) {
    if (now > record.resetAt) {
      store.delete(ip);
    }
  }
}

// Automatically clean up occasionally without blocking process exit
if (typeof setInterval !== "undefined") {
  const interval = setInterval(cleanupRateLimits, 60000);
  if (interval && typeof interval.unref === "function") {
    interval.unref();
  }
}
