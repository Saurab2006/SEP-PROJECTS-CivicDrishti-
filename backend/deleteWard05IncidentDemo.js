
require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const IncidentReport = require('./models/IncidentReport');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || undefined;

const TITLES = [
  'Potholes near Ward 05 school road',
  'Drain cover broken beside Ward 05 road project',
  'Dust and unsafe edge after road widening',
];

async function main() {
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });

  const result = await IncidentReport.deleteMany({
    title: { $in: TITLES },
    'location.district': 'Morang',
    'location.municipality': 'Biratnagar Metropolitan City',
    'location.ward': '05',
  });

  console.log(`Deleted ${result.deletedCount} demo incident report(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});