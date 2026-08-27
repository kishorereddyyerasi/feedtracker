/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS — Capacitor Local Notifications + Web Audio fallback
═══════════════════════════════════════════════════════════════ */

let notificationsReady = false;

async function initNotifications() {
  try {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.requestPermissions();
      notificationsReady = perm.display === 'granted';
      console.log('Notifications permission:', perm.display);
    }
  } catch (e) {
    console.warn('Notifications init failed:', e);
  }
}

async function scheduleNextFeedNotification(intervalMs) {
  cancelNextFeedNotification();
  try {
    if (window.Capacitor && Capacitor.isNativePlatform() && notificationsReady) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const at = new Date(Date.now() + intervalMs);
      await LocalNotifications.schedule({
        notifications: [{
          id:    1001,
          title: '🤱 Time for Feed!',
          body:  'Your baby\'s next feed is due now.',
          schedule: { at, allowWhileIdle: true },
          sound:    'default',
          actionTypeId: '',
          extra: null,
        }]
      });
    }
  } catch (e) {
    console.warn('Schedule notification failed:', e);
  }
}

async function cancelNextFeedNotification() {
  try {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
    }
  } catch (e) {}
}

// Web Audio beep + speech fallback (for browser/testing)
function triggerFeedAlert() {
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
    beep(520, 0.0, 0.25); beep(660, 0.3, 0.25); beep(800, 0.6, 0.4);
  } catch (_) {}
  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const msg = new SpeechSynthesisUtterance('Time for feed');
      msg.lang = 'en-US'; msg.rate = 0.9; msg.pitch = 1.1; msg.volume = 1;
      setTimeout(() => window.speechSynthesis.speak(msg), 1000);
    }
  } catch (_) {}
}
