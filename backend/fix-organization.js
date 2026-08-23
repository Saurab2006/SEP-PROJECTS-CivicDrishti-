
require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); 
const User = require('./models/User');

const GOOD_VALUE = 'Civicदृष्टि';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || undefined,
  });
  console.log('Connected to MongoDB');

  // Find every user whose organization starts with "Civic"
  const candidates = await User.find({
    organization: { $regex: /^Civic/ },
  }).select('email organization');

  console.log(`Found ${candidates.length} user(s) with an organization starting "Civic":`);
  candidates.forEach(u => {
    console.log(` - ${u.email}: ${JSON.stringify(u.organization)}`);
  });

  const toFix = candidates.filter(u => u.organization !== GOOD_VALUE);

  if (toFix.length === 0) {
    console.log('\nNothing to fix — all matching values already correct.');
  } else {
    console.log(`\nFixing ${toFix.length} user(s)...`);
    for (const u of toFix) {
      await User.updateOne({ _id: u._id }, { $set: { organization: GOOD_VALUE } });
      console.log(`   ✓ updated ${u.email}`);
    }
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});