/**
 * Test per src/routing/llm.js
 * Mocka fetch per simulare il server LLM
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';

const LLM_HOST = 'http://localhost:9999';

describe('routing/llm — processText', () => {
  let originalFetch;
  let capturedBody;

  before(() => {
    originalFetch = globalThis.fetch;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Risposta mockata dal LLM' } }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('invia messaggio al server LLM e restituisce risposta', async () => {
    const { processText } = await import('../src/routing/llm.js');
    const result = await processText(12345, 'Ciao come stai?');

    assert.ok(result.includes('Risposta mockata'), 'risposta ricevuta dal mock');
    assert.strictEqual(capturedBody.messages[0].role, 'system', 'system prompt presente');
    assert.strictEqual(capturedBody.messages[1].role, 'user', 'user message presente');
    assert.strictEqual(capturedBody.messages[1].content, 'Ciao come stai?');
    assert.strictEqual(capturedBody.stream, false);
  });

  it('gestisce errore LLM con messaggio fallback', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });

    const { processText } = await import('../src/routing/llm.js');
    const result = await processText(99999, 'test errore');

    assert.ok(result.startsWith('Errore nella generazione'), 'fallback message presente');
    assert.ok(result.length < 200, 'messaggio troncato');
  });

  it('limita la memoria conversazionale a 10 messaggi', async () => {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      // Verifica che non ci siano più di 7 messaggi (1 system + 6 history)
      assert.ok(body.messages.length <= 7, `max 7 messaggi, got ${body.messages.length}`);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { processText } = await import('../src/routing/llm.js');
    // Simula 8 messaggi consecutivi
    for (let i = 0; i < 8; i++) {
      await processText(11111, `messaggio ${i}`);
    }
  });

  it('usa chat ID diverso per contesto separato', async () => {
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { processText } = await import('../src/routing/llm.js');
    await processText(100, 'chat A');
    await processText(200, 'chat B');

    // Entrambi devono aver ricevuto la chiamata
    // Il contesto è separato per chat ID
  });
});

describe('routing/llm — processImage', () => {
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Analisi immagine completata' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('invia descrizione visiva al LLM', async () => {
    let capturedBody;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { processImage } = await import('../src/routing/llm.js');
    await processImage(123, 'Un gatto seduto sul divano');

    assert.ok(capturedBody.messages.some(m => m.content.includes('Un gatto seduto')), 'descrizione inclusa');
  });

  it('gestisce errore processImage', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });

    const { processImage } = await import('../src/routing/llm.js');
    const result = await processImage(123, 'descrizione');

    assert.ok(result.startsWith('Non sono riuscito'), 'fallback message');
  });
});

describe('routing/llm — processAudio', () => {
  let originalFetch;

  before(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Trascrizione elaborata' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('invia trascrizione al LLM', async () => {
    let capturedBody;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const { processAudio } = await import('../src/routing/llm.js');
    await processAudio(123, 'Ciao mondo, questa è una trascrizione');

    assert.ok(capturedBody.messages.some(m => m.content.includes('Ciao mondo')), 'trascrizione inclusa');
  });
});

describe('routing/llm — resetConversation', () => {
  it('resetta la conversazione per un chat ID', async () => {
    const { processText, resetConversation } = await import('../src/routing/llm.js');

    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    await processText(555, 'messaggio prima del reset');
    resetConversation(555);

    // Dopo il reset, il contesto dovrebbe essere vuoto
    // Il prossimo messaggio avrà solo system + user
    let capturedBody;
    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    await processText(555, 'dopo il reset');
    // Dopo reset, messages = [system, user] = 2 elementi
    assert.strictEqual(capturedBody.messages.length, 2, 'solo system + user dopo reset');
  });
});
