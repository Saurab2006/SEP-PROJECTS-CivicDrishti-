export function formatNPR(value) {
  if (!Number.isFinite(value) || value === 0) return 'Rs 0';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `Rs ${(value / 1e9).toFixed(2)} Arab`;
  if (abs >= 1e7) return `Rs ${(value / 1e7).toFixed(1)} Cr`;
  if (abs >= 1e5) return `Rs ${(value / 1e5).toFixed(1)} Lakh`;
  if (abs >= 1e3) return `Rs ${(value / 1e3).toFixed(1)}K`;
  return `Rs ${Math.round(value)}`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
}

export function relativeTime(input) {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  const diff = Date.now() - date.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}
