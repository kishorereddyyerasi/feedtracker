/* ═══════════════════════════════════════════════════════════════
   FeedTracker — Main App Logic
   Tabs: Home | Medicines | Profile
═══════════════════════════════════════════════════════════════ */

/* ── THEME ─────────────────────────────────────────────────── */
const themeToggle = document.getElementById('theme-toggle');
const html        = document.documentElement;

function applyTheme(theme) {
  html.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  document.getElementById('meta-theme-color').setAttribute('content',
    theme === 'dark' ? '#1C1410' : '#FFF8F2');
}
applyTheme(localStorage.getItem(KEYS.THEME) || 'light');
themeToggle.addEventListener('click', () => {
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(KEYS.THEME, next);
  applyTheme(next);
});

/* ── TABS ──────────────────────────────────────────────────── */
document.querySelectorAll('.tab-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-meds')    renderMeds();
    if (btn.dataset.tab === 'tab-profile') renderProfile();
  });
});

/* ── PROFILE ───────────────────────────────────────────────── */
function renderProfile() {
  const p = getBabyProfile();
  if (p.mother) document.getElementById('profile-mother').value = p.mother;
  if (p.baby)   document.getElementById('profile-baby').value   = p.baby;
  if (p.dob)    document.getElementById('profile-dob').value    = p.dob;

  const display = document.getElementById('profile-display');
  if (p.baby || p.mother) {
    display.classList.remove('hidden');
    document.getElementById('profile-baby-name-display').textContent  = p.baby || '—';
    document.getElementById('profile-age-display').textContent        = p.dob ? babyAge(p.dob) : '';
    document.getElementById('profile-mother-display').textContent     = p.mother ? 'Mother: ' + p.mother : '';
  } else {
    display.classList.add('hidden');
  }
}

document.getElementById('btn-save-profile').addEventListener('click', () => {
  const profile = {
    mother: document.getElementById('profile-mother').value.trim(),
    baby:   document.getElementById('profile-baby').value.trim(),
    dob:    document.getElementById('profile-dob').value,
  };
  saveBabyProfile(profile);
  renderProfile();
  updateBabyInfoBar();
  showToast('Profile saved ✅');
});

function updateBabyInfoBar() {
  const p   = getBabyProfile();
  const bar = document.getElementById('baby-info-bar');
  if (p.baby || p.dob) {
    const age = p.dob ? ' · ' + babyAge(p.dob) : '';
    bar.innerHTML = '<strong>' + (p.baby || 'Baby') + '</strong>' + age;
    bar.classList.add('visible');
  } else {
    bar.classList.remove('visible');
  }
}

/* ── EXPORT ALL ────────────────────────────────────────────── */
document.getElementById('btn-export-all').addEventListener('click', () => {
  const csv      = exportAllCSV();
  const today    = new Date().toISOString().slice(0, 10);
  const dataUri  = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
  const a        = document.createElement('a');
  a.href         = dataUri;
  a.download     = 'feedtracker-all-' + today + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Export started 📥');
});

/* ── FEED SESSION ──────────────────────────────────────────── */
let activeSide    = null;
let feedStartTime = null;
let feedInterval  = null;
let isRunning     = false;
let feedPaused    = false;
let feedPausedAt  = 0;
let manualMode    = false;

const panelSelect     = document.getElementById('panel-select');
const panelActive     = document.getElementById('panel-active');
const btnLeft         = document.getElementById('btn-left');
const btnRight        = document.getElementById('btn-right');
const activeSideNameEl= document.getElementById('active-side-name');
const feedTimerEl     = document.getElementById('feed-timer');
const feedTimerSub    = document.getElementById('feed-timer-sub');
const btnStop         = document.getElementById('btn-stop');
const btnFeedPause    = document.getElementById('btn-feed-pause');
const btnManualToggle = document.getElementById('btn-manual-toggle');
const manualInputRow  = document.getElementById('manual-input-row');
const manualMinutes   = document.getElementById('manual-minutes');
const manualSeconds   = document.getElementById('manual-seconds');
const btnManualConfirm= document.getElementById('btn-manual-confirm');

