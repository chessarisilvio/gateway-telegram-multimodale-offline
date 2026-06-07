# Gateway Telegram Multimodale Offline

Bot Telegram che processa immagini e audio ricevuti in modo completamente locale,
usando modelli AI open per visione e audio, con routing a il modello configurato per la generazione
di risposte contestuali.

## Architettura

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Telegram Bot API                             │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        src/bot/                                     │
│                   ┌─────────────────────┐                           │
│                   │   Telegram Handler   │                           │
│                   │   (bot/index.js)     │                           │
│                   └──────────┬───────────┘                           │
│                              │                                      │
│              ┌───────────────┼───────────────┐                      │
│              ▼               ▼               ▼                      │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│   │  Photo/Doc   │  │  Audio/Voice │  │   Text/Cmd   │             │
│   │  Processor   │  │  Processor   │  │   Router     │             │
│   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│          │                  │                  │                     │
│          ▼                  ▼                  │                     │
│  ┌─────────────────┐  ┌─────────────────┐     │                     │
│  │ src/vision/     │  │ src/audio/      │     │                     │
│  │ frame_extract.js│  │ whisper_engine.js│     │                     │
│  │                 │  │ audio_extract.js │     │                     │
│  │ moondream.js    │  │                 │     │                     │
│  └────────┬────────┘  └────────┬────────┘     │                     │
│           │                    │               │                     │
│           ▼                    ▼               │                     │
│   ┌─────────────────┐  ┌─────────────────┐    │                     │
│   │  Visual Desc.   │  │  Audio Transcr. │    │                     │
│   │  (moondream     │  │  (Whisper       │  ┌─┴──────────┐         │
│   │   1.4B GGUF)    │  │   large-v3 GGUF)│  │ src/routing│         │
│   └────────┬────────┘  └────────┬────────┘  │  /llm.js  │         │
│            │                    │            └─────┬──────┘         │
│            └────────────────────┴──────────────────┘                │
│                                  │                                  │
│                                  ▼                                  │
│                    ┌─────────────────────────┐                      │
│                    │  src/models/            │                      │
│                    │  qwen36_gateway.js      │                      │
│                    │  (proxy LLM locale)          │                      │
│                    └─────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Pipeline di Elaborazione

### 1. Ricezione (src/bot/)
- Hook su `messageHandler` di openclaw per intercettare nuovi messaggi
- Classificazione del tipo: foto, documento audio, voce, testo, comando
- Download sicuro del file su filesystem locale (tmpfs se disponibile)

### 2. Visione (src/vision/)
- **frame_extract.js**: Estrae frame da video/GIF usando ffmpeg
- **moondream.js**: Carica moondream 1.4B (formato GGUF) e genera descrizioni
  delle immagini in inglese, restituisce testo descrittivo

### 3. Audio (src/audio/)
- **audio_extract.js**: Estrae traccia audio da file video/voice note
- **whisper_engine.js**: Carica Whisper large-v3 (GGUF) per trascrizione
  automatica con rilevamento lingua

### 4. Routing (src/routing/)
- **llm.js**: Combina contesto (testo utente + descrizione immagine + trascrizione)
  e invia richiesta a il modello LLM locale configurato
- Gestione prompt multimodale con istruzioni per integrare i diversi input

### 5. Risposta (src/bot/)
- Invio della risposta generata al canale Telegram
- Supporto per messaggi lunghi (split in chunk)
- Feedback di stato (typing indicator, notifiche elaborazione)

## Struttura Directory

```
gateway-telegram-multimodale-offline/
├── src/
│   ├── bot/              # Handler Telegram (openclaw extension)
│   │   ├── index.js      # Entry point, registro messaggi
│   │   ├── handler.js    # Classificazione e routing messaggi
│   │   └── response.js   # Formattazione e invio risposte
│   ├── vision/           # Pipeline visione
│   │   ├── frame_extract.js  # Estrazione frame da video/GIF
│   │   └── moondream.js      # Inferenza moondream 1.4B
│   ├── audio/            # Pipeline audio
│   │   ├── audio_extract.js  # Estrazione audio da media
│   │   └── whisper_engine.js # Inferenza Whisper large-v3
│   ├── routing/          # Routing a LLM
│   │   └── llm.js            # Costruzione prompt + chiamata il modello configurato
│   └── models/           # Gestione modelli
│       └── qwen36_gateway.js # Wrapper proxy il modello configurato
├── config/
│   └── default.json          # Configurazione di default
├── tests/
│   └── unit/                 # Test unitari
├── docs/
│   └── architecture.md       # Documentazione tecnica dettagliata
├── scripts/
│   └── setup.sh              # Script di setup dipendenze
├── README.md
├── TASK.md
└── package.json
```

## Requisiti di Sistema

| Componente | Requisito | Note |
|-----------|-----------|------|
| CPU | Intel i5-9400F o equivalente | 6 core minimi |
| RAM | 16 GB | 20 GB consigliato |
| GPU CUDA0 | NVIDIA RTX 3050 8GB | Display + sentinel |
| GPU CUDA1 | NVIDIA Tesla P40 24GB | Inferenza modelli |
| Storage | 20 GB liberi | Modelli GGUF + cache |
| Python | 3.12+ | BeeLLama backend |
| Node.js | 18+ | Runtime bot |

## Modelli Richiesti

| Modello | Formato | Dimensione | GPU | Uso |
|---------|---------|-----------|-----|-----|
| moondream 1.4B | GGUF | ~1 GB | P40 | Descrizione immagini |
| Whisper large-v3 | GGUF | ~3 GB | P40 | Trascrizione audio |
| il modello configurato-35B | GGUF | ~20 GB | P40 | Generazione risposte |

## Dipendenze

- **Node.js**: `node-telegram-bot-api` o estensione openclaw
- **Python**: BeeLLama (backend P40), ffmpeg-python
- **Sistema**: ffmpeg, libavcodec, libavformat

## Sicurezza

- Tutti i file processati rimangono in locale (nessun upload esterno)
- Token bot memorizzato in variabile d'ambiente o file `.env`
- Directory temporanea con cleanup automatico
- Validazione input per prevenire path traversal
