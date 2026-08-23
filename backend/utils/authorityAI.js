// Gemini-backed "area coverage" assistant with a deterministic fallback. The
// API key is read from GEMINI_API_KEY only; never hardcode it in source.

const AUTHORITY_BLUEPRINT = [
  { key: 'roads', department: 'Department of Roads', categories: ['road-damage', 'bridge-damage'] },
  { key: 'disaster', department: 'Disaster Management Authority', categories: ['flood', 'landslide'] },
  { key: 'water', department: 'Water Supply & Sewerage Corporation', categories: ['water-supply', 'drainage'] },
  { key: 'electricity', department: 'Electricity Authority', categories: ['electrical'] },
  { key: 'urban', department: 'Urban Development Dept', categories: ['tunnel-blockage'] },
  { key: 'ward', department: 'Municipal Ward Office', categories: ['other'] },
];

function authorityNameFor(department, district) {
  return district ? `${department} - ${district}` : department;
}

function fallbackSuggestAuthoritiesForArea(district, existingNames = new Set()) {
  const cleanDistrict = (district || '').trim();
  return AUTHORITY_BLUEPRINT
    .map(spec => ({
      name: authorityNameFor(spec.department, cleanDistrict),
      department: spec.department,
      district: cleanDistrict,
      categories: spec.categories,
      source: 'ai',
    }))
    .filter(a => !existingNames.has(a.name));
}

async function suggestAuthoritiesForArea(district, existingNames = new Set()) {
  const cleanDistrict = (district || '').trim();
  const fallback = () => fallbackSuggestAuthoritiesForArea(cleanDistrict, existingNames);
  if (!process.env.GEMINI_API_KEY || typeof fetch !== 'function') return fallback();

  try {
    const prompt = [
      `District: ${cleanDistrict || 'Nepal'}`,
      `Existing authorities: ${[...existingNames].join(', ') || 'none'}`,
      'Return JSON only: an array of missing local public authorities for civic issues.',
      'Each item must have name, department, district, categories.',
      'Use categories from: flood, road-damage, tunnel-blockage, bridge-damage, landslide, drainage, electrical, water-supply, other.',
      'Keep names realistic for Nepal local governance and avoid duplicates.',
    ].join('\n');

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    if (!response.ok) return fallback();
    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    if (!Array.isArray(parsed)) return fallback();
    return parsed
      .map(a => ({
        name: String(a.name || '').trim(),
        department: String(a.department || '').trim(),
        district: String(a.district || cleanDistrict).trim(),
        categories: Array.isArray(a.categories) ? a.categories.filter(Boolean) : [],
        source: 'gemini',
      }))
      .filter(a => a.name && !existingNames.has(a.name));
  } catch {
    return fallback();
  }
}

module.exports = { suggestAuthoritiesForArea, fallbackSuggestAuthoritiesForArea, AUTHORITY_BLUEPRINT };