function startSession(side) {
  activeSide    = side;
  feedStartTime = Date.now();
  isRunning     = true;
  feedPaused    = false;
  feedPausedAt  = 0;
  manualMode    = false;

  // Stop next-feed timer while feeding
  clearInterval(nextFeedInterval);
  nextFeedPaused = false;
  document.getElementById('panel-next').classList.remove('visible');

  panelSelect.classList.add('hidden');
  panelActive.classList.add('visible');
  activeSideNameEl.textContent = '🤱 Feeding — ' + (side === 'L' ? 'LEFT' : 'RIGHT');
  activeSideNameEl.className   = 'active-side-name ' + (side === 'L' ? 'left' : 'right');
  feedTimerEl.textContent      = '00:00';
  feedTimerEl.classList.add('running');
  feedTimerSub.textContent     = 'tap stop when done';
  btnFeedPause.textContent     = '⏸ Pause';
  manualInputRow.classList.remove('visible');
  btnManualToggle.textContent  = 'Enter time manually';
  document.title               = '🤱 00:00 — FeedTracker';

  // Show last fed info
  const lastFedEl = document.getElementById('last-fed-info');
  const prev = getFeeds();
  if (prev.length) {
    const diffMs   = Date.now() - new Date(prev[0].endTime).getTime();
    const totalMin = Math.floor(diffMs / 60000);
    const hrs  = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    let ago = hrs > 0 && mins > 0 ? hrs+'h '+mins+'m ago' : hrs > 0 ? hrs+'h ago' : mins > 0 ? mins+' min ago' : 'just now';
    lastFedEl.textContent  = '🕐 Last fed ' + ago;
    lastFedEl.style.display = 'block';
  } else {
    lastFedEl.style.display = 'none';
  }

  feedInterval = setInterval(() => {
    const elapsed = (Date.now() - feedStartTime) / 1000;
    const d = formatElapsed(elapsed);
    feedTimerEl.textContent = d;
    document.title = '🤱 ' + d + ' — FeedTracker';
  }, 1000);
}

function stopSession(overrideSecs) {
  if (!isRunning && !feedPaused && overrideSecs === undefined) return;
  clearInterval(feedInterval);
  isRunning = false; feedPaused = false;

  const endTime  = new Date().toISOString();
  const durSecs  = overrideSecs !== undefined ? overrideSecs
    : feedPausedAt > 0 ? feedPausedAt
    : (Date.now() - feedStartTime) / 1000;

  const record = {
    id:              String(feedStartTime),
    side:            activeSide,
    durationSeconds: Math.round(durSecs),
    startTime:       new Date(feedStartTime).toISOString(),
    endTime:         endTime,
  };
  saveNewFeed(record);

  feedTimerEl.classList.remove('running');
  panelActive.classList.remove('visible');
  panelSelect.classList.remove('hidden');
  document.title = '🤱 FeedTracker';

  applySideSuggestion();
  startNextFeedTimer();
  renderHistory();

  // Schedule push notification for next feed
  scheduleNextFeedNotification(getFeedIntervalMs());
}

btnLeft.addEventListener('click',  () => startSession('L'));
btnRight.addEventListener('click', () => startSession('R'));
btnStop.addEventListener('click',  () => stopSession());

btnFeedPause.addEventListener('click', () => {
  if (feedPaused) {
    feedPaused    = false;
    feedStartTime = Date.now() - feedPausedAt * 1000;
    feedTimerEl.classList.add('running');
    btnFeedPause.textContent = '⏸ Pause';
    feedTimerSub.textContent = 'tap stop when done';
    feedInterval = setInterval(() => {
      const d = formatElapsed((Date.now() - feedStartTime) / 1000);
      feedTimerEl.textContent = d;
      document.title = '🤱 ' + d + ' — FeedTracker';
    }, 1000);
  } else {
    feedPausedAt = (Date.now() - feedStartTime) / 1000;
    feedPaused   = true;
    clearInterval(feedInterval);
    feedTimerEl.classList.remove('running');
    btnFeedPause.textContent = '▶ Resume';
    feedTimerSub.textContent = 'paused';
  }
});

btnManualToggle.addEventListener('click', () => {
  manualMode = !manualMode;
  if (manualMode) {
    manualInputRow.classList.add('visible');
    btnManualToggle.textContent = 'Cancel manual entry';
    const e = Math.round((Date.now() - feedStartTime) / 1000);
    manualMinutes.value = Math.floor(e / 60);
    manualSeconds.value = e % 60;
  } else {
    manualInputRow.classList.remove('visible');
    btnManualToggle.textContent = 'Enter time manually';
  }
});

