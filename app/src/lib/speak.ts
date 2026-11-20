/**
 * Text-to-speech wrapper.
 *
 * Two things make this more than a one-liner around `speechSynthesis`:
 *
 * 1. Chrome silently stops an utterance after roughly 15 seconds. We work around
 *    it by splitting into sentence-sized chunks and queueing them, so long
 *    paragraphs actually get read to the end.
 * 2. `onboundary` gives us character offsets, which is what lets the reading
 *    view highlight the sentence currently being spoken.
 */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoice | null;
}

export interface Speaker {
  speak(text: string, onProgress?: (charIndex: number) => void): void;
  pause(): void;
  resume(): void;
  stop(): void;
  isPaused(): boolean;
  isSupported(): boolean;
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

export function createSpeaker(options: SpeakOptions = {}): Speaker {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

  let queue: string[] = [];
  let cursor = 0;
  let paused = false;
  let speaking = false;
  let progress: ((i: number) => void) | undefined;

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
      }
      window.setTimeout(speakNext, 0);
    };

    speaking = true;
    window.speechSynthesis.speak(utterance);
  };

  return {
    speak(text, onProgress) {
      if (!supported) return;
      stop();
      progress = onProgress;
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
  };
}
