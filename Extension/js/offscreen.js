const DEFAULT_STREAM_URL = "https://radioinnis-naxinacional.streaming.rs:8622/;stream.nsv";
const audio = new Audio();
let currentStreamUrl = "";
let audioCtx = null;
let sfxCompressor = null;
let sfxOutput = null;
let audioCtxCloseTimer = null;
let isUserPlaying = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function cancelReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (!isUserPlaying || !currentStreamUrl) return;
  cancelReconnect();
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    updateRadioStatus(false);
    return;
  }
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    if (!isUserPlaying || !currentStreamUrl) return;
    try {
      audio.src = currentStreamUrl;
      audio.load();
      audio.play().then(() => {
        reconnectAttempts = 0;
        updateRadioStatus(true);
      }).catch(() => {
        scheduleReconnect();
      });
    } catch {
      scheduleReconnect();
    }
  }, 3000);
}

function safeSendRuntimeMessage(payload) {
  if (!chrome?.runtime?.id) return;

  try {
    const maybePromise = chrome.runtime.sendMessage(payload);
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => { });
    }
  } catch {
    // Extension context can be reloading/invalidated.
  }
}

function getAudioContext() {
  if (!audioCtx || audioCtx.state === "closed") {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function scheduleAudioContextClose() {
  if (audioCtxCloseTimer) clearTimeout(audioCtxCloseTimer);
  audioCtxCloseTimer = setTimeout(() => {
    if (!audioCtx) return;
    if (audioCtx.state === "running") return;
    audioCtx.close().catch(() => { });
  }, 20000);
}

function updateRadioStatus(isPlaying) {
  safeSendRuntimeMessage({ action: "radio_status", playing: Boolean(isPlaying) });
}


/**
 * Converts a 0-100 volume percentage to a safe value, falling back when invalid.
 * @param {unknown} percent
 * @param {number} fallback
 * @returns {number} Percentage as a 0-1 audio volume.
 */
function normalizeVolume(percent, fallback) {
  const n = Number(percent);
  const safe = Number.isFinite(n) ? n : fallback;
  return Math.max(0, Math.min(1, safe / 100));
}

/**
 * Accepts only http(s) stream URLs; anything else falls back to the default station.
 * @param {unknown} rawUrl
 * @returns {string}
 */
function resolveStreamUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return DEFAULT_STREAM_URL;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : DEFAULT_STREAM_URL;
  } catch {
    return DEFAULT_STREAM_URL;
  }
}

function setRadioVolume(vol) {
  audio.volume = Math.max(0, Math.min(1, vol));
}

function getSfxOutputNode(ctx) {
  if (!sfxCompressor || !sfxOutput) {
    sfxCompressor = ctx.createDynamicsCompressor();
    sfxCompressor.threshold.setValueAtTime(-20, ctx.currentTime);
    sfxCompressor.knee.setValueAtTime(24, ctx.currentTime);
    sfxCompressor.ratio.setValueAtTime(6, ctx.currentTime);
    sfxCompressor.attack.setValueAtTime(0.004, ctx.currentTime);
    sfxCompressor.release.setValueAtTime(0.16, ctx.currentTime);

    sfxOutput = ctx.createGain();
    sfxOutput.gain.setValueAtTime(1.35, ctx.currentTime);

    sfxCompressor.connect(sfxOutput);
    sfxOutput.connect(ctx.destination);
  }

  return sfxCompressor;
}

function playTone(ctx, cfg) {
  const outputNode = getSfxOutputNode(ctx);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = cfg.type || 'sine';
  osc.frequency.setValueAtTime(cfg.fromHz, cfg.at);
  if (Number.isFinite(cfg.toHz)) {
    osc.frequency.exponentialRampToValueAtTime(cfg.toHz, cfg.at + cfg.duration);
  }

  if (Number.isFinite(cfg.detune)) {
    osc.detune.setValueAtTime(cfg.detune, cfg.at);
  }

  gain.gain.setValueAtTime(0, cfg.at);
  gain.gain.linearRampToValueAtTime(cfg.peak || 0.12, cfg.at + (cfg.attack || 0.01));
  gain.gain.exponentialRampToValueAtTime(0.0001, cfg.at + cfg.duration);

  osc.connect(gain);
  gain.connect(outputNode);
  osc.start(cfg.at);
  osc.stop(cfg.at + cfg.duration + 0.01);
}

