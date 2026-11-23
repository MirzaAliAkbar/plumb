/**
 * Text-to-speech wrapper.
 *
 * Three things make this more than a one-liner around `speechSynthesis`:
 *
 * 1. Chrome silently stops an utterance after roughly 15 seconds. We work around
 *    it by splitting into sentence-sized chunks and queueing them, so long
 *    paragraphs actually get read to the end.
 * 2. `onboundary` gives us character offsets, which is what lets the reading
 *    view highlight the sentence currently being spoken.
 * 3. The Web Speech API has no voice at all on many Linux systems (no
 *    speech-dispatcher/espeak), where `speak()` silently does nothing. When that
 *    happens we fall back to a bundled eSpeak synthesizer (`speakFallback`), so
 *    read-aloud works with no system setup and still offline.
 */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoice | null;
}

export interface Speaker {
  speak(
    text: string,
    onProgress?: (charIndex: number) => void,
    onError?: (message: string) => void,
  ): void;
  pause(): void;
  resume(): void;
  stop(): void;
  isPaused(): boolean;
  isSupported(): boolean;
  /** Whether audio can actually be produced (native voice or bundled fallback). */
  hasVoice(): boolean;
  /** Subscribe to native voice-list changes; returns an unsubscribe function. */
  onVoicesChanged(listener: () => void): () => void;
}

