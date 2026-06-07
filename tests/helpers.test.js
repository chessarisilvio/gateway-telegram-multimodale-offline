/**
 * Test per src/utils/helpers.js
 * Funzioni pure: loadConfig, ensureTempDir, generateFileName, cleanupTempDir,
 * formatDuration, truncate
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

let helpers;

before(async () => {
  helpers = await import('../src/utils/helpers.js');
});

describe('helpers — loadConfig', () => {
  it('carica config di default correttamente', () => {
    const config = helpers.loadConfig();

    assert.ok(config.telegram, 'telegram config presente');
    assert.ok(config.llm, 'llm config presente');
    assert.ok(config.vision, 'vision config presente');
    assert.ok(config.audio, 'audio config presente');
    assert.ok(config.storage, 'storage config presente');
    assert.strictEqual(config.llm.host, 'http://localhost:8080');
    assert.strictEqual(config.vision.maxFrames, 3);
    assert.strictEqual(config.audio.maxDuration, 60);
    assert.strictEqual(config.storage.retentionMinutes, 30);
  });

  it('non crasha se production.json non esiste', () => {
    const config = helpers.loadConfig();
    assert.ok(config, 'config caricata senza production.json');
  });
});

describe('helpers — generateFileName', () => {
  it('genera nome file con prefisso e estensione', () => {
    const name = helpers.generateFileName('test', 'jpg');

    assert.ok(name.startsWith('test-'), 'inizia con prefisso');
    assert.ok(name.endsWith('.jpg'), 'finisce con estensione');
    assert.ok(name.length > 15, 'contiene timestamp e random');
  });

  it('genera nomi unici', () => {
    const names = new Set();
    for (let i = 0; i < 100; i++) {
      names.add(helpers.generateFileName('x', 'y'));
    }
    assert.strictEqual(names.size, 100, 'tutti i nomi sono unici');
  });
});

describe('helpers — ensureTempDir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-test-'));

  it('crea directory se non esiste', () => {
    const newDir = path.join(tmpDir, 'nuova');
    const result = helpers.ensureTempDir(newDir);

    assert.strictEqual(result, newDir);
    assert.ok(fs.existsSync(newDir), 'directory creata');
  });

  it('non crasha se directory esiste già', () => {
    const result = helpers.ensureTempDir(tmpDir);
    assert.strictEqual(result, tmpDir);
  });
});

describe('helpers — cleanupTempDir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gateway-cleanup-'));

  it('elimina file vecchi', () => {
    helpers.ensureTempDir(tmpDir);

    // Crea file "vecchio" (mtime modificato)
    const oldFile = path.join(tmpDir, 'vecchio.txt');
    fs.writeFileSync(oldFile, 'dati vecchi');
    const oldTime = Date.now() - 60 * 60 * 1000; // 1 ora fa
    fs.utimesSync(oldFile, new Date(oldTime), new Date(oldTime));

    // Crea file "nuovo"
    const newFile = path.join(tmpDir, 'nuovo.txt');
    fs.writeFileSync(newFile, 'dati nuovi');

    helpers.cleanupTempDir(tmpDir, 30 * 60 * 1000); // retention 30 min

    assert.ok(!fs.existsSync(oldFile), 'file vecchio eliminato');
    assert.ok(fs.existsSync(newFile), 'file nuovo conservato');
  });

  it('non elimina nulla se tutti i file sono recenti', () => {
    const testDir = path.join(tmpDir, 'recenti');
    helpers.ensureTempDir(testDir);

    fs.writeFileSync(path.join(testDir, 'a.txt'), 'a');
    fs.writeFileSync(path.join(testDir, 'b.txt'), 'b');

    helpers.cleanupTempDir(testDir, 60 * 60 * 1000); // retention 1 ora

    assert.strictEqual(fs.readdirSync(testDir).length, 2, 'nessun file eliminato');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('helpers — formatDuration', () => {
  it('formatta 0 secondi', () => {
    assert.strictEqual(helpers.formatDuration(0), '0:00');
  });

  it('formatta 45 secondi', () => {
    assert.strictEqual(helpers.formatDuration(45), '0:45');
  });

  it('formatta 125 secondi', () => {
    assert.strictEqual(helpers.formatDuration(125), '2:05');
  });

  it('formatta 3661 secondi', () => {
    assert.strictEqual(helpers.formatDuration(3661), '61:01');
  });

  it('formatta con decimali', () => {
    assert.strictEqual(helpers.formatDuration(60.9), '1:00');
  });
});

describe('helpers — truncate', () => {
  it('non tronca testo corto', () => {
    assert.strictEqual(helpers.truncate('ciao', 10), 'ciao');
  });

  it('tronca testo lungo', () => {
    const result = helpers.truncate('abcdefghij', 7);
    assert.strictEqual(result, 'abcdef...');
  });

  it('usa default 200', () => {
    const lungo = 'a'.repeat(200);
    assert.strictEqual(helpers.truncate(lungo), lungo);
    const troppoLungo = 'a'.repeat(201);
    assert.strictEqual(helpers.truncate(troppoLungo, 200).length, 200);
  });

  it('gestisce testo null', () => {
    assert.strictEqual(helpers.truncate(null), null);
    assert.strictEqual(helpers.truncate(undefined), undefined);
  });
});
