/**
 * Estrae frame da video/GIF usando ffmpeg
 * Restituisce array di path ai frame estratti
 */

import ffmpeg from 'fluent-ffmpeg';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, generateFileName } from '../utils/helpers.js';

const config = loadConfig();

/**
 * Estrae N frame equidistanti da un video
 * @param {string} videoPath - Path del file video
 * @param {number} maxFrames - Numero massimo di frame (default: 3)
 * @returns {Promise<string[]>} Array di path ai frame estratti
 */
export function extractFrames(videoPath, maxFrames = null) {
  maxFrames = maxFrames || config.vision.maxFrames;

  return new Promise((resolve, reject) => {
    // Ottieni durata del video
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        return reject(new Error(`ffprobe error: ${err.message}`));
      }

      const duration = parseFloat(metadata.format.duration);
      if (!duration || duration === 0) {
        return reject(new Error('Durata video non rilevata'));
      }

      // Calcola intervalli equidistanti
      const interval = duration / maxFrames;
      const framePaths = [];
      let framesExtracted = 0;

      for (let i = 0; i < maxFrames; i++) {
        const timestamp = Math.min(i * interval, duration - 0.1);
        const frameName = generateFileName('frame', 'jpg');
        const framePath = path.join(config.storage.tempDir, frameName);
        framePaths.push(framePath);

        ffmpeg(videoPath)
          .screenshots({
            timestamps: [timestamp],
            filenames: [frameName],
            size: '800x600',
            cwd: config.storage.tempDir
          })
          .on('end', () => {
            framesExtracted++;
            if (framesExtracted === maxFrames) {
              resolve(framePaths);
            }
          })
          .on('error', (ffmpegErr) => {
            // Se un frame fallisce, prova il successivo
            console.warn(`[WARN] Frame a t=${timestamp} fallito: ${ffmpegErr.message}`);
            framesExtracted++;
            if (framesExtracted === maxFrames) {
              // Filtra solo i frame che esistono
              const validPaths = framePaths.filter(p => fs.existsSync(p));
              resolve(validPaths);
            }
          });
      }
    });
  });
}

/**
 * Estrae un singolo frame dal centro del video
 */
export function extractSingleFrame(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = parseFloat(metadata.format.duration);
      const timestamp = duration / 2;
      const frameName = generateFileName('frame', 'jpg');
      const framePath = path.join(config.storage.tempDir, frameName);

      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filenames: [frameName],
          size: '800x600',
          cwd: config.storage.tempDir
        })
        .on('end', () => resolve(framePath))
        .on('error', (ffmpegErr) => reject(ffmpegErr));
    });
  });
}

/**
 * Estrae frame da un'immagine statica (ritorna il path originale)
 */
export function extractFromImage(imagePath) {
  return Promise.resolve([imagePath]);
}
