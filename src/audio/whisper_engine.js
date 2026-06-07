/**
 * Whisper large-v3 — Trascrizione audio locale
 * Interagisce con un server whisper.cpp o llama.cpp multimodale
 */

import path from 'node:path';
import { loadConfig, truncate } from '../utils/helpers.js';
import { extractAudioFromVideo, normalizeAudio, getDuration } from './audio_extract.js';

const config = loadConfig();

/**
 * Wrapper per inferenza Whisper via API locale
 */
const WHISPER_HOST = process.env.WHISPER_HOST || 'http://localhost:8083';

/**
 * Processa audio (nota vocale, file audio, o audio estratto da video)
 * @param {string} audioPath - Path del file audio
 * @returns {Promise<string>} Trascrizione
 */
export async function processAudio(audioPath) {
  // Controlla durata
  const duration = await getDuration(audioPath);
  if (duration > config.audio.maxDuration) {
    throw new Error(
      `Audio troppo lungo: ${Math.floor(duration)}s (max ${config.audio.maxDuration}s)`
    );
  }

  // Se è un file non-audio (es. video), estrai l'audio
  const isAudioFile = ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus', '.aac'].some(
    ext => path.extname(audioPath).toLowerCase() === ext
  );

  let processedPath = audioPath;
  if (!isAudioFile) {
    processedPath = await extractAudioFromVideo(audioPath);
  }

  // Normalizza a 16kHz mono WAV
  const normalizedPath = await normalizeAudio(processedPath);

  // Trascrivi
  const transcription = await transcribe(normalizedPath);

  return transcription;
}

/**
 * Trascrive un file audio usando Whisper
 * @param {string} audioPath - Path del file audio normalizzato
 * @returns {Promise<string>} Trascrizione
 */
async function transcribe(audioPath) {
  try {
    // Legge il file audio come base64
    const fs = await import('node:fs');
    const audioBuffer = fs.readFileSync(audioPath);
    const base64Audio = audioBuffer.toString('base64');

    // Chiede al server Whisper
    const response = await fetch(`${WHISPER_HOST}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'whisper-large-v3',
        file: `data:audio/wav;base64,${base64Audio}`,
        language: config.audio.language,
        response_format: 'text'
      })
    });

    if (!response.ok) {
      throw new Error(`Whisper API error: ${response.status}`);
    }

    const text = await response.text();
    return text.trim();

  } catch (err) {
    console.error(`[ERROR] Whisper transcribe failed: ${err.message}`);
    return `[Audio processato ma Whisper non disponibile: ${truncate(path.basename(audioPath), 50)}]`;
  }
}

/**
 * Verifica se il server Whisper è raggiungibile
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${WHISPER_HOST}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
