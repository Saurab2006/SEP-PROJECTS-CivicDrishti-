// SMS reporting fallback for citizens without reliable internet access.
//
// Two directions:
//   INBOUND  — a carrier (Twilio or equivalent) POSTs an incoming SMS to
//              /api/sms/inbound. We parse a simple keyword grammar and turn
//              it into the same report/status actions the web app uses.
//   OUTBOUND — sendSms() pushes a confirmation/status text back to the
//              citizen. It's a thin wrapper: if TWILIO_* env vars are set it
//              calls the real Twilio REST API, otherwise it logs the
//              message so the flow works end-to-end in local/demo mode
//              without a paid SMS account.
//
// Message grammar (case-insensitive, whitespace-tolerant):
//   REPORT <category> <district> | <free text description>
//     e.g. "REPORT road-damage Kathmandu | Pothole outside ward office"
//   STATUS <report-id-or-last6>
//     e.g. "STATUS a1b2c3" or just "STATUS" for the sender's most recent report
//   HELP
//     returns the list of supported categories and commands

const CATEGORY_ALIASES = {
  flood: 'flood', flooding: 'flood', waterlogging: 'flood',
  road: 'road-damage', 'road-damage': 'road-damage', pothole: 'road-damage',
  tunnel: 'tunnel-blockage', 'tunnel-blockage': 'tunnel-blockage',
  bridge: 'bridge-damage', 'bridge-damage': 'bridge-damage',
  landslide: 'landslide',
  drainage: 'drainage', sewer: 'drainage', sewerage: 'drainage',
  electrical: 'electrical', electricity: 'electrical', power: 'electrical',
  water: 'water-supply', 'water-supply': 'water-supply',
  other: 'other',
};

const VALID_CATEGORIES = Object.freeze([
  'flood', 'road-damage', 'tunnel-blockage', 'bridge-damage', 'landslide',
  'drainage', 'electrical', 'water-supply', 'other',
]);

function normalizePhone(raw) {
  return String(raw || '').replace(/[^\d]/g, '');
}

/**
 * Parse a raw inbound SMS body into a structured command.
 * Returns { type: 'report', category, district, description } |
 *         { type: 'status', ref } |
 *         { type: 'help' } |
 *         { type: 'unknown', raw }
 */
function parseInboundSms(body) {
  const text = String(body || '').trim();
  const upper = text.toUpperCase();

  if (upper === 'HELP' || upper === 'MENU') {
    return { type: 'help' };
  }

  if (upper.startsWith('STATUS')) {
    const ref = text.slice(6).trim().replace(/^#/, '');
    return { type: 'status', ref: ref || null };
  }

  if (upper.startsWith('REPORT')) {
    const rest = text.slice(6).trim();
    // "REPORT <category> <district> | <description>"
    const [head, ...descParts] = rest.split('|');
    const description = descParts.join('|').trim();
    const headParts = head.trim().split(/\s+/).filter(Boolean);
    const categoryRaw = (headParts[0] || '').toLowerCase();
    const category = CATEGORY_ALIASES[categoryRaw] || null;
    const district = headParts.slice(1).join(' ').trim();
    return {
      type: 'report',
      category,
      categoryRaw,
      district,
      description: description || head.trim(),
    };
  }

  return { type: 'unknown', raw: text };
}

function helpText() {
  return [
    'Civicदृष्टि SMS commands:',
    'REPORT <category> <district> | <details> — e.g. REPORT road-damage Kathmandu | Pothole near ward office',
    'Categories: ' + VALID_CATEGORIES.join(', '),
    'STATUS <report-id> — check a report, or STATUS alone for your latest',
  ].join('\n');
}

/**
 * Send an outbound SMS. Uses Twilio's REST API directly (no SDK dependency)
 * when TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are
 * configured; otherwise logs to the console so the reporting flow is fully
 * testable without a paid account.
 */
async function sendSms(toPhone, message) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log(`[sms:mock] -> ${toPhone}: ${message}`);
    return { ok: true, mock: true };
  }

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const params = new URLSearchParams({ To: toPhone, From: TWILIO_FROM_NUMBER, Body: message });
    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: data.message || `Twilio error ${resp.status}` };
    return { ok: true, sid: data.sid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { parseInboundSms, helpText, sendSms, normalizePhone, VALID_CATEGORIES, CATEGORY_ALIASES };