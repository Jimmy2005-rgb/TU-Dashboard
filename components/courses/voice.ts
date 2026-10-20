/**
 * Voice notes for the tutor. Browsers record in different formats (WebM/Opus in
 * Chrome, MP4/AAC in Safari), so recordings — and uploaded audio in those
 * formats — are converted to 16 kHz mono WAV, which every AI model accepts.
 * 16 kHz mono is ~1.9 MB per minute.
 */

export const MAX_VOICE_SECONDS = 7 * 60;
const RATE = 16_000;

/** Audio types the AI reads as-is; anything else is converted to WAV first. */
const NATIVE_AUDIO = ["audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/flac", "audio/aac"];

export function needsConversion(mime: string): boolean {
  return mime.startsWith("audio/") && !NATIVE_AUDIO.includes(mime.split(";")[0]);
}

export async function toWav(blob: Blob, name: string): Promise<File> {
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);

  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return new File([view], name.replace(/\.[^.]+$/, "") + ".wav", { type: "audio/wav" });
}

export function formatSeconds(s: number): string {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export interface Recording {
  stop: () => Promise<File | null>;
  cancel: () => void;
  /** 0–1 loudness, for a live level meter. */
  level: () => number;
}

/** Start recording from the microphone. Throws a readable error if the mic isn't available. */
export async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new Error("This browser can't record audio. Try Chrome or Safari, or attach an audio file instead.");
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error("Microphone access was blocked. Allow the mic for this site in your browser settings, then try again.");
  }

  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recorder.start(250);

  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 512;
  audioCtx.createMediaStreamSource(stream).connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  const started = Date.now();

  const release = () => {
    stream.getTracks().forEach((t) => t.stop());
    void audioCtx.close();
  };

  return {
    level() {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      return Math.min(1, Math.sqrt(sum / samples.length) * 4);
    },
    cancel() {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
    stop() {
      return new Promise((resolve, reject) => {
        recorder.onstop = async () => {
          release();
          const seconds = Math.round((Date.now() - started) / 1000);
          if (seconds < 1 || !chunks.length) return resolve(null);
          try {
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            resolve(await toWav(blob, `Voice note ${formatSeconds(seconds).replace(":", "m")}s`));
          } catch {
            reject(new Error("Couldn't process the recording. Try again."));
          }
        };
        recorder.stop();
      });
    },
  };
}