btnManualConfirm.addEventListener('click', () => {
  const total = (parseInt(manualMinutes.value)||0)*60 + (parseInt(manualSeconds.value)||0);
  if (total <= 0) { manualMinutes.focus(); return; }
  feedStartTime = Date.now() - total * 1000;
  stopSession(total);
});

/* ── NEXT FEED TIMER ───────────────────────────────────────── */
let nextFeedInterval  = null;
let nextFeedPaused    = false;
let nextFeedPausedAt  = 0;
const TEN_MIN_MS      = 600000;
const FIVE_MIN_MS     = 300000;

const panelNext       = document.getElementById('panel-next');
const nextTimerEl     = document.getElementById('next-timer');
const nextTimerSubEl  = document.getElementById('next-timer-sub');
const progressFill    = document.getElementById('progress-fill');
const suggestionBadge = document.getElementById('suggestion-badge');
const suggestionText  = document.getElementById('suggestion-text');
const btnNextPause    = document.getElementById('btn-next-pause');
const btnNextStop     = document.getElementById('btn-next-stop');
const overdueBanner   = document.getElementById('overdue-banner');

const feedIntervalInput = document.getElementById('feed-interval-input');
feedIntervalInput.value = getFeedIntervalHrs();
updateIntervalLabels(getFeedIntervalHrs());

function updateIntervalLabels(hrs) {
  const half = hrs / 2;
  document.getElementById('prog-label-left').textContent = hrs + 'h';
  document.getElementById('prog-label-mid').textContent  = half + 'h';
  document.getElementById('next-timer').textContent      = formatElapsed(hrs * 3600);
  document.getElementById('overdue-text').textContent    =
    '⏰ It\'s been over ' + hrs + 'h since the last feed!';
}

feedIntervalInput.addEventListener('change', () => {
  let v = parseFloat(feedIntervalInput.value);
  if (isNaN(v) || v < 0.5) v = 0.5;
  if (v > 6) v = 6;
  v = Math.round(v * 2) / 2;
  feedIntervalInput.value = v;
  setFeedInterval(v);
  updateIntervalLabels(v);
  startNextFeedTimer();
});

function getProgressColor(pct) {
  if (pct > 50) return 'var(--green)';
  if (pct > 17) return 'var(--amber)';
  return 'var(--red)';
}

function getSuggestion(last) {
  const FIVE_MIN_S = 300;
  if (last.durationSeconds < FIVE_MIN_S) {
    const s = last.side === 'L' ? 'LEFT' : 'RIGHT';
    return { text: '👉 Continue ' + s, cls: last.side === 'L' ? 'left' : 'right' };
  }
  const s = last.side === 'L' ? 'RIGHT' : 'LEFT';
  return { text: '👉 Next Feed: ' + s, cls: last.side === 'L' ? 'right' : 'left' };
}

function updateNextFeedDisplay() {
  const feeds = getFeeds();
  if (!feeds.length) { panelNext.classList.remove('visible'); return; }

  const last      = feeds[0];
  const lastEnd   = new Date(last.endTime).getTime();
  const intervalMs = getFeedIntervalMs();

  let remainingMs = nextFeedPaused ? nextFeedPausedAt
    : Math.max(0, intervalMs - (Date.now() - lastEnd));

  panelNext.classList.add('visible');

  if (remainingMs <= 0 && !nextFeedPaused) {
    if (!updateNextFeedDisplay._alerted) {
      updateNextFeedDisplay._alerted = true;
      triggerFeedAlert();
    }
    nextTimerEl.textContent    = '0:00';
    nextTimerSubEl.textContent = 'feed overdue';
    nextTimerEl.style.color    = 'var(--red)';
    progressFill.style.width   = '0%';
    progressFill.style.backgroundColor = 'var(--red)';
    overdueBanner.style.display = 'block';
  } else {
    nextTimerEl.textContent    = formatElapsed(remainingMs / 1000);
    nextTimerSubEl.textContent = nextFeedPaused ? 'paused' : 'until next feed';
    nextTimerEl.style.color    = '';
    overdueBanner.style.display = 'none';
    const pct = (remainingMs / intervalMs) * 100;
    progressFill.style.width           = pct + '%';
    progressFill.style.backgroundColor = getProgressColor(pct);
  }

  const s = getSuggestion(last);
  suggestionText.textContent = s.text;
  suggestionBadge.className  = 'suggestion-badge visible ' + s.cls;
}

