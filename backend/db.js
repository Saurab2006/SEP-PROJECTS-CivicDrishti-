const mongoose = require('mongoose');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (_) {}

let mode = 'memory'; // 'mongo' | 'memory'


let connecting = null;

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('⚠ No MONGODB_URI, using in-memory store');
    return;
  }


  if (mongoose.connection.readyState === 1) { mode = 'mongo'; return; }
  if (connecting) { await connecting; return; }

  connecting = mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || undefined,
    serverSelectionTimeoutMS: 5000,


    maxPoolSize: process.env.VERCEL ? 5 : 10,
  });

  try {
    await connecting;
    mode = 'mongo';
    console.log('✓ MongoDB connected');
  } catch (err) {
    console.log(`⚠ MongoDB unavailable (${err.message}), using in-memory store`);
  } finally {
    connecting = null;
  }
}

function getMode() { return mode; }

module.exports = { connect, getMode };