/** Split into sentences without breaking on abbreviations or decimals. */
export function chunkSentences(text: string, maxLen = 220): string[] {
  const rough = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'([])/u)
    .map((s) => s.trim())
    .filter(Boolean);

  const out: string[] = [];
  for (const sentence of rough) {
    if (sentence.length <= maxLen) {
      out.push(sentence);
      continue;
    }
    // Fall back to clause boundaries, then hard-wrap, so a single huge sentence
    // cannot reintroduce the Chrome cutoff.
    let rest = sentence;
    while (rest.length > maxLen) {
      const window = rest.slice(0, maxLen);
      const cut = Math.max(
        window.lastIndexOf('; '),
        window.lastIndexOf(', '),
        window.lastIndexOf(' — '),
        window.lastIndexOf(' '),
      );
      const at = cut > maxLen * 0.4 ? cut + 1 : maxLen;
      out.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

/** The platform's own speech synthesis, used whenever it has a voice. */
function createNativeSpeaker(options: SpeakOptions): Speaker {
  const supported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window;

  let queue: string[] = [];
  let cursor = 0;
  let paused = false;
  let speaking = false;
  let progress: ((i: number) => void) | undefined;
  let error: ((message: string) => void) | undefined;

  const stop = () => {
    queue = [];
    cursor = 0;
    speaking = false;
    paused = false;
    if (supported) window.speechSynthesis.cancel();
  };

  const speakNext = () => {
    if (!supported || paused) return;
    const next = queue.shift();
    if (next === undefined) {
      speaking = false;
      return;
    }

    const base = cursor;
    cursor += next.length + 1;

    const utterance = new SpeechSynthesisUtterance(next);
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    if (options.voice) utterance.voice = options.voice;

    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.charIndex >= 0) {
        progress?.(base + event.charIndex);
      }
    };
    utterance.onend = () => {
      // A zero-delay hop keeps Chrome's queue healthy between chunks.
      window.setTimeout(speakNext, 0);
    };
    utterance.onerror = (event) => {
      // 'interrupted' / 'canceled' fire on normal stop; not worth reporting.
      if (event.error !== 'interrupted' && event.error !== 'canceled') {
        console.warn('[plumb] speech error:', event.error);
        error?.('The speech voice could not play this text.');
      }
      window.setTimeout(speakNext, 0);
    };

    speaking = true;
    window.speechSynthesis.speak(utterance);
  };

  return {
    speak(text, onProgress, onError) {
      if (!supported) return;
      stop();
      progress = onProgress;
      error = onError;
      queue = chunkSentences(text);
      speakNext();
    },
    pause() {
      if (!supported || !speaking) return;
      paused = true;
      window.speechSynthesis.pause();
    },
    resume() {
      if (!supported) return;
      if (paused) {
        paused = false;
        window.speechSynthesis.resume();
        if (!speaking) speakNext();
      }
    },
    stop,
    isPaused: () => paused,
    isSupported: () => supported,
    hasVoice: () => supported && window.speechSynthesis.getVoices().length > 0,
    onVoicesChanged(listener) {
      if (!supported) return () => {};
      const synth = window.speechSynthesis;
      synth.addEventListener('voiceschanged', listener);
      return () => synth.removeEventListener('voiceschanged', listener);
    },
  };
}

/**
 * The bundled eSpeak fallback, used only when the platform has no voice.
 *
 * Each sentence is synthesised to a WAV blob on demand and played through an
 * <audio> element. Progress is approximated from playback time, since there are
 * no word-boundary events.
 */
function createLocalSpeaker(options: SpeakOptions): Speaker {
  const isSupported = () =>
    typeof window !== 'undefined' &&
    typeof Audio !== 'undefined' &&
    typeof Blob !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function';

  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let queue: string[] = [];
  let cursor = 0;
  let paused = false;
  let stopped = false;
  let progress: ((i: number) => void) | undefined;
  let error: ((message: string) => void) | undefined;

  const clearAudio = () => {
    if (audio) {
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.onerror = null;
      audio.pause();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  };

  const stop = () => {
    stopped = true;
    queue = [];
    cursor = 0;
    paused = false;
    clearAudio();
  };

  const playNext = async () => {
    if (stopped || paused) return;
    const next = queue.shift();
    if (next === undefined) return;

    const base = cursor;
    cursor += next.length + 1;

    try {
      const { synthesize } = await import('./speakFallback');
      if (stopped) return;
      const blob = synthesize(next, options.rate ?? 1);
      if (stopped) return;

      clearAudio();
      objectUrl = URL.createObjectURL(blob);
      const el = new Audio(objectUrl);
      audio = el;

      el.ontimeupdate = () => {
        if (!Number.isFinite(el.duration) || el.duration <= 0) return;
        const frac = Math.min(1, el.currentTime / el.duration);
        progress?.(base + Math.floor(frac * next.length));
      };
      el.onended = () => {
        if (audio !== el) return;
        clearAudio();
        void playNext();
      };
      el.onerror = () => {
        if (audio !== el) return;
        error?.('Read-aloud could not play this text.');
        clearAudio();
      };

      await el.play().catch(() => {
        error?.('Read-aloud was blocked by the browser. Press Read aloud again.');
      });
      if (paused) el.pause();
    } catch {
      error?.('Read-aloud could not start.');
    }
  };

  return {
    speak(text, onProgress, onError) {
      stop();
      stopped = false;
      progress = onProgress;
      error = onError;
      queue = chunkSentences(text);
      void playNext();
    },
    pause() {
      if (!audio || paused) return;
      paused = true;
      audio.pause();
    },
    resume() {
      if (!paused) return;
      paused = false;
      if (audio) void audio.play().catch(() => {});
      else void playNext();
    },
    stop,
    isPaused: () => paused,
    isSupported,
    hasVoice: () => isSupported(),
    onVoicesChanged: () => () => {},
  };
}

/**
 * The speaker the app uses: the platform voice when one exists, otherwise the
 * bundled eSpeak fallback. Callers can use it unconditionally.
 */
export function createSpeaker(options: SpeakOptions = {}): Speaker {
  const native = createNativeSpeaker(options);
  const local = createLocalSpeaker(options);
  let active: Speaker = native;

  return {
    speak(text, onProgress, onError) {
      active = native.hasVoice() ? native : local;
      active.speak(text, onProgress, onError);
    },
    pause() {
      active.pause();
    },
    resume() {
      active.resume();
    },
    stop() {
      native.stop();
      local.stop();
    },
    isPaused: () => active.isPaused(),
    isSupported: () => native.isSupported() || local.isSupported(),
    hasVoice: () => native.hasVoice() || local.isSupported(),
    onVoicesChanged: (listener) => native.onVoicesChanged(listener),
  };
}