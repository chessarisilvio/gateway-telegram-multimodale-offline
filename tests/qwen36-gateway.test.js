/**
 * Test per src/models/qwen36_gateway.js
 * Mocka fetch per simulare il server LLM
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('qwen36_gateway — generate', () => {
  let originalFetch;
  let capturedBody;

  before(() => {
    originalFetch = globalThis.fetch;
    capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Risposta generata da Qwen3.6' } }]
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('invia prompt al server LLM', async () => {
    const { generate } = await import('../src/models/qwen36_gateway.js');
    const result = await generate('Cosa sai di Linux?');

    assert.ok(result.includes('Risposta generata'), 'risposta ricevuta');
    assert.strictEqual(capturedBody.messages[0].role, 'system');
    assert.strictEqual(capturedBody.messages[1].role, 'user');
    assert.strictEqual(capturedBody.messages[1].content, 'Cosa sai di Linux?');
  });

  it('usa opzioni custom se fornite', async () => {
    const { generate } = await import('../src/models/qwen36_gateway.js');
    await generate('test', {
      systemPrompt: 'Sei un esperto di motori.',
      maxTokens: 1024,
      temperature: 0.5
    });

    assert.strictEqual(capturedBody.messages[0].content, 'Sei un esperto di motori.');
    assert.strictEqual(capturedBody.max_tokens, 1024);
    assert.strictEqual(capturedBody.temperature, 0.5);
  });

  it('usa valori di default dalla config', async () => {
    const { generate } = await import('../src/models/qwen36_gateway.js');
    await generate('test');

    assert.strictEqual(capturedBody.max_tokens, 2048);
    assert.strictEqual(capturedBody.temperature, 0.7);
    assert.strictEqual(capturedBody.model, 'Qwen3.6-35B-A3B-UD-IQ4_XS.gguf');
  });

  it('gestisce errore HTTP del server', async () => {
    globalThis.fetch = async () => new Response('', { status: 502 });

    const { generate } = await import('../src/models/qwen36_gateway.js');
    await assert.rejects(
      generate('test'),
      /LLM API error: 502/
    );
  });
});

describe('qwen36_gateway — generateChat', () => {
  let originalFetch;
  let capturedBody;

  before(() => {
    originalFetch = globalThis.fetch;
    capturedBody = null;

    globalThis.fetch = async (url, options) => {
      capturedBody = JSON.parse(options.body);
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }]
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it('costruisce messaggio con history', async () => {
    const { generateChat } = await import('../src/models/qwen36_gateway.js');
    const history = [
      { role: 'user', content: 'Ciao' },
      { role: 'assistant', content: 'Salve!' }
    ];
    await generateChat(history);

    assert.strictEqual(capturedBody.messages.length, 3); // system + user + assistant
    assert.strictEqual(capturedBody.messages[1].content, 'Ciao');
    assert.strictEqual(capturedBody.messages[2].content, 'Salve!');
  });

  it('usa systemPrompt custom', async () => {
    const { generateChat } = await import('../src/models/qwen36_gateway.js');
    await generateChat([{ role: 'user', content: 'test' }], {
      systemPrompt: 'Sei un traduttore.'
    });

    assert.strictEqual(capturedBody.messages[0].content, 'Sei un traduttore.');
  });
});

describe('qwen36_gateway — healthCheck', () => {
  let originalFetch;

  it('ritorna true se il server risponde', async () => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response('', { status: 200 });

    const { healthCheck } = await import('../src/models/qwen36_gateway.js');
    const result = await healthCheck();

    assert.strictEqual(result, true);
  });

  it('ritorna false se il server non risponde', async () => {
    globalThis.fetch = async () => { throw new Error('connection refused'); };

    const { healthCheck } = await import('../src/models/qwen36_gateway.js');
    const result = await healthCheck();

    assert.strictEqual(result, false);
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });
});