function startNextFeedTimer() {
  clearInterval(nextFeedInterval);
  nextFeedPaused   = false;
  nextFeedPausedAt = 0;
  updateNextFeedDisplay._alerted = false;
  btnNextPause.textContent = '⏸ Pause';
  updateNextFeedDisplay();
  nextFeedInterval = setInterval(updateNextFeedDisplay, 1000);
}

btnNextPause.addEventListener('click', () => {
  const feeds = getFeeds();
  if (!feeds.length) return;
  if (nextFeedPaused) {
    const orig = getFeedIntervalMs() - nextFeedPausedAt;
    const updated = getFeeds();
    updated[0] = Object.assign({}, updated[0], { endTime: new Date(Date.now() - orig).toISOString() });
    save(KEYS.FEEDS, updated);
    nextFeedPaused = false; nextFeedPausedAt = 0;
    btnNextPause.textContent = '⏸ Pause';
    clearInterval(nextFeedInterval);
    nextFeedInterval = setInterval(updateNextFeedDisplay, 1000);
  } else {
    nextFeedPausedAt = Math.max(0, getFeedIntervalMs() - (Date.now() - new Date(feeds[0].endTime).getTime()));
    nextFeedPaused   = true;
    btnNextPause.textContent = '▶ Resume';
    clearInterval(nextFeedInterval);
  }
  updateNextFeedDisplay();
});

btnNextStop.addEventListener('click', () => {
  clearInterval(nextFeedInterval);
  nextFeedPaused = false;
  panelNext.classList.remove('visible');
  btnLeft.classList.remove('suggested');
  btnRight.classList.remove('suggested');
  cancelNextFeedNotification();
});

function applySideSuggestion() {
  const feeds = getFeeds();
  btnLeft.classList.remove('suggested');
  btnRight.classList.remove('suggested');
  if (!feeds.length) return;
  const last = feeds[0];
  const suggestedBtn = last.durationSeconds < 300
    ? (last.side === 'L' ? btnLeft  : btnRight)
    : (last.side === 'L' ? btnRight : btnLeft);
  suggestedBtn.classList.add('suggested');
}

/* ── BABY TRACKER ──────────────────────────────────────────── */
function renderTracker() {
  const logs  = getTrackerLogs();
  const today = dayKey(new Date());
  ['urine','motion','diaper'].forEach(type => {
    document.getElementById('count-' + type).textContent =
      logs.filter(l => l.type === type && dayKey(new Date(l.timestamp)) === today).length;
  });
  const cont = document.getElementById('tracker-history-container');
  if (cont.style.display !== 'none') renderTrackerHistory(logs);
}

document.querySelectorAll('.t-plus').forEach(btn =>
  btn.addEventListener('click', () => { logTrackerEvent(btn.dataset.type); renderTracker(); })
);
document.querySelectorAll('.t-minus').forEach(btn =>
  btn.addEventListener('click', () => { undoLastTrackerEvent(btn.dataset.type); renderTracker(); })
);

const btnTrackerHistory = document.getElementById('btn-tracker-history');
const trackerHistCont   = document.getElementById('tracker-history-container');
btnTrackerHistory.addEventListener('click', () => {
  const open = trackerHistCont.style.display !== 'none';
  trackerHistCont.style.display = open ? 'none' : 'block';
  btnTrackerHistory.textContent = open ? '📅 Show 10-Day History' : '📅 Hide History';
  if (!open) renderTrackerHistory(getTrackerLogs());
});

function renderTrackerHistory(logs) {
  const days = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const label = i === 0 ? 'Today' : i === 1 ? 'Yesterday'
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const u  = logs.filter(l => l.type==='urine'  && dayKey(new Date(l.timestamp))===k).length;
    const m  = logs.filter(l => l.type==='motion' && dayKey(new Date(l.timestamp))===k).length;
    const dp = logs.filter(l => l.type==='diaper' && dayKey(new Date(l.timestamp))===k).length;
    if (u+m+dp > 0) days.push({ label, u, m, dp });
  }
  if (!days.length) {
    trackerHistCont.innerHTML = '<div class="history-empty" style="padding:12px 0;">No entries yet.</div>';
    return;
  }
  trackerHistCont.innerHTML = `
    <table class="tracker-history-table">
      <thead><tr><th>Day</th><th style="text-align:center;">💧</th><th style="text-align:center;">💩</th><th style="text-align:center;">🔄</th></tr></thead>
      <tbody>${days.map(d=>`<tr><td style="font-weight:600;">${d.label}</td><td style="text-align:center;">${d.u}</td><td style="text-align:center;">${d.m}</td><td style="text-align:center;">${d.dp}</td></tr>`).join('')}</tbody>
    </table>`;
}

