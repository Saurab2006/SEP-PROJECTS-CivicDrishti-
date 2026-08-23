// Usage (from the backend/ folder):
//   node scripts/reassignAvatarHues.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const { randomAvatarHue } = require('../utils/avatarHue');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in backend/.env - nothing to do.');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
  console.log('✓ Connected to MongoDB');

  const users = await User.find({});
  console.log(`Found ${users.length} user(s). Re-rolling avatar colors...`);

  for (const user of users) {
    const oldHue = user.avatarHue;
    user.avatarHue = randomAvatarHue();
    await user.save();
    console.log(`  ${user.name.padEnd(24)} hue ${oldHue} -> ${user.avatarHue}`);
  }

  console.log('Done.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});