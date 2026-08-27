/* ═══════════════════════════════════════════════════════════════
   HELPERS — formatting utilities
═══════════════════════════════════════════════════════════════ */

function padTwo(n) { return String(Math.floor(n)).padStart(2, '0'); }

function formatElapsed(secs) {
  const s = Math.floor(secs);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return hh > 0 ? hh + ':' + padTwo(mm) + ':' + padTwo(ss) : padTwo(mm) + ':' + padTwo(ss);
}

function formatFeedDuration(secs) {
  const s = Math.round(secs);
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), r = s % 60;
  return r > 0 ? m + 'm ' + r + 's' : m + 'm';
}

function formatTimestamp(isoString) {
  const d = new Date(isoString);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1)  return 'just now';
  if (diffMin < 60) return diffMin + ' min ago';
  return Math.floor(diffMin / 60) + 'h ago';
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTime24(isoString) {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function babyAge(dobISO) {
  if (!dobISO) return null;
  const dob  = new Date(dobISO);
  const now  = new Date();
  const diffMs   = now - dob;
  const diffDays = Math.floor(diffMs / 86400000);
  const weeks    = Math.floor(diffDays / 7);
  const remDays  = diffDays % 7;

  if (diffDays < 14) {
    return diffDays === 1 ? '1 day old' : diffDays + ' days old';
  }
  if (weeks < 8) {
    return remDays > 0 ? weeks + ' weeks ' + remDays + ' days old' : weeks + ' weeks old';
  }
  const months   = Math.floor(diffDays / 30.44);
  const remWeeks = Math.floor((diffDays - months * 30.44) / 7);
  return remWeeks > 0 ? months + ' months ' + remWeeks + ' weeks old' : months + ' months old';
}
