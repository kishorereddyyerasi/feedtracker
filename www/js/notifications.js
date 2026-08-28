/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS — Capacitor Local Notifications
   Uses window.Capacitor.Plugins (correct way in WebView)
   Falls back to Web Audio + Speech when running in browser
═══════════════════════════════════════════════════════════════ */

let notificationsReady = false;
let LocalNotifications = null;

function isNative() {
  return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
}

async function initNotifications() {
  if (!isNative()) {
    console.log('[FT] Running in browser — skipping native notifications');
    return;
  }
  try {
    LocalNotifications = window.Capacitor.Plugins.LocalNotifications;
    if (!LocalNotifications) {
      console.warn('[FT] LocalNotifications plugin NOT found in Capacitor.Plugins');
      showToast('⚠️ Notifications plugin missing');
      return;
    }

    // Create notification channel (Android 8+)
    try {
      await LocalNotifications.createChannel({
        id:          'feedtracker',
        name:        'Feed Reminders',
        description: 'Alerts when next feed is due',
        importance:  5,        // IMPORTANCE_HIGH — shows as heads-up + sound
        visibility:  1,        // VISIBILITY_PUBLIC — shows on lock screen
        sound:       'default',
        vibration:   true,
        lights:      true,
        lightColor:  '#E8845A',
      });
      console.log('[FT] Notification channel created');
    } catch (ce) {
      console.warn('[FT] Channel creation error (may already exist):', ce);
    }

    // Request permission
    const perm = await LocalNotifications.requestPermissions();
    console.log('[FT] Notification permission:', JSON.stringify(perm));
    notificationsReady = perm.display === 'granted';

    if (!notificationsReady) {
      showToast('⚠️ Please allow notifications for feed reminders');
    } else {
      console.log('[FT] Notifications ready ✅');
    }
  } catch (e) {
    console.warn('[FT] Notifications init failed:', e);
  }
}

async function scheduleNextFeedNotification(intervalMs) {
  await cancelNextFeedNotification();

  if (!isNative()) return;

  if (!LocalNotifications) {
    console.warn('[FT] Cannot schedule — plugin not available');
    return;
  }
  if (!notificationsReady) {
    console.warn('[FT] Cannot schedule — permission not granted');
    // Try requesting again
    try {
      const perm = await LocalNotifications.requestPermissions();
      notificationsReady = perm.display === 'granted';
    } catch (_) {}
    if (!notificationsReady) return;
  }

  try {
    const at = new Date(Date.now() + intervalMs);
    const notif = {
      id:           1001,
      title:        '🤱 Time for Feed!',
      body:         "Your baby's next feed is due now. 🍼",
      schedule:     { at, allowWhileIdle: true },
      channelId:    'feedtracker',
      smallIcon:    'ic_notification',
      actionTypeId: '',
      extra:        null,
    };
    await LocalNotifications.schedule({ notifications: [notif] });
    console.log('[FT] Notification scheduled for:', at.toLocaleTimeString());
    showToast('🔔 Reminder set for ' + at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  } catch (e) {
    console.warn('[FT] Schedule notification failed:', e);
    showToast('⚠️ Could not set reminder: ' + e.message);
  }
}

async function cancelNextFeedNotification() {
  if (!isNative() || !LocalNotifications) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
    console.log('[FT] Notification cancelled');
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
      gain.gain.setValueAtTime(0.6, ctx.currentTime + start);
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
