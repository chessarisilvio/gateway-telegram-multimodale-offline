/**
 * Classifica i messaggi in arrivo e li instrada al processor corretto
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, generateFileName, truncate } from '../utils/helpers.js';
import { processImage } from '../vision/moondream.js';
import { processAudio } from '../audio/whisper_engine.js';
import { processText } from '../routing/llm.js';

const config = loadConfig();

// MimeType → tipo di processor
const IMAGE_TYPES = ['photo', 'document', 'gif'];
const AUDIO_TYPES = ['audio', 'voice'];
const VIDEO_MIMES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
const AUDIO_MIMES = ['audio/mp4', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/x-matroska'];

/**
 * Handler principale dei messaggi Telegram
 */
export async function messageHandler(msg) {
  const chatId = msg.chat.id;

  // Ignora i propri messaggi
  if (msg.from?.is_bot) return;

  try {
    // 1. Comando /start già gestito in index.js, skip
    if (msg.text?.startsWith('/')) return;

    // 2. Testo normale
    if (msg.text && !msg.photo && !msg.audio && !msg.voice && !msg.video && !msg.document) {
      await processText(chatId, msg.text);
      return;
    }

    // 3. Foto
    if (msg.photo && msg.photo.length > 0) {
      const photo = msg.photo[msg.photo.length - 1]; // la più grande
      const filePath = await downloadFile(chatId, photo.file_id, 'photo');
      await processImage(chatId, filePath);
      return;
    }

    // 4. Nota vocale
    if (msg.voice) {
      const filePath = await downloadFile(chatId, msg.voice.file_id, 'voice');
      await processAudio(chatId, filePath);
      return;
    }

    // 5. Audio (musica, file audio)
    if (msg.audio) {
      const filePath = await downloadFile(chatId, msg.audio.file_id, 'audio');
      await processAudio(chatId, filePath);
      return;
    }

    // 6. Video
    if (msg.video) {
      const filePath = await downloadFile(chatId, msg.video.file_id, 'video');
      await processImage(chatId, filePath, true);
      return;
    }

    // 7. Documento (controlla estensione)
    if (msg.document) {
      const doc = msg.document;
      const fileName = doc.file_name || '';
      const ext = path.extname(fileName).toLowerCase();

      if (AUDIO_MIMES.includes(doc.mime_type) || ['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus'].includes(ext)) {
        const filePath = await downloadFile(chatId, doc.file_id, 'document');
        await processAudio(chatId, filePath);
        return;
      }

      if (VIDEO_MIMES.includes(doc.mime_type) || ['.mp4', '.mov', '.webm', '.mkv'].includes(ext)) {
        const filePath = await downloadFile(chatId, doc.file_id, 'document');
        await processImage(chatId, filePath, true);
        return;
      }

      // Documento non riconosciuto
      await sendMessage(chatId, '⚠️ Tipo di documento non supportato. Supporto: foto, video, audio, note vocali, testo.');
      return;
    }

    // 8. Niente di riconoscibile
    await sendMessage(chatId, '⚠️ Messaggio non riconosciuto. Invia una foto, video, audio, nota vocale o testo.');

  } catch (err) {
    console.error('[ERROR] messageHandler:', err.message);
    await sendMessage(chatId, `❌ Errore: ${truncate(err.message, 150)}`);
  }
}

/**
 * Download file da Telegram
 */
async function downloadFile(chatId, fileId, type) {
  const bot = globalThis._bot; // set da index.js
  if (!bot) throw new Error('Bot non inizializzato');

  const fileInfo = await bot.getFile(fileId);
  const ext = type === 'photo' ? 'jpg' :
              type === 'voice' ? 'ogg' :
              type === 'audio' ? path.extname(fileId) || 'mp4' :
              'mp4';

  const fileName = generateFileName(type, ext);
  const filePath = path.join(config.storage.tempDir, fileName);

  const downloadPath = await bot.getFileStream(fileId);
  const stream = require('fs').createWriteStream(filePath, { fd: downloadPath });

  // node-telegram-bot-api gestisce il download con getFileStream
  // Ma il modo più semplice è:
  const downloadUrl = bot.getFileStream ? null : null;

  // Metodo affidabile: download tramite API diretta
  const { default: axios } = await import('axios');
  const url = `https://api.telegram.org/file/bot${config.telegram.token}/${fileId}`;
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  fs.writeFileSync(filePath, Buffer.from(response.data));

  return filePath;
}

/**
 * Invia messaggio a Telegram (helper)
 */
async function sendMessage(chatId, text) {
  const bot = globalThis._bot;
  if (!bot) return;
  await bot.sendMessage(chatId, text);
}
