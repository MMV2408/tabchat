// Entry point of Tabchat.
// Almost nothing happens here: the real code lives in the other files in this folder.
const { app } = require('electron');
const window = require('./window');
const ipc = require('./ipc');
const actions = require('./actions');

// Less JavaScript memory per tab
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

// Fewer processes, each one has its own fixed overhead (measured with tools/memstat.js):
// - sound runs inside the main process instead of a separate audio process (~10 MB)
// - one renderer per site: our own screens (tab bar, + screen, divider, search) share one,
//   and so do duplicated tabs with the same login (~25 MB, more with duplicates)
app.commandLine.appendSwitch('disable-features', 'AudioServiceOutOfProcess');
app.commandLine.appendSwitch('process-per-site');

// No passkeys / Windows Hello: Electron on Linux has no window for them, so a Microsoft
// sign-in that asks for "Face, fingerprint, PIN or security key" hangs and ends in
// AADSTS10040141. Without WebAuthn, sites offer password or the Authenticator app instead.
app.commandLine.appendSwitch('disable-blink-features', 'WebAuth');

// Hardware acceleration off (setting on the + screen → General): helps with display problems
// (black screen, flickering), mostly with NVIDIA or Wayland. Barely saves memory. Must be set before startup.
const hwAccel = require('./config').peekSetting('hardwareAcceleration') !== false;
require('./store').hwAtStart = hwAccel;
if (!hwAccel) app.disableHardwareAcceleration();

// Saving mode (setting on the + screen → General, on by default): Chromium's mode for devices
// with little memory. Smaller caches and less drawing memory per tab; measured with 3 tabs
// (WhatsApp, Discord, Teams): 1600 → 1250 MB. Must be set before startup.
const lowEnd = require('./config').peekSetting('lowEndMode') !== false;
require('./store').lowEndAtStart = lowEnd;
if (lowEnd) app.commandLine.appendSwitch('enable-low-end-device-mode');

// Safety net: an unexpected error goes to a log file instead of an error dialog.
// That way a user never sees "A JavaScript error occurred", and we can still find it.
function logError(err) {
  require('./log').error('uncaught:', err);
  console.error(err);
}
process.on('uncaughtException', logError);
process.on('unhandledRejection', logError);

// After "Restart now": wait (at most 10 s) until the previous Tabchat has really quit,
// otherwise the lock below thinks it is still running
function waitForPrevious() {
  const arg = process.argv.find(a => a.startsWith('--relaunched='));
  const pid = arg && Number(arg.split('=')[1]);
  if (!pid) return Promise.resolve();
  const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
  return new Promise(done => {
    const until = Date.now() + 10000;
    (function check() {
      if (!alive() || Date.now() > until) return done();
      setTimeout(check, 100);
    })();
  });
}

waitForPrevious().then(start);

// Only one Tabchat at a time. If you start it again while it runs in the
// background, the existing window comes to the front.
function start() {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
  } else {
    app.on('second-instance', (_e, argv) => {
      // Notification click (see notifier.js): the window has already been brought forward
      if (require('./notifier').handleArgv(argv)) return;
      require('./tray').showWindow();
    });

    ipc.register();

    app.whenReady().then(() => {
      require('./hang').start(); // before the window, so it also watches the first screens
      window.create();
      require('./icons').start();
      if (process.env.TABCHAT_PIDS) require('./pids').start();
    });
    // On every quit (also logging out or shutting down the computer)
    app.on('before-quit', () => {
      require('./store').quitting = true;
      require('./tray').destroy();
    });
    app.on('window-all-closed', actions.quit);
  }
}
