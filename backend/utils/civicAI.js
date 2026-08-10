// Gemini-backed helpers for the civic issue chain: semantic duplicate
// detection, free-text categorization, and Nepali-to-English translation.
// Every function degrades gracefully when GEMINI_API_KEY is missing or the
// API call fails, so the app behaves the same as before AI was added —
// it just gets smarter when a key is configured.

const VALID_CATEGORIES = ['flood', 'road-damage', 'tunnel-blockage', 'bridge-damage', 'landslide', 'drainage', 'electrical', 'water-supply', 'other'];
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

// Devanagari Unicode block — cheap, dependency-free way to detect Nepali
// text before spending an API call on translation.
function looksNepali(text) {
  return /[\u0900-\u097F]/.test(String(text || ''));
}

function hasGemini() {
  return Boolean(process.env.GEMINI_API_KEY) && typeof fetch === 'function';
}

// ---- Embeddings (semantic duplicate detection) ----------------------------

async function embedText(text) {
  const clean = String(text || '').trim();
  if (!clean || !hasGemini()) return null;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: { parts: [{ text: clean.slice(0, 2000) }] } }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const values = data?.embedding?.values;
    return Array.isArray(values) && values.length ? values : null;
  } catch {
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (!magA || !magB) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Given a new report's embedding and a pool of already-fetched candidates
// (each optionally carrying its own stored `embedding`), find the closest
// semantic match. Candidates without a stored embedding are skipped here —
// callers should fall back to word-overlap for those individually so older
// reports (filed before this feature, or filed while Gemini was down)
// aren't silently excluded from dedup.
const SEMANTIC_DUPLICATE_THRESHOLD = 0.86;

function bestSemanticMatch(newEmbedding, candidates, threshold = SEMANTIC_DUPLICATE_THRESHOLD) {
  if (!Array.isArray(newEmbedding) || !newEmbedding.length) return null;
  let best = null, bestScore = 0;
  for (const c of candidates) {
    if (!Array.isArray(c.embedding) || !c.embedding.length) continue;
    const score = cosineSimilarity(newEmbedding, c.embedding);
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return bestScore >= threshold ? best : null;
}

// A citizen describing the same physical problem often picks a different
// category than the next person ("Other" vs "Flood / Waterlogging" for the
// same waterlogged road) — so a cross-category match needs stronger evidence
// than a same-category one before we merge two reports together.
const CROSS_CATEGORY_DUPLICATE_THRESHOLD = 0.92;

// ---- Free-text categorization + translation --------------------------------

function fallbackClassify(text) {
  const clean = String(text || '').trim();
  return {
    category: null,
    severity: 'medium',
    title: clean.slice(0, 80),
    translatedText: '',
    language: looksNepali(clean) ? 'ne' : 'en',
  };
}

// Used for SMS reports (no category picker) and to enrich any report whose
// description is in Nepali with an English translation staff can read.
async function classifyFreeText(text) {
  const clean = String(text || '').trim();
  if (!clean) return fallbackClassify(clean);
  if (!hasGemini()) return fallbackClassify(clean);

  try {
    const prompt = [
      'You triage civic issue reports for a Nepali municipal accountability app.',
      `Report text: """${clean.slice(0, 1000)}"""`,
      `Pick the single best category from exactly this list: ${VALID_CATEGORIES.join(', ')}.`,
      `Pick a severity from exactly this list: ${VALID_SEVERITIES.join(', ')}.`,
      'Write a short English title (max 10 words).',
      'If the report text is not already in English, translate it to plain English; otherwise leave translatedText empty.',
      'Detect the language as an ISO 639-1 code (e.g. "ne" for Nepali, "en" for English).',
      'Return JSON only, no markdown fences, matching exactly: {"category":"","severity":"","title":"","translatedText":"","language":""}',
    ].join('\n');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) return fallbackClassify(clean);
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

    const category = VALID_CATEGORIES.includes(parsed.category) ? parsed.category : null;
    const severity = VALID_SEVERITIES.includes(parsed.severity) ? parsed.severity : 'medium';
    return {
      category,
      severity,
      title: String(parsed.title || '').trim().slice(0, 80) || clean.slice(0, 80),
      translatedText: String(parsed.translatedText || '').trim(),
      language: String(parsed.language || '').trim().toLowerCase() || (looksNepali(clean) ? 'ne' : 'en'),
    };
  } catch {
    return fallbackClassify(clean);
  }
}

module.exports = {
  hasGemini,
  looksNepali,
  embedText,
  cosineSimilarity,
  bestSemanticMatch,
  classifyFreeText,
  SEMANTIC_DUPLICATE_THRESHOLD,
  CROSS_CATEGORY_DUPLICATE_THRESHOLD,
  VALID_CATEGORIES,
};