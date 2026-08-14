const express = require('express');
const User = require('../models/User');
const { signToken } = require('../utils/token');
const { protect } = require('../middleware/auth');
const { seedForUser } = require('../utils/seed');
const { code, hashCode, expires, validHash, welcomeEmail, otpEmail, resetEmail } = require('../utils/authEmails');

const router = express.Router();

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, organization, citizenshipDoc, citizenshipDocName, province, district, municipality, ward, applicationDetails } = req.body;
    if (!name || !email || !password) return res.status(422).json({ error: 'Name, email and password are required' });
    if (password.length < 6) return res.status(422).json({ error: 'Password must be at least 6 characters' });

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

    const isFirst = (await User.countDocuments()) === 0;
    const finalRole = role === 'ward_rep' ? 'ward_rep' : (isFirst ? 'admin' : 'researcher');

    // Citizens signing up to submit community reports must verify their
    // identity with a citizenship document, so admins/analysts can trace a
    // report back to a real, verified person if it's ever flagged as fake.
    if (['researcher', 'ward_rep'].includes(finalRole) && !citizenshipDoc) {
      return res.status(422).json({ error: 'Please upload your citizenship certificate or national ID to verify your identity' });
    }

    const otp = code();
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: finalRole,
      organization: organization || 'Independent',
      civicLocation: { province: province || '', district: district || '', municipality: municipality || '', ward: ward || '' },
      citizenshipDoc: ['researcher', 'ward_rep'].includes(finalRole) ? citizenshipDoc : '',
      citizenshipDocName: ['researcher', 'ward_rep'].includes(finalRole) ? (citizenshipDocName || '') : '',
      status: finalRole === 'ward_rep' ? 'suspended' : 'active',
      verificationStatus: ['researcher', 'ward_rep'].includes(finalRole) ? 'pending' : 'n/a',
      wardRepresentativeApplication: finalRole === 'ward_rep' ? { requested: true, status: 'pending', province: province || '', district: district || '', municipality: municipality || '', ward: ward || '', details: applicationDetails || '', document: citizenshipDoc || '', documentName: citizenshipDocName || '' } : undefined,
      emailOtpHash: hashCode(otp),
      emailOtpExpires: expires(15),
    });

    welcomeEmail(user);
    otpEmail(user, otp);
    const token = signToken(user);
    await seedForUser(user._id);
    if (finalRole === 'ward_rep') return res.status(202).json({ user: user.toPublic(), pending: true, message: 'Ward Representative request submitted for admin approval' });
    res.status(201).json({ user: user.toPublic(), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(422).json({ error: 'Email and password are required' });

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    if (user.status !== 'active') return res.status(403).json({ error: 'Account suspended' });

    const token = signToken(user);
    await seedForUser(user._id);
    res.json({ user: user.toPublic(), token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


router.post('/verify-email', protect, async (req, res) => {
  try {
    const otp = String(req.body?.otp || '').trim();
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ user: user.toPublic() });
    if (!validHash(user.emailOtpHash, otp, user.emailOtpExpires)) return res.status(422).json({ error: 'Invalid or expired verification code' });
    user.emailVerified = true;
    user.emailOtpHash = '';
    user.emailOtpExpires = null;
    await user.save();
    res.json({ user: user.toPublic() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/resend-email-otp', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
    const otp = code();
    user.emailOtpHash = hashCode(otp);
    user.emailOtpExpires = expires(15);
    await user.save();
    otpEmail(user, otp);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const user = email ? await User.findOne({ email }) : null;
    if (user) {
      const otp = code();
      user.resetPasswordHash = hashCode(otp);
      user.resetPasswordExpires = expires(15);
      await user.save();
      await resetEmail(user, otp).catch(() => null);
    }
    res.json({ ok: true, message: 'If that email exists, a reset code has been sent.' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/reset-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const otp = String(req.body?.otp || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !otp || !password) return res.status(422).json({ error: 'Email, code and new password are required' });
    if (password.length < 6) return res.status(422).json({ error: 'Password must be at least 6 characters' });
    const user = await User.findOne({ email });
    if (!user || !validHash(user.resetPasswordHash, otp, user.resetPasswordExpires)) return res.status(422).json({ error: 'Invalid or expired reset code' });
    user.password = password;
    user.resetPasswordHash = '';
    user.resetPasswordExpires = null;
    await user.save();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// GET /api/auth/me
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;