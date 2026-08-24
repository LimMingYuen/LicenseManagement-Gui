/**
 * Format a date string as ISO 8601: YYYY-MM-DD HH:mm:ss (local wall time).
 *
 * Used by table column transforms to display dates in the
 * format required by RCS-2000 integration.
 */
export function formatIsoDateTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  const t = new Date(value).getTime();
  if (isNaN(t)) return value;
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} d ago`;
}
