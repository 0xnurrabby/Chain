
export function short(addr?: string, n = 6) {
  if (!addr) return '';
  return '...' + addr.slice(-n);
}

export function fmt(n: number, digits = 6) {
  return Number(n.toFixed(digits));
}

export function utcTime(ts: number) {
  const d = new Date(ts);
  return d.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

export function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