/* ── FEED HISTORY ──────────────────────────────────────────── */
function renderHistory() {
  const feeds = getFeeds();
  const cont  = document.getElementById('history-container');
  const btnEx = document.getElementById('btn-export-feed');
  const btnCl = document.getElementById('btn-clear-feeds');

  if (!feeds.length) {
    cont.innerHTML = '<div class="history-empty">No feeds logged yet.</div>';
    btnEx.classList.add('hidden'); btnCl.classList.add('hidden');
    return;
  }
  btnEx.classList.remove('hidden'); btnCl.classList.remove('hidden');

  cont.innerHTML = '<div class="history-list">' + feeds.map(feed => {
    const sideClass = feed.side === 'L' ? 'left' : 'right';
    const sideName  = feed.side === 'L' ? 'Left' : 'Right';
    return `
      <div class="history-entry" style="flex-wrap:wrap;">
        <div class="entry-side-badge ${sideClass}">${feed.side}</div>
        <div class="entry-info">
          <div class="entry-duration">${sideName} · ${formatFeedDuration(feed.durationSeconds)}</div>
          <div class="entry-time">${formatDate(feed.endTime)} · ${formatTime(feed.startTime)} → ${formatTime(feed.endTime)}</div>
          <div class="entry-time" style="font-size:11px;opacity:0.75;">${formatTimestamp(feed.endTime)}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <button class="entry-delete-btn" data-id="${feed.id}" style="font-size:15px;">✏️</button>
          <button class="entry-delete-btn" data-id="${feed.id}" data-action="delete">🗑</button>
        </div>
        <div class="edit-row" id="edit-${feed.id}">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <label style="font-size:12px;color:var(--text-muted);font-weight:600;">Side:</label>
            <select class="edit-side" style="padding:6px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:14px;">
              <option value="L" ${feed.side==='L'?'selected':''}>Left</option>
              <option value="R" ${feed.side==='R'?'selected':''}>Right</option>
            </select>
            <input type="number" class="edit-mins manual-input" value="${Math.floor(feed.durationSeconds/60)}" min="0" max="120" style="width:58px;" />
            <span style="font-size:12px;color:var(--text-muted);">min</span>
            <input type="number" class="edit-secs manual-input" value="${feed.durationSeconds%60}" min="0" max="59" style="width:58px;" />
            <span style="font-size:12px;color:var(--text-muted);">sec</span>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="edit-save-btn manual-confirm-btn" data-id="${feed.id}" style="flex:1;">💾 Save</button>
            <button class="edit-cancel-btn manual-confirm-btn" data-id="${feed.id}" style="flex:1;">Cancel</button>
          </div>
        </div>
      </div>`;
  }).join('') + '</div>';

  // Delete
  cont.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => {
      deleteFeed(btn.dataset.id); renderHistory(); updateNextFeedDisplay(); applySideSuggestion();
    })
  );
  // Edit toggle
  cont.querySelectorAll('.entry-delete-btn:not([data-action="delete"])').forEach(btn =>
    btn.addEventListener('click', () => {
      const row = document.getElementById('edit-' + btn.dataset.id);
      if (!row) return;
      const open = row.style.display === 'flex';
      cont.querySelectorAll('.edit-row').forEach(r => r.style.display = 'none');
      if (!open) row.style.display = 'flex';
    })
  );
  // Cancel
  cont.querySelectorAll('.edit-cancel-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const r = document.getElementById('edit-' + btn.dataset.id);
      if (r) r.style.display = 'none';
    })
  );
  // Save edit
  cont.querySelectorAll('.edit-save-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      const row   = document.getElementById('edit-' + btn.dataset.id);
      const side  = row.querySelector('.edit-side').value;
      const total = (parseInt(row.querySelector('.edit-mins').value)||0)*60 + (parseInt(row.querySelector('.edit-secs').value)||0);
      if (total <= 0) return;
      updateFeed(btn.dataset.id, { side, durationSeconds: total });
      renderHistory(); updateNextFeedDisplay(); applySideSuggestion();
    })
  );
}

