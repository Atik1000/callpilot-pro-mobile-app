/**
 * HTML page loaded into a hidden WebView in Expo Go. It runs the Telnyx
 * browser SDK (the same build the CallPilot web dashboard uses) so calls work
 * without native WebRTC modules.
 *
 * Protocol:
 * - React Native -> page: `window.__callpilot(command)` via injectJavaScript.
 *   Commands: connect {token}, disconnect, call {destination, callerNumber,
 *   headers}, answer, decline, hangup, mute {muted}, hold {held}, dtmf {digit}.
 * - Page -> React Native: ReactNativeWebView.postMessage(JSON) with events:
 *   loaded, status {status, detail}, incoming {number, name},
 *   phase {phase}, callFailed {reason, wasActive} (outbound call ended by
 *   the remote side or network), commandError {command, message}, log {message}.
 */

export const TELNYX_SDK_URL = 'https://unpkg.com/@telnyx/webrtc@2.27.10/lib/bundle.js';

/** Secure-context origin for the page (getUserMedia requires https). */
export const VOIP_BRIDGE_BASE_URL = 'https://localhost/';

export const voipBridgeHtml = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<audio id="remoteAudio" autoplay playsinline></audio>
<script>
(function () {
  var RTC = null;
  var client = null;
  var call = null;
  var incoming = null;

  function post(message) {
    try { window.ReactNativeWebView.postMessage(JSON.stringify(message)); } catch (e) {}
  }
  function log(message) { post({ type: 'log', message: String(message) }); }
  function status(value, detail) { post({ type: 'status', status: value, detail: detail || '' }); }
  function phase(value) { post({ type: 'phase', phase: value }); }

  function findRTC() {
    var g = window;
    var candidates = [
      g.TelnyxWebRTC && g.TelnyxWebRTC.TelnyxRTC,
      g.TelnyxRTC && g.TelnyxRTC.TelnyxRTC,
      g.TelnyxRTC,
      g.TelnyxWebRTC
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (typeof candidates[i] === 'function') return candidates[i];
    }
    return null;
  }

  function loadSdk() {
    return new Promise(function (resolve, reject) {
      RTC = RTC || findRTC();
      if (RTC) return resolve(RTC);
      var script = document.createElement('script');
      var timer = setTimeout(function () { reject(new Error('Phone SDK loading timed out')); }, 15000);
      script.src = '${TELNYX_SDK_URL}';
      script.async = true;
      script.onload = function () {
        clearTimeout(timer);
        RTC = findRTC();
        if (RTC) resolve(RTC); else reject(new Error('Phone SDK did not load'));
      };
      script.onerror = function () {
        clearTimeout(timer);
        script.remove();
        reject(new Error('Could not load the phone SDK. Check your connection.'));
      };
      document.head.appendChild(script);
    });
  }

  function sameCall(a, b) { return !!a && !!b && (a === b || (a.id && a.id === b.id)); }
  function stateOf(c) { return String((c && c.state) || '').toLowerCase(); }
  function directionOf(c) { return String((c && (c.direction || (c.options && c.options.direction))) || '').toLowerCase(); }

  function playRemote() {
    var el = document.getElementById('remoteAudio');
    try {
      var p = el && el.play && el.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }

  function teardown() {
    var old = client;
    client = null;
    call = null;
    incoming = null;
    stopRing();
    if (old) {
      try { old.off && old.off('telnyx.notification'); } catch (e) {}
      try { old.disconnect(); } catch (e) {}
    }
  }

  function onNotification(n) {
    if (!n || !n.call) return;
    if (n.type && n.type !== 'callUpdate') return;
    var c = n.call;
    var state = stateOf(c);
    var isCurrent = sameCall(call, c);
    var isIncoming = sameCall(incoming, c);

    // A new inbound leg: ring it unless we are already on a call.
    if (!isCurrent && !isIncoming) {
      var inbound = directionOf(c) === 'inbound' || state === 'ringing' || state === 'new';
      if (!inbound || ['hangup', 'destroy', 'purge'].indexOf(state) >= 0) return;
      if (call || incoming) {
        try { c.hangup(); } catch (e) {}
        return;
      }
      incoming = c;
      startRing();
      var o = c.options || {};
      post({
        type: 'incoming',
        number: o.remoteCallerNumber || c.callerNumber || o.callerNumber || '',
        name: o.remoteCallerName || ''
      });
      return;
    }

    switch (state) {
      case 'requesting':
      case 'trying':
        if (isCurrent) phase('dialing');
        break;
      case 'ringing':
      case 'early':
        if (isCurrent) phase('ringing');
        break;
      case 'answering':
      case 'recovering':
        phase('connecting');
        break;
      case 'active':
        c.__cpActive = true;
        playRemote();
        phase('active');
        break;
      case 'held':
        phase('held');
        break;
      case 'hangup':
      case 'destroy':
      case 'purge':
        // Our own hang-up clears 'call' first, so only remote ends report.
        if (isCurrent && !c.__cpInbound) {
          post({
            type: 'callFailed',
            wasActive: !!c.__cpActive,
            reason: { cause: c.cause, causeCode: c.causeCode, sipCode: c.sipCode, sipReason: c.sipReason }
          });
        }
        if (isCurrent) call = null;
        if (isIncoming) incoming = null;
        stopRing();
        phase('ended');
        break;
    }
  }

  var commands = {
    connect: function (cmd) {
      status('connecting', 'Connecting phone…');
      return loadSdk().then(function (Ctor) {
        teardown();
        var c = new Ctor({ login_token: cmd.token, autoReconnect: true, maxReconnectAttempts: 10 });
        client = c;
        try { c.remoteElement = 'remoteAudio'; } catch (e) {}
        c.on('telnyx.ready', function () {
          if (client === c) status('online', 'Online — ready for calls');
        });
        c.on('telnyx.error', function (err) {
          if (client !== c) return;
          var msg = (err && (err.message || (err.error && err.error.message))) || 'Phone offline. Retrying…';
          if (!call && !incoming) status('offline', msg);
        });
        c.on('telnyx.socket.close', function () {
          if (client === c && !call && !incoming) status('offline', 'Phone connection closed. Retrying…');
        });
        c.on('telnyx.notification', function (n) {
          if (client === c) onNotification(n);
        });
        return c.connect();
      });
    },
    disconnect: function () { teardown(); status('offline', ''); },
    call: function (cmd) {
      if (!client) throw new Error('Phone is not connected yet.');
      if (call || incoming) throw new Error('Finish the current call first.');
      var headers = Array.isArray(cmd.headers) ? cmd.headers : [];
      call = client.newCall({
        destinationNumber: cmd.destination,
        remoteCallerName: cmd.destination,
        callerNumber: cmd.callerNumber || undefined,
        remoteElement: 'remoteAudio',
        audio: true,
        video: false,
        customHeaders: headers
      });
      if (!call) throw new Error('Telnyx did not create a call session.');
      phase('dialing');
    },
    answer: function () {
      if (!incoming) throw new Error('No incoming call to answer.');
      call = incoming;
      call.__cpInbound = true;
      incoming = null;
      stopRing();
      phase('connecting');
      return Promise.resolve(call.answer({ remoteElement: 'remoteAudio' })).then(playRemote);
    },
    decline: function () {
      stopRing();
      var c = incoming;
      incoming = null;
      if (c) { try { c.hangup(); } catch (e) {} }
    },
    hangup: function () {
      stopRing();
      var c = call || incoming;
      call = null;
      incoming = null;
      if (c) { try { c.hangup(); } catch (e) {} }
    },
    mute: function (cmd) {
      if (!call) return;
      if (cmd.muted) call.muteAudio(); else call.unmuteAudio();
    },
    hold: function (cmd) {
      if (!call) return;
      return cmd.held ? call.hold() : call.unhold();
    },
    dtmf: function (cmd) {
      if (call) call.dtmf(String(cmd.digit));
    }
  };

  // Incoming-call ring for the browser/WebView engine (two-tone, UK style).
  var ringCtx = null, ringTimer = null;
  function ringBurst() {
    try {
      ringCtx = ringCtx || new (window.AudioContext || window.webkitAudioContext)();
      var t = ringCtx.currentTime, g = ringCtx.createGain();
      g.connect(ringCtx.destination);
      [400, 450].forEach(function (f) {
        var o = ringCtx.createOscillator(); o.frequency.value = f; o.connect(g);
        o.start(t); o.stop(t + 1.0);
      });
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
      g.gain.setValueAtTime(0.25, t + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      g.gain.setValueAtTime(0.0001, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.63);
      g.gain.setValueAtTime(0.25, t + 0.98);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    } catch (e) {}
  }
  function startRing() { if (ringTimer) return; ringBurst(); ringTimer = setInterval(ringBurst, 3000); }
  function stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } }

  window.__callpilot = function (cmd) {
    var handler = cmd && commands[cmd.type];
    if (!handler) return;
    try {
      Promise.resolve(handler(cmd)).catch(function (err) {
        report(cmd, err);
      });
    } catch (err) {
      report(cmd, err);
    }
  };

  function report(cmd, err) {
    var message = (err && err.message) || String(err);
    log(cmd.type + ' failed: ' + message);
    if (cmd.type === 'connect') status('offline', message);
    if (cmd.type === 'call' || cmd.type === 'answer') {
      call = null;
      post({ type: 'commandError', command: cmd.type, message: message });
      phase('ended');
    }
  }

  post({ type: 'loaded' });
})();
</script>
</body>
</html>`;
