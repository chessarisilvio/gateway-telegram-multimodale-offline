import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

/**
 * Carica la configurazione da config/default.json
 * Sovrascrive con config/production.json se esiste
 */
export function loadConfig() {
  const defaultPath = path.join(rootDir, 'config', 'default.json');
  const prodPath = path.join(rootDir, 'config', 'production.json');

  const config = JSON.parse(fs.readFileSync(defaultPath, 'utf-8'));

  if (fs.existsSync(prodPath)) {
    const prod = JSON.parse(fs.readFileSync(prodPath, 'utf-8'));
    deepMerge(config, prod);
  }

  return config;
}

/**
 * Merge profondo di oggetti
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}

/**
 * Crea la directory temp se non esiste
 */
export function ensureTempDir(tempDir) {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  return tempDir;
}

/**
 * Genera un nome file univoco con timestamp
 */
export function generateFileName(prefix, ext) {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${ts}-${rand}.${ext}`;
}

/**
 * Pulisce file vecchi dalla directory temp
 */
export function cleanupTempDir(tempDir, retentionMs) {
  if (!fs.existsSync(tempDir)) return;

  const now = Date.now();
  const files = fs.readdirSync(tempDir);

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stat = fs.statSync(filePath);
    if (now - stat.mtimeMs > retentionMs) {
      fs.unlinkSync(filePath);
    }
  }
}

/**
 * Formatta durata audio in MM:SS
 */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Tronca testo a N caratteri
 */
export function truncate(text, maxLen = 200) {
  if (!text || text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

export const rootDirPath = rootDir;
