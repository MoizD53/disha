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
