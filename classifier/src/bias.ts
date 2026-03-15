import axios from 'axios';

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? 'llama3.2';
const CLAUDE_KEY   = process.env.CLAUDE_API_KEY  ?? '';

export type BiasTag = 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'unknown';

const BIAS_LABELS: BiasTag[] = ['left','center-left','center','center-right','right','unknown'];

const SYSTEM_PROMPT = `You are a political bias classifier for news articles.
Given an article title and summary, classify the political leaning of the article's framing.
Respond with ONLY one of these labels (no explanation):
left, center-left, center, center-right, right, unknown

Use "unknown" if the article is a technology or science story with no political dimension.`;

function extractBias(raw: string): BiasTag {
  const clean = raw.toLowerCase().trim().replace(/[^a-z-]/g, '');
  const found = BIAS_LABELS.find(l => clean.includes(l));
  return found ?? 'unknown';
}

async function classifyWithOllama(title: string, summary: string): Promise<BiasTag> {
  const prompt = `Title: ${title}\nSummary: ${summary}\n\nClassify:`;
  const resp   = await axios.post(
    `${OLLAMA_BASE}/api/generate`,
    { model: OLLAMA_MODEL, prompt, system: SYSTEM_PROMPT, stream: false },
    { timeout: 30000 },
  );
  return extractBias((resp.data as { response: string }).response);
}

async function classifyWithClaude(title: string, summary: string): Promise<BiasTag> {
  const resp = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model:      'claude-haiku-20240307',
      max_tokens: 10,
      system:     SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Title: ${title}\nSummary: ${summary}\n\nClassify:` }],
    },
    {
      headers: {
        'x-api-key':         CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      timeout: 15000,
    },
  );
  const content = (resp.data as { content: Array<{ text: string }> }).content;
  return extractBias(content[0]?.text ?? '');
}

/**
 * Classify an article's political bias.
 * Tries Ollama first, falls back to Claude API if configured.
 */
export async function classifyBias(title: string, summary: string): Promise<BiasTag> {
  if (OLLAMA_BASE) {
    try {
      return await classifyWithOllama(title, summary);
    } catch (err) {
      console.warn('[classifier] Ollama failed, trying Claude:', (err as Error).message);
    }
  }

  if (CLAUDE_KEY) {
    try {
      return await classifyWithClaude(title, summary);
    } catch (err) {
      console.error('[classifier] Claude API failed:', (err as Error).message);
    }
  }

  return 'unknown';
}
