/* ═══════════════════════════════════════════════════════════════
   STORAGE — all localStorage keys and CRUD helpers
═══════════════════════════════════════════════════════════════ */

const KEYS = {
  FEEDS:    'ft_feeds',
  BABY:     'ft_baby',
  MEDS:     'ft_meds',
  MED_LOGS: 'ft_med_logs',
  TRACKER:  'ft_tracker',
  THEME:    'ft_theme',
  INTERVAL: 'ft_interval_hrs',
};

const MAX_FEEDS   = 200;
const MAX_TRACKER = 10; // days

// ── Generic ──────────────────────────────────────────────────
function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; }
  catch (_) { return null; }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

// ── Feeds ─────────────────────────────────────────────────────
function getFeeds() { return load(KEYS.FEEDS) || []; }
function saveNewFeed(record) {
  const feeds = getFeeds();
  feeds.unshift(record);
  if (feeds.length > MAX_FEEDS) feeds.length = MAX_FEEDS;
  save(KEYS.FEEDS, feeds);
}
function deleteFeed(id) { save(KEYS.FEEDS, getFeeds().filter(f => f.id !== id)); }
function updateFeed(id, changes) {
  const feeds = getFeeds();
  const idx = feeds.findIndex(f => f.id === id);
  if (idx !== -1) { feeds[idx] = Object.assign({}, feeds[idx], changes); save(KEYS.FEEDS, feeds); }
}
function clearFeeds() { localStorage.removeItem(KEYS.FEEDS); }

// ── Baby Profile ──────────────────────────────────────────────
function getBabyProfile() { return load(KEYS.BABY) || {}; }
function saveBabyProfile(profile) { save(KEYS.BABY, profile); }

// ── Medicines ─────────────────────────────────────────────────
function getMeds() { return load(KEYS.MEDS) || []; }
function saveMed(med) {
  const meds = getMeds();
  const idx = meds.findIndex(m => m.id === med.id);
  if (idx !== -1) meds[idx] = med; else meds.push(med);
  save(KEYS.MEDS, meds);
}
function deleteMed(id) {
  save(KEYS.MEDS, getMeds().filter(m => m.id !== id));
  save(KEYS.MED_LOGS, getMedLogs().filter(l => l.medId !== id));
}

// ── Medicine Logs ─────────────────────────────────────────────
function getMedLogs() { return load(KEYS.MED_LOGS) || []; }
function logMedDose(medId) {
  const logs = getMedLogs();
  logs.push({ id: String(Date.now()), medId, timestamp: new Date().toISOString() });
  save(KEYS.MED_LOGS, logs);
}
function undoLastMedDose(medId) {
  const logs = getMedLogs();
  const today = dayKey(new Date());
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].medId === medId && dayKey(new Date(logs[i].timestamp)) === today) {
      logs.splice(i, 1);
      save(KEYS.MED_LOGS, logs);
      return;
    }
  }
}
function getTodayMedCount(medId) {
  const today = dayKey(new Date());
  return getMedLogs().filter(l => l.medId === medId && dayKey(new Date(l.timestamp)) === today).length;
}

// ── Baby Tracker ──────────────────────────────────────────────
function getTrackerLogs() { return load(KEYS.TRACKER) || []; }
function logTrackerEvent(type) {
  const logs = getTrackerLogs();
  logs.push({ id: String(Date.now()), type, timestamp: new Date().toISOString() });
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - MAX_TRACKER);
  save(KEYS.TRACKER, logs.filter(l => new Date(l.timestamp) >= cutoff));
}
function undoLastTrackerEvent(type) {
  const logs = getTrackerLogs();
  const today = dayKey(new Date());
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].type === type && dayKey(new Date(logs[i].timestamp)) === today) {
      logs.splice(i, 1); save(KEYS.TRACKER, logs); return;
    }
  }
}

// ── Settings ──────────────────────────────────────────────────
function getFeedIntervalMs() {
  return (parseFloat(localStorage.getItem(KEYS.INTERVAL)) || 2) * 3600000;
}
function setFeedInterval(hrs) { localStorage.setItem(KEYS.INTERVAL, hrs); }
function getFeedIntervalHrs() { return parseFloat(localStorage.getItem(KEYS.INTERVAL)) || 2; }

// ── Date helpers ──────────────────────────────────────────────
function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

// ── Export all data ───────────────────────────────────────────
function exportAllCSV() {
  const lines = [];

  // Feeds
  lines.push('=== FEED HISTORY ===');
  lines.push('Date,Start Time,End Time,Side,Duration(min),Duration(sec)');
  getFeeds().forEach(f => {
    const d = new Date(f.endTime);
    lines.push([
      d.toLocaleDateString([],{year:'numeric',month:'2-digit',day:'2-digit'}),
      new Date(f.startTime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),
      d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}),
      f.side === 'L' ? 'Left' : 'Right',
      Math.floor(f.durationSeconds/60),
      f.durationSeconds%60
    ].join(','));
  });

  // Baby Tracker
  lines.push('');
  lines.push('=== BABY TRACKER (last 10 days) ===');
  lines.push('Date,Urine,Motion,Diaper');
  const trackerLogs = getTrackerLogs();
  for (let i = 0; i < 10; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const u = trackerLogs.filter(l => l.type==='urine'  && dayKey(new Date(l.timestamp))===k).length;
    const m = trackerLogs.filter(l => l.type==='motion' && dayKey(new Date(l.timestamp))===k).length;
    const dp= trackerLogs.filter(l => l.type==='diaper' && dayKey(new Date(l.timestamp))===k).length;
    if (u+m+dp > 0) lines.push([d.toLocaleDateString(),u,m,dp].join(','));
  }

  // Medicines
  lines.push('');
  lines.push('=== MEDICINES ===');
  lines.push('Medicine,Dosage,Unit,Frequency(hrs),Given Today');
  getMeds().forEach(med => {
    lines.push([med.name, med.dosage, med.unit, med.freqHrs, getTodayMedCount(med.id)].join(','));
  });

  // Medicine logs
  lines.push('');
  lines.push('=== MEDICINE DOSE LOGS ===');
  lines.push('Medicine,Date,Time');
  const meds = getMeds();
  getMedLogs().forEach(l => {
    const med = meds.find(m => m.id === l.medId);
    const d = new Date(l.timestamp);
    lines.push([
      med ? med.name : 'Unknown',
      d.toLocaleDateString(),
      d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    ].join(','));
  });

  return lines.join('\n');
}
