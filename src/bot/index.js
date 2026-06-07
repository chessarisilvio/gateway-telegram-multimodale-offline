/**
 * Gateway Telegram Multimodale Offline
 * Entry point — avvia il bot e gestisce il ciclo di vita
 */

import TelegramBot from 'node-telegram-bot-api';
import { loadConfig, ensureTempDir, cleanupTempDir } from '../utils/helpers.js';
import { messageHandler } from './messageHandler.js';

let config;
let bot;
let tempDir;
let cleanupTimer;

/**
 * Inizializza il bot Telegram
 */
export function init() {
  config = loadConfig();

  if (!config.telegram.token) {
    console.error('[FATAL] Token Telegram non configurato in config/default.json');
    process.exit(1);
  }

  // Directory temp
  tempDir = ensureTempDir(config.storage.tempDir);
  console.log(`[INFO] Temp directory: ${tempDir}`);

  // Cleanup periodico (ogni 10 minuti)
  const retentionMs = config.storage.retentionMinutes * 60 * 1000;
  cleanupTimer = setInterval(() => {
    cleanupTempDir(tempDir, retentionMs);
  }, 10 * 60 * 1000);

  // Bot Telegram
  bot = new TelegramBot(config.telegram.token, { polling: true });

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '🤖 Gateway Multimodale Offline\n\n' +
      'Invia foto, video, audio o note vocali e riceverai una risposta AI generata localmente.\n\n' +
      'Comandi:\n' +
      '/start — Mostra questo messaggio\n' +
      '/help — Guida\n' +
      '/status — Stato del sistema\n' +
      '/reset — Reset conversazione'
    );
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '📖 Guida\n\n' +
      'Questo bot processa i tuoi media in locale usando AI open.\n\n' +
      '📷 Foto → Descrizione visiva con moondream 1.4B\n' +
      '🎬 Video → Frame estratti + descrizione\n' +
      '🎵 Audio/Note vocali → Trascrizione con Whisper\n' +
      '💬 Testo → Risposta diretta con Qwen3.6\n\n' +
      'Tutto avviene in locale, nessun dato esce dal tuo PC.'
    );
  });

  bot.onText(/\/status/, (msg) => {
    bot.sendMessage(msg.chat.id,
      '✅ Sistema operativo\n' +
      '📷 Visione: moondream 1.4B\n' +
      '🎵 Audio: Whisper large-v3\n' +
      '🧠 LLM: Qwen3.6 35B (:8090)\n' +
      '💾 Temp: ' + config.storage.tempDir
    );
  });

  bot.onText(/\/reset/, (msg) => {
    bot.sendMessage(msg.chat.id, 'Conversazione resettata.');
  });

  // Hook principale su tutti i messaggi
  bot.on('message', messageHandler);

  console.log('[INFO] Bot Telegram avviato — polling attivo');
}

/**
 * Arresta pulitamente il bot
 */
export function shutdown() {
  console.log('[INFO] Arresto in corso...');
  if (cleanupTimer) clearInterval(cleanupTimer);
  if (bot) bot.stopPolling();
  console.log('[INFO] Bot arrestato');
  process.exit(0);
}

// Gestione segnali
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Avvio
init();
