const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendEmailQuietly, sendEmail } = require('./email');

function code() {
  return String(crypto.randomInt(100000, 999999));
}
function hashCode(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}
function expires(minutes = 15) {
  return new Date(Date.now() + minutes * 60 * 1000);
}
function validHash(hash, raw, until) {
  return Boolean(hash && raw && until && new Date(until).getTime() > Date.now() && hashCode(raw) === hash);
}
function welcomeEmail(user) {
  sendEmailQuietly({
    to: user.email,
    subject: 'Welcome to Civicदृष्टि',
    text: `Namaste ${user.name},\n\nYour Civicदृष्टि account has been created. You can now track public reports, ward budgets, and civic notices from one place.`,
  });
}
function otpEmail(user, otp) {
  sendEmailQuietly({
    to: user.email,
    subject: 'Verify your Civicदृष्टि email',
    text: `Namaste ${user.name},\n\nYour email verification code is: ${otp}\n\nThis code expires in 15 minutes.`,
  });
}
function resetEmail(user, otp) {
  return sendEmail({
    to: user.email,
    subject: 'Reset your Civicदृष्टि password',
    text: `Namaste ${user.name},\n\nUse this password reset code: ${otp}\n\nThis code expires in 15 minutes. If you did not request this, ignore this email.`,
  });
}
function accountDecisionEmail(user, decision) {
  const approved = ['verified', 'active', 'approved'].includes(decision);
  sendEmailQuietly({
    to: user.email,
    subject: approved ? 'Your Civicदृष्टि account was approved' : 'Your Civicदृष्टि account needs review',
    text: approved
      ? `Namaste ${user.name},\n\nYour Civicदृष्टि account/identity has been approved. You can continue using the app.`
      : `Namaste ${user.name},\n\nYour Civicदृष्टि account or identity verification was not approved. Please contact the admin or upload correct details.`,
  });
}
function budgetDecisionEmail(user, change, status) {
  sendEmailQuietly({
    to: user.email,
    subject: `Budget proposal ${status}`,
    text: `Namaste ${user.name},\n\nYour budget proposal "${change?.proposed?.title || change?.budgetItem?.title || 'Budget change'}" was ${status}.\n\nYou can check Public Money in Civicदृष्टि for details.`,
  });
}
async function setPassword(user, password) {
  user.password = await bcrypt.hash(password, 12);
  user.resetPasswordHash = '';
  user.resetPasswordExpires = null;
}

module.exports = { code, hashCode, expires, validHash, welcomeEmail, otpEmail, resetEmail, accountDecisionEmail, budgetDecisionEmail, setPassword };

