/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS — Capacitor Local Notifications
   Uses window.Capacitor.Plugins (correct way in WebView)
   Falls back to Web Audio + Speech when running in browser
═══════════════════════════════════════════════════════════════ */

let notificationsReady = false;
let LocalNotifications = null;

function isNative() {
  return window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}

async function initNotifications() {
  if (!isNative()) return;
  try {
    // Correct way to access Capacitor plugins in WebView — no dynamic import
    LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
    if (!LocalNotifications) {
      console.warn('LocalNotifications plugin not available');
      return;
    }
    const perm = await LocalNotifications.requestPermissions();
    notificationsReady = perm.display === 'granted';
    console.log('Notifications permission:', perm.display);
  } catch (e) {
    console.warn('Notifications init failed:', e);
  }
}

async function scheduleNextFeedNotification(intervalMs) {
  await cancelNextFeedNotification();
  if (!isNative() || !notificationsReady || !LocalNotifications) return;
  try {
    const at = new Date(Date.now() + intervalMs);
    await LocalNotifications.schedule({
      notifications: [{
        id:           1001,
        title:        '🤱 Time for Feed!',
        body:         "Your baby's next feed is due now. 🍼",
        schedule:     { at, allowWhileIdle: true },
        sound:        null,
        channelId:    'feedtracker',
        smallIcon:    'ic_notification',
        actionTypeId: '',
        extra:        null,
      }]
    });
    console.log('Notification scheduled for', at);
  } catch (e) {
    console.warn('Schedule notification failed:', e);
  }
}

async function cancelNextFeedNotification() {
  if (!isNative() || !LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
  } catch (_) {}
}

/* ── In-app alert — beep + voice (runs when app is open) ─── */
function triggerFeedAlert() {
  // Beep via Web Audio API
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const beep = (freq, start, dur) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq; osc.type = 'sine';
      gain.gain.setValueAtTime(0.5, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    };
    beep(520, 0.0, 0.25);
    beep(660, 0.3, 0.25);
    beep(800, 0.6, 0.40);
  } catch (_) {}

  // Voice via Web Speech API
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg   = new SpeechSynthesisUtterance('Time for feed');
      msg.lang    = 'en-US';
      msg.rate    = 0.9;
      msg.pitch   = 1.1;
      msg.volume  = 1;
      setTimeout(() => window.speechSynthesis.speak(msg), 900);
    }
  } catch (_) {}
}
