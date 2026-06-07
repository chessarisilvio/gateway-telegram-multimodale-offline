/**
 * Routing LLM — Invia il contesto a Qwen3.6 per risposta
 * Combina descrizioni visive/audio con il prompt dell'utente
 */

import { loadConfig, truncate } from '../utils/helpers.js';

const config = loadConfig();

/**
 * Stato conversazione per chat (memoria contesto)
 */
const conversationStates = new Map();

/**
 * Processa un messaggio di testo e genera risposta
 * @param {number} chatId - ID chat Telegram
 * @param {string} text - Testo del messaggio
 */
export async function processText(chatId, text) {
  const context = getConversationContext(chatId);
  context.push({ role: 'user', content: text });

  // Costruisci il prompt completo
  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    ...context.slice(-6) // Ultimi 6 messaggi (3 coppie)
  ];

  try {
    const response = await callLLM(messages);

    // Aggiungi risposta al contesto
    context.push({ role: 'assistant', content: response });

    // Limita la memoria a 10 messaggi
    if (context.length > 10) {
      context.splice(0, context.length - 10);
    }

    return response;

  } catch (err) {
    console.error(`[ERROR] LLM call failed: ${err.message}`);
    return `Errore nella generazione della risposta: ${truncate(err.message, 150)}`;
  }
}

/**
 * Processa un'immagine/video e genera risposta contestuale
 * @param {number} chatId - ID chat Telegram
 * @param {string} visualDescription - Descrizione visiva da moondream
 */
export async function processImage(chatId, visualDescription) {
  const context = getConversationContext(chatId);

  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analizza questa immagine:\n\n${visualDescription}` }
  ];

  if (context.length > 0) {
    messages.push(...context.slice(-4));
  }

  try {
    const response = await callLLM(messages);
    context.push({ role: 'assistant', content: response });
    return response;
  } catch (err) {
    console.error(`[ERROR] LLM image response failed: ${err.message}`);
    return `Non sono riuscito a generare una risposta: ${truncate(err.message, 150)}`;
  }
}

/**
 * Processa un'audio trascritto e genera risposta
 * @param {number} chatId - ID chat Telegram
 * @param {string} transcription - Trascrizione Whisper
 */
export async function processAudio(chatId, transcription) {
  const context = getConversationContext(chatId);

  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Trascrizione audio:\n\n${transcription}` }
  ];

  if (context.length > 0) {
    messages.push(...context.slice(-4));
  }

  try {
    const response = await callLLM(messages);
    context.push({ role: 'assistant', content: response });
    return response;
  } catch (err) {
    console.error(`[ERROR] LLM audio response failed: ${err.message}`);
    return `Non sono riuscito a generare una risposta: ${truncate(err.message, 150)}`;
  }
}

/**
 * Costruisce il prompt di sistema
 */
function buildSystemPrompt() {
  return `Sei un assistente utile e conciso che risponde in italiano.
Rispondi in modo chiaro e diretto.
Se l'utente chiede qualcosa che non conosci, ammettilo onestamente.
Non inventare informazioni.`;
}

/**
 * Ottieni o crea il contesto conversazionale
 */
function getConversationContext(chatId) {
  if (!conversationStates.has(chatId)) {
    conversationStates.set(chatId, []);
  }
  return conversationStates.get(chatId);
}

/**
 * Reset conversazione
 */
export function resetConversation(chatId) {
  conversationStates.delete(chatId);
}

/**
 * Chiama il server LLM (Qwen3.6 su :8090)
 */
async function callLLM(messages) {
  const response = await fetch(`${config.llm.host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.model,
      messages,
      max_tokens: config.llm.maxTokens,
      temperature: config.llm.temperature,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}
