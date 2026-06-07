/**
 * Moondream 1.4B — Descrizione visiva locale
 * Carica il modello GGUF e genera descrizioni delle immagini
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, truncate } from '../utils/helpers.js';
import { extractFrames, extractFromImage } from './frame_extract.js';

const config = loadConfig();

/**
 * Wrapper per inferenza con moondream via llama.cpp server
 * Moondream 1.4B gira su un server llama.cpp separato
 */
const MOONDREAM_HOST = process.env.MOONDREAM_HOST || 'http://localhost:8082';

/**
 * Processa un'immagine o video e restituisce la descrizione
 * @param {string} mediaPath - Path del file immagine o video
 * @param {boolean} isVideo - Se è un video (estrae frame)
 * @returns {Promise<string>} Descrizione visiva
 */
export async function processImage(mediaPath, isVideo = false) {
  let imagePaths;

  if (isVideo) {
    imagePaths = await extractFrames(mediaPath);
  } else {
    imagePaths = await extractFromImage(mediaPath);
  }

  if (imagePaths.length === 0) {
    throw new Error('Nessun frame estratto dal media');
  }

  // Genera descrizione per ogni frame
  const descriptions = [];
  for (const imgPath of imagePaths) {
    const desc = await describeImage(imgPath);
    descriptions.push(desc);
  }

  // Combina le descrizioni
  let fullDescription;
  if (descriptions.length === 1) {
    fullDescription = descriptions[0];
  } else {
    fullDescription = descriptions.map((d, i) =>
      `Frame ${i + 1}: ${d}`
    ).join('\n');
  }

  return fullDescription;
}

/**
 * Descrive una singola immagine usando moondream
 * @param {string} imagePath - Path dell'immagine
 * @returns {Promise<string>} Descrizione in italiano
 */
async function describeImage(imagePath) {
  const prompt = `Describe this image in detail. What do you see? Answer in ${config.vision.language}.`;

  try {
    // Legge l'immagine come base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Chiede al server moondream (llama.cpp multimodale)
    const response = await fetch(`${MOONDREAM_HOST}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'moondream-1.4b',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 512,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`Moondream API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();

  } catch (err) {
    console.error(`[ERROR] Moondream describe failed: ${err.message}`);
    // Fallback: descrizione generica
    return `Immagine processata (moondream non disponibile): ${truncate(path.basename(imagePath), 50)}`;
  }
}

/**
 * Verifica se il server moondream è raggiungibile
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${MOONDREAM_HOST}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