function playSuccessSound(ctx, now) {
  playTone(ctx, {
    type: 'triangle',
    fromHz: 880,
    toHz: 988,
    at: now,
    duration: 0.09,
    attack: 0.006,
    peak: 0.16,
    detune: -2
  });

  playTone(ctx, {
    type: 'sine',
    fromHz: 1174,
    toHz: 1318,
    at: now + 0.055,
    duration: 0.11,
    attack: 0.006,
    peak: 0.14,
    detune: 2
  });
}

function playErrorSound(ctx, now) {
  playTone(ctx, {
    type: 'triangle',
    fromHz: 240,
    toHz: 160,
    at: now,
    duration: 0.16,
    attack: 0.004,
    peak: 0.18,
    detune: -2
  });
}

if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => {
    safeSendRuntimeMessage({ action: "hardwarePlay" });
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    safeSendRuntimeMessage({ action: "hardwarePause" });
  });
}

audio.addEventListener("playing", () => {
  reconnectAttempts = 0;
  cancelReconnect();
  updateRadioStatus(true);
});
audio.addEventListener("play", () => updateRadioStatus(true));
audio.addEventListener("pause", () => {
  if (!isUserPlaying) updateRadioStatus(false);
});
audio.addEventListener("ended", () => {
  if (isUserPlaying) scheduleReconnect();
  else updateRadioStatus(false);
});
audio.addEventListener("error", () => {
  if (isUserPlaying) scheduleReconnect();
  else updateRadioStatus(false);
});
audio.addEventListener("stalled", () => {
  if (isUserPlaying && audio.paused) scheduleReconnect();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const action = request?.action;

  if (action === "play") {
    isUserPlaying = true;
    reconnectAttempts = 0;
    cancelReconnect();
    currentStreamUrl = resolveStreamUrl(request.url);
    audio.src = currentStreamUrl;

    audio.volume = normalizeVolume(request.volume, 30);
    sendResponse({ ok: true });
    audio.play().catch((err) => {
      if (err.name === "AbortError") {
        console.log("Radio playback was aborted (likely due to a new stream load or pause command).");
      } else if (err.name === "NotAllowedError") {
        console.warn("Radio autoplay was blocked. User interaction with extension required.");
      } else {
        console.error("Radio play error:", err);
      }
    });

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.metadata = new MediaMetadata({
        // Koristimo poslate prevode jer chrome.i18n ovde ume da zakaze
        title: request.title || 'Radio IN',
        artist: request.artist || 'Pokreće All In One ekstenzija'
      });
    }
    return false;
  } else if (action === "pause") {
    isUserPlaying = false;
    reconnectAttempts = 0;
    cancelReconnect();
    audio.pause();
    // Drop the live stream connection so it stops buffering while paused.
    audio.removeAttribute("src");
    audio.load();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
    sendResponse({ ok: true });
  } else if (action === "setVolume") {
    setRadioVolume(normalizeVolume(request.value, 30));
    sendResponse({ ok: true });
  } else if (action === "playAudio") {
    try {
      const ctx = getAudioContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => { });
      const now = ctx.currentTime;

      if (request.soundType === "success") {
        playSuccessSound(ctx, now);
      } else if (request.soundType === "error") {
        playErrorSound(ctx, now);
      }
      scheduleAudioContextClose();
      sendResponse({ ok: true });
    } catch (err) {
      console.error("playAudio error:", err);
      sendResponse({ ok: false, error: err?.message || "play_audio_failed" });
    }
  }
});
