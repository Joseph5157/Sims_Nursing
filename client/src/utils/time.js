// Formats an hour/minute pair (24h, as stored in duty timing settings) as
// a 12h clock string, e.g. formatHourMin(13, 0) -> "1:00 PM".
export function formatHourMin(hour, min) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(min).padStart(2, '0')} ${period}`;
}
