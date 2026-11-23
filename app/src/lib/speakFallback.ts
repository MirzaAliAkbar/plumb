import meSpeak from 'mespeak';
// Imported as raw text so the bundler ships them verbatim and TypeScript does
// not need JSON-module resolution for a package subpath.
import configRaw from 'mespeak/src/mespeak_config.json?raw';
import voiceRaw from 'mespeak/voices/en/en-us.json?raw';

/**
 * Offline text-to-speech with no system dependency.
 *
 * The Web Speech API is used when the platform has a voice, but on Linux (and
 * any machine without speech-dispatcher/espeak) it silently has none. This
 * module is the fallback: eSpeak compiled to JS via `mespeak`, synthesising a
 * WAV in the page and playing it through an <audio> element. It needs no
 * install, no network, and no account — the text never leaves the device.
 *
 * The config and voice are loaded once, lazily, on first synthesis.
 */

let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  meSpeak.loadConfig(JSON.parse(configRaw));
  meSpeak.loadVoice(JSON.parse(voiceRaw));
  loaded = true;
}

/**
 * Synthesise one chunk of text to an in-memory WAV blob.
 *
 * `rate` follows the Web Speech API's convention (1 = normal); it is mapped to
 * eSpeak's words-per-minute and clamped to a range that stays intelligible.
 */
export function synthesize(text: string, rate = 1): Blob {
  ensureLoaded();
  const speed = Math.max(90, Math.min(400, Math.round(175 * (rate || 1))));
  const data = meSpeak.speak(text, { rawdata: 'array', speed }) as number[];
  const bytes = Uint8Array.from(data);
  return new Blob([bytes], { type: 'audio/wav' });
}