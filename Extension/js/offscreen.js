const DEFAULT_STREAM_URL = "https://radioinnis-naxinacional.streaming.rs:8622/;stream.nsv";
const audio = new Audio();
let currentStreamUrl = "";
let audioCtx = null;
let sfxCompressor = null;
let sfxOutput = null;
let audioCtxCloseTimer = null;

function safeSendRuntimeMessage(payload) {
  if (!chrome?.runtime?.id) return;

  try {
    const maybePromise = chrome.runtime.sendMessage(payload);
    if (maybePromise && typeof maybePromise.catch === "function") {
      maybePromise.catch(() => { });
    }
  } catch (_) {
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

audio.addEventListener("play", () => updateRadioStatus(true));
audio.addEventListener("pause", () => updateRadioStatus(false));
audio.addEventListener("ended", () => updateRadioStatus(false));
audio.addEventListener("error", () => updateRadioStatus(false));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const action = request?.action;

  if (action === "play") {
    currentStreamUrl = request.url && request.url.trim() ? request.url.trim() : DEFAULT_STREAM_URL;
    audio.src = currentStreamUrl;

    const vol = request.volume !== undefined ? request.volume / 100 : 0.30;
    const normalized = Math.max(0, Math.min(1, vol));
    audio.volume = normalized;
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
    audio.pause();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = "paused";
    }
    sendResponse({ ok: true });
  } else if (action === "setVolume") {
    const vol = request.value / 100;
    const normalized = Math.max(0, Math.min(1, vol));
    setRadioVolume(normalized);
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
