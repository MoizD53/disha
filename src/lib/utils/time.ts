export function formatIST(date: string | Date, includeSeconds = false) {
  if (!date) return "";
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {})
  }) + " IST";
}

export function formatTimeOnlyIST(date: string | Date, includeSeconds = true) {
  if (!date) return "";
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {})
  }) + " IST";
}

/**
 * Returns the current date in YYYY-MM-DD format based on Asia/Kolkata (IST) timezone.
 */
export function getTodayIST(): string {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return istFormatter.format(now);
}

/**
 * Calculates start and end Date objects corresponding to 00:00:00.000 and 23:59:59.999
 * in the Asia/Kolkata (+05:30) timezone for a given YYYY-MM-DD string.
 */
export function getISTDayRange(dateStr: string): { startTime: Date; endTime: Date } {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid date format for IST day range: ${dateStr}. Expected YYYY-MM-DD.`);
  }
  const [year, month, day] = parts;
  
  // IST is UTC +05:30.
  // 00:00:00 IST = (UTC 00:00:00) - (5h 30m) = previous day 18:30:00 UTC
  const startUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - (5 * 3600 + 30 * 60) * 1000;
  // 23:59:59.999 IST = (UTC 23:59:59.999) - (5h 30m)
  const endUtcMs = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - (5 * 3600 + 30 * 60) * 1000;
  
  return {
    startTime: new Date(startUtcMs),
    endTime: new Date(endUtcMs),
  };
}
