const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@civicdrishti.example';

const configured = Boolean(PUBLIC_KEY && PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
} else {
  // Same "degrade quietly" philosophy as utils/sms.js when Twilio isn't
  // configured - the app keeps working, push notifications just don't send.
  console.warn('Push notifications disabled: set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in the environment to enable them (see README).');
}

function getPublicKey() { return PUBLIC_KEY; }
function isPushConfigured() { return configured; }

// Sends one push notification to every device a citizen has opted in on.
// Silently prunes subscriptions the browser has revoked (410 Gone / 404 Not
// Found), which happens when a citizen uninstalls the app, clears site
// data, or the push service itself expires the endpoint.
async function sendPushToUser(userId, { title, body, url }) {
  if (!configured || !userId) return;
  let subs;
  try { subs = await PushSubscription.find({ user: userId }); } catch { return; }
  if (!subs.length) return;

  const payload = JSON.stringify({ title, body, url: url || '/dashboard' });
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => null);
      }
    }
  }));
}

module.exports = { sendPushToUser, getPublicKey, isPushConfigured };