document.getElementById('btn-export-feed').addEventListener('click', () => {
  const feeds = getFeeds();
  if (!feeds.length) return;
  const headers = 'Date,Start Time,End Time,Side,Duration(min),Duration(sec)';
  const rows = feeds.map(f => [
    formatDate(f.endTime), formatTime24(f.startTime), formatTime24(f.endTime),
    f.side==='L'?'Left':'Right', Math.floor(f.durationSeconds/60), f.durationSeconds%60
  ].join(',')).join('\n');
  const a   = document.createElement('a');
  a.href    = 'data:text/csv;charset=utf-8,' + encodeURIComponent(headers + '\n' + rows);
  a.download= 'feeds-' + new Date().toISOString().slice(0,10) + '.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
});

document.getElementById('btn-clear-feeds').addEventListener('click', () => {
  if (!confirm('Clear all feed history? This cannot be undone.')) return;
  clearFeeds(); renderHistory();
  clearInterval(nextFeedInterval); nextFeedPaused = false;
  panelNext.classList.remove('visible');
  btnLeft.classList.remove('suggested'); btnRight.classList.remove('suggested');
  cancelNextFeedNotification();
});

/* ── MEDICINES ─────────────────────────────────────────────── */
document.getElementById('btn-add-med').addEventListener('click', () => {
  const name   = document.getElementById('med-name-input').value.trim();
  const dosage = document.getElementById('med-dosage-input').value;
  const unit   = document.getElementById('med-unit-input').value;
  const freq   = document.getElementById('med-freq-input').value;
  if (!name) { document.getElementById('med-name-input').focus(); return; }
  if (!dosage) { document.getElementById('med-dosage-input').focus(); return; }
  if (!freq) { document.getElementById('med-freq-input').focus(); return; }
  const med = { id: String(Date.now()), name, dosage: parseFloat(dosage), unit, freqHrs: parseInt(freq) };
  saveMed(med);
  document.getElementById('med-name-input').value   = '';
  document.getElementById('med-dosage-input').value = '';
  document.getElementById('med-freq-input').value   = '';
  renderMeds();
  showToast(name + ' added ✅');
});

function renderMeds() {
  const meds = getMeds();
  const cont = document.getElementById('med-list-container');
  if (!meds.length) {
    cont.innerHTML = '<div class="history-empty">No medicines added yet.</div>';
    return;
  }

  cont.innerHTML = '<div class="med-list">' + meds.map(med => {
    const todayCount = getTodayMedCount(med.id);
    const logs       = getMedLogs()
      .filter(l => l.medId === med.id)
      .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 3);

    const logRows = logs.map(l => `
      <div class="med-log-row">
        <span class="med-log-time">💊 ${formatTime(l.timestamp)} · ${formatTimestamp(l.timestamp)}</span>
      </div>`).join('');

    return `
      <div class="med-card">
        <div class="med-card-header">
          <div>
            <div class="med-name">${med.name} <span class="med-today-count">${todayCount}x today</span></div>
            <div class="med-dose">${med.dosage} ${med.unit} · every ${med.freqHrs}h</div>
          </div>
          <button class="med-delete-btn" data-id="${med.id}">🗑</button>
        </div>
        ${logRows}
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="med-log-btn" data-id="${med.id}" style="flex:2;">+ Log Dose</button>
          <button class="manual-confirm-btn med-undo-btn" data-id="${med.id}" style="flex:1;font-size:13px;">↩ Undo</button>
        </div>
      </div>`;
  }).join('') + '</div>';

  cont.querySelectorAll('.med-log-btn').forEach(btn =>
    btn.addEventListener('click', () => { logMedDose(btn.dataset.id); renderMeds(); showToast('Dose logged ✅'); })
  );
  cont.querySelectorAll('.med-undo-btn').forEach(btn =>
    btn.addEventListener('click', () => { undoLastMedDose(btn.dataset.id); renderMeds(); })
  );
  cont.querySelectorAll('.med-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      if (!confirm('Remove this medicine?')) return;
      deleteMed(btn.dataset.id); renderMeds();
    })
  );
}

/* ── TOAST ─────────────────────────────────────────────────── */
function showToast(msg) {
  let t = document.getElementById('ft-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ft-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#3B2A1A;color:#fff;padding:10px 20px;border-radius:999px;font-size:14px;font-weight:600;z-index:9999;opacity:0;transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2000);
}

/* ── INIT ──────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await initNotifications();
  updateBabyInfoBar();
  renderHistory();
  applySideSuggestion();
  startNextFeedTimer();
  renderTracker();
  renderMeds();
  renderProfile();
});
