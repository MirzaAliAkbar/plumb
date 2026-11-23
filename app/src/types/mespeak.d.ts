/**
 * Minimal typings for `mespeak` (eSpeak compiled to JS), which ships no types.
 * Only the surface this app uses is declared.
 */
declare module 'mespeak' {
  export interface SpeakOptions {
    /** Return data instead of playing. `'array'` yields a WAV byte array. */
    rawdata?: boolean | 'array' | 'base64' | 'buffer' | 'mime' | 'data-url';
    /** Words per minute (default 175). */
    speed?: number;
    pitch?: number;
    amplitude?: number;
    voice?: string;
    wordgap?: number;
    volume?: number;
  }

  const meSpeak: {
    loadConfig(config: unknown): void;
    loadVoice(voice: unknown): void;
    speak(
      text: string,
      options?: SpeakOptions,
    ): number[] | string | ArrayBuffer;
  };

  export default meSpeak;
}