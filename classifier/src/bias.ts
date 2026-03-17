import axios from 'axios';

const OLLAMA_BASE  = process.env.OLLAMA_BASE_URL ?? 'http://ollama:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL    ?? 'llama3.2';
const CLAUDE_KEY   = process.env.CLAUDE_API_KEY  ?? '';

export type BiasTag = 'left' | 'center-left' | 'center' | 'center-right' | 'right' | 'unknown';
export type ContentTags = string[];

// ---------------------------------------------------------------------------
// AI Writing Trope Detector
// Each entry is one trope *category* from TROPES.md.  A category scores when
// any of its patterns match the article text.  The final score is what
// percentage of the ~22 categories fired, mapped to 0-100.
// ---------------------------------------------------------------------------

const TROPE_CATEGORIES: RegExp[] = [
  // 1. Magic adverbs
  /\b(quietly|deeply|fundamentally|remarkably|arguably)\b/i,
  // 2. Delve family
  /\b(delve|certainly|utilize|leverage|robust|streamline|harness)\b/i,
  // 3. Ornate nouns – tapestry / landscape
  /\b(tapestry|paradigm|synergy|ecosystem)\b/i,
  // 4. "Serves as" dodge
  /\b(serves as|stands as)\b/i,
  // 5. Negative parallelism  — "It's not X — it's Y"
  /\bit'?s not\b[^.!?]{0,80}[-–—][^.!?]{0,80}\bit'?s\b/i,
  // 6. Self-posed rhetorical questions "The result? Devastating."
  /[A-Z][^.!?]{2,60}\?\s+[A-Z][^.!?]{1,60}\./,
  // 7. It's worth noting / filler transitions (trailing \b omitted — some alternatives end with a comma)
  /\b(it'?s worth noting|it bears mentioning|importantly,|interestingly,|notably,)/i,
  // 8. Superficial -ing analysis phrases
  /\b(highlighting its|reflecting broader|contributing to the|underscoring its)\b/i,
  // 9. "Here's the kicker" fake-suspense
  /\bhere'?s (the kicker|the thing|where it gets|what most people|the deal|the start)\b/i,
  // 10. "Think of it as / like"
  /\bthink of it (as|like)\b/i,
  // 11. "Imagine a world where"
  /\bimagine (a world|if)\b/i,
  // 12. False vulnerability – "And yes,"
  /\band yes,/i,
  // 13. "The truth is simple" variants
  /\b(the reality is (simpler|simple)|history is (clear|unambiguous)|the truth is (simple|clear))\b/i,
  // 14. Grandiose stakes inflation
  /\b(fundamentally reshape|define the next era|redefine the future|something entirely new|will define the)\b/i,
  // 15. "Let's break this down" pedagogical voice
  /\blet'?s (break this down|unpack|dive in|explore this)\b/i,
  // 16. Vague attributions
  /\b(experts argue|experts say|industry reports (suggest|show)|observers have (cited|noted)|several publications)\b/i,
  // 17. "Despite its/these challenges" formula
  /\bdespite (its|these|their) (challenges|limitations|drawbacks)\b/i,
  // 18. Signposted conclusions
  /\b(in conclusion,?|to sum up,?|in summary,?)\b/i,
  // 19. Em-dash addiction — 3 or more in the text
  /(?:—|–){3}/,
  // 20. Bold-first bullets (markdown **)
  /^\s*\*\*[A-Z]/m,
  // 21. Listicle in a trench coat
  /\bthe (first|second|third) (wall|point|takeaway|reason|step)\b/i,
  // 22. Anaphora abuse — same short opener repeated 3+ times
  /\b(they (assume|could|have built)|we (need|must|should))[^.!?]+[.!?][^.!?]+\b\1\b/i,
];

const TROPE_CATEGORY_COUNT = TROPE_CATEGORIES.length;

/**
 * Returns an integer 0–100 representing how AI-trope-heavy the text is.
 * Each trope category that fires adds (100 / total categories) points.
 */
export function detectTropes(text: string): number {
  if (!text || text.length < 20) return 0;
  let hits = 0;
  for (const pattern of TROPE_CATEGORIES) {
    if (pattern.test(text)) hits++;
  }
  return Math.min(100, Math.round((hits / TROPE_CATEGORY_COUNT) * 100));
}

const BIAS_LABELS: BiasTag[] = ['left','center-left','center','center-right','right','unknown'];

const DEFAULT_TAGS = [
  'politics','world','nz','au','us','uk','tech','business','science',
  'health','sport','climate','crime','entertainment','opinion','finance','economy',
  'iran','war','middle-east','russia','ukraine','china','military','energy','elections','conflict',
];

function buildSystemPrompt(validTags: string[]): string {
  const tagList = validTags.join(', ');
  return `You are a news article classifier.
Given an article title and summary, return a JSON object with exactly two fields:
1. "bias": political leaning - one of: left, center-left, center, center-right, right, unknown
2. "tags": array of 1-4 topic tags chosen ONLY from: ${tagList}

Return ONLY valid JSON. No explanation, no markdown, no extra text.
Example: {"bias":"center","tags":["politics","world"]}`;
}

export interface Classification {
  bias: BiasTag;
  tags: ContentTags;
  trope_score: number;
}

function parseClassification(raw: string, validTagSet: Set<string>): Classification {
  // Try to extract JSON from the response
  const jsonMatch = raw.match(/\{[^}]+\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const bias = BIAS_LABELS.find(l => String(parsed.bias ?? '').toLowerCase().includes(l)) ?? 'unknown';
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags
            .filter((t: unknown) => typeof t === 'string' && validTagSet.has(t.toLowerCase()))
            .map((t: string) => t.toLowerCase())
            .slice(0, 4)
        : [];
      return { bias, tags, trope_score: 0 };
    } catch { /* fall through to plain-text parse */ }
  }
  // Fallback: treat as plain bias label only
  const clean = raw.toLowerCase().trim().replace(/[^a-z-]/g, '');
  const bias = BIAS_LABELS.find(l => clean.includes(l)) ?? 'unknown';
  return { bias, tags: [], trope_score: 0 };
}

