/**
 * Qwen3.6 Gateway — Wrapper per chiamate al modello Qwen3.6 35B
 *
 * Questo modulo è un wrapper per interagire con il server BeeLLama
 * che serve il modello Qwen3.6-35B sulla porta :8090.
 *
 * Uso standalone (senza bot Telegram):
 *   const { generate } = require('./src/models/qwen36_gateway.js');
 *   const result = await generate('Cosa vedi in questa immagine?');
 */

import { loadConfig } from '../utils/helpers.js';

const config = loadConfig();

/**
 * Genera una risposta dal modello Qwen3.6
 * @param {string} prompt - Prompt testuale
 * @param {object} options - Opzioni override
 * @returns {Promise<string>} Risposta generata
 */
export async function generate(prompt, options = {}) {
  const messages = [
    { role: 'system', content: options.systemPrompt || 'Sei un assistente utile.' },
    { role: 'user', content: prompt }
  ];

  return callLLM(messages, options);
}

/**
 * Genera risposta con contesto conversazionale
 * @param {Array} history - Array di {role, content}
 * @param {object} options - Opzioni override
 * @returns {Promise<string>} Risposta generata
 */
export async function generateChat(history, options = {}) {
  const messages = [
    { role: 'system', content: options.systemPrompt || 'Sei un assistente utile.' },
    ...history
  ];

  return callLLM(messages, options);
}

/**
 * Chiamata diretta al server LLM
 */
async function callLLM(messages, options = {}) {
  const host = options.host || config.llm.host;
  const model = options.model || config.llm.model;
  const maxTokens = options.maxTokens || config.llm.maxTokens;
  const temperature = options.temperature ?? config.llm.temperature;

  const response = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

/**
 * Health check del server LLM
 */
export async function healthCheck() {
  try {
    const response = await fetch(`${config.llm.host}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
