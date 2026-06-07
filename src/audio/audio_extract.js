/**
 * Estrae audio da video usando ffmpeg
 * Converte il video in un file audio WAV/MP3 per Whisper
 */

import ffmpeg from 'fluent-ffmpeg';
import path from 'node:path';
import { loadConfig, generateFileName } from '../utils/helpers.js';

const config = loadConfig();

/**
 * Estrae traccia audio da un file video
 * @param {string} videoPath - Path del file video
 * @returns {Promise<string>} Path del file audio estratto
 */
export function extractAudioFromVideo(videoPath) {
  return new Promise((resolve, reject) => {
    const audioName = generateFileName('audio_extract', 'wav');
    const audioPath = path.join(config.storage.tempDir, audioName);

    ffmpeg(videoPath)
      .audioFrequency(16000)    // Whisper richiede 16kHz
      .audioChannels(1)         // Mono
      .audioCodec('pcm_s16le')  // WAV PCM
      .toFormat('wav')
      .on('error', (err) => reject(new Error(`ffmpeg extract error: ${err.message}`)))
      .on('end', () => resolve(audioPath))
      .save(audioPath);
  });
}

/**
 * Converte un file audio in formato Whisper (16kHz mono WAV)
 * @param {string} audioPath - Path del file audio originale
 * @returns {Promise<string>} Path del file audio normalizzato
 */
export function normalizeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    const normalizedName = generateFileName('audio_norm', 'wav');
    const normalizedPath = path.join(config.storage.tempDir, normalizedName);

    ffmpeg(audioPath)
      .audioFrequency(16000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .toFormat('wav')
      .on('error', (err) => reject(new Error(`ffmpeg normalize error: ${err.message}`)))
      .on('end', () => resolve(normalizedPath))
      .save(normalizedPath);
  });
}

/**
 * Ottieni durata di un file audio/video
 * @param {string} filePath - Path del file
 * @returns {Promise<number>} Durata in secondi
 */
export function getDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      const duration = parseFloat(metadata.format.duration);
      resolve(isNaN(duration) ? 0 : duration);
    });
  });
}
