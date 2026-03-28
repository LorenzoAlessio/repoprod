const AVG_CHARS_PER_TOKEN = 4;
const MAX_TOKENS = 3500;
const MAX_CHARS = MAX_TOKENS * AVG_CHARS_PER_TOKEN;

const WHATSAPP_RE = /^\[?\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\]?\s*[-–—]?\s*/;
const TELEGRAM_SENDER_RE = /^[A-Za-zÀ-ÿ\s]+:\s/;

function splitIntoMessages(text) {
  const lines = text.split('\n');
  const messages = [];
  let current = '';

  for (const line of lines) {
    if (WHATSAPP_RE.test(line) || TELEGRAM_SENDER_RE.test(line)) {
      if (current.trim()) messages.push(current.trim());
      current = line;
    } else {
      current += '\n' + line;
    }
  }
  if (current.trim()) messages.push(current.trim());

  return messages.length > 0 ? messages : [text];
}

function splitBySentences(text) {
  return text.split(/(?<=[.!?])\s+/).filter(s => s.trim());
}

export function chunkText(text) {
  const messages = splitIntoMessages(text);
  const chunks = [];
  let currentChunk = '';

  for (const msg of messages) {
    if (msg.length > MAX_CHARS) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const sentences = splitBySentences(msg);
      let sentenceChunk = '';
      for (const sent of sentences) {
        if ((sentenceChunk + '\n' + sent).length > MAX_CHARS) {
          if (sentenceChunk.trim()) chunks.push(sentenceChunk.trim());
          sentenceChunk = sent;
        } else {
          sentenceChunk += (sentenceChunk ? '\n' : '') + sent;
        }
      }
      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
      }
    } else if ((currentChunk + '\n' + msg).length > MAX_CHARS) {
      chunks.push(currentChunk.trim());
      currentChunk = msg;
    } else {
      currentChunk += (currentChunk ? '\n' : '') + msg;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks.length > 0 ? chunks : [text];
}
