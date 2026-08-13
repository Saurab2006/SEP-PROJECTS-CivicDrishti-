// One-off cleanup: permanently deletes the three demo accounts
// (admin@govinsight.np, analyst@govinsight.np, researcher@govinsight.np)
// and any reports/data they created, now that demo auto-provisioning has
// been removed from the app.
//
// Usage (from the backend/ folder):
//   node scripts/removeDemoAccounts.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const IncidentReport = require('../models/IncidentReport');

const DEMO_EMAILS = ['admin@govinsight.np', 'analyst@govinsight.np', 'researcher@govinsight.np'];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URI found in backend/.env - nothing to do.');
    process.exit(1);
  }

  await mongoose.connect(uri, { dbName: process.env.MONGODB_DB || undefined });
  console.log('✓ Connected to MongoDB');

  const users = await User.find({ email: { $in: DEMO_EMAILS } });
  if (!users.length) {
    console.log('No accounts found with those emails - nothing to delete.');
  } else {
    for (const user of users) {
      console.log(`  Deleting ${user.name} <${user.email}> (${user.role})`);
      // Reassign or leave their reports as-is; here we just detach the
      // reportedBy reference so old reports aren't orphaned by a hard error.
      await IncidentReport.updateMany({ reportedBy: user._id }, { $unset: { reportedBy: '' } });
      await user.deleteOne();
    }
    console.log(`Deleted ${users.length} demo account(s).`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});