async function classifyWithOllama(title: string, summary: string, validTags: string[]): Promise<Classification> {
  const prompt     = `Title: ${title}\nSummary: ${summary}\n\nClassify:`;
  const system     = buildSystemPrompt(validTags);
  const validTagSet = new Set(validTags);
  const resp       = await axios.post(
    `${OLLAMA_BASE}/api/generate`,
    { model: OLLAMA_MODEL, prompt, system, stream: false },
    { timeout: 45000 },
  );
  return parseClassification((resp.data as { response: string }).response, validTagSet);
}

async function classifyWithClaude(title: string, summary: string, validTags: string[]): Promise<Classification> {
  const system     = buildSystemPrompt(validTags);
  const validTagSet = new Set(validTags);
  const resp = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model:      'claude-haiku-20240307',
      max_tokens: 80,
      system,
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
  return parseClassification(content[0]?.text ?? '', validTagSet);
}

/**
 * Classify an article's political bias and content topics, and score AI-writing tropes.
 * Tries Ollama first, falls back to Claude API if configured.
 * Trope detection is regex-based and always runs regardless of LLM availability.
 * @param customTags - override the tag list (loaded from DB); falls back to DEFAULT_TAGS
 * @param tropeText  - optional full article text to use for trope detection instead of title+summary
 */
export async function classifyArticle(
  title: string,
  summary: string,
  customTags: string[] = DEFAULT_TAGS,
  tropeText?: string,
): Promise<Classification> {
  const trope_score = detectTropes(tropeText ?? `${title} ${summary}`);

  if (OLLAMA_BASE) {
    try {
      const result = await classifyWithOllama(title, summary, customTags);
      return { ...result, trope_score };
    } catch (err) {
      console.warn('[classifier] Ollama failed, trying Claude:', (err as Error).message);
    }
  }

  if (CLAUDE_KEY) {
    try {
      const result = await classifyWithClaude(title, summary, customTags);
      return { ...result, trope_score };
    } catch (err) {
      console.error('[classifier] Claude API failed:', (err as Error).message);
    }
  }

  return { bias: 'unknown', tags: [], trope_score };
}

export { DEFAULT_TAGS };

/** Backward-compat export */
export async function classifyBias(title: string, summary: string): Promise<BiasTag> {
  return (await classifyArticle(title, summary)).bias;
}
