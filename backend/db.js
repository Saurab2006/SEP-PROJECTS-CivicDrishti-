const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

let mode = 'memory'; // 'mongo' | 'memory'

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    try {
      await mongoose.connect(uri, {
        dbName: process.env.MONGODB_DB || undefined,
        serverSelectionTimeoutMS: 5000,
      });
      mode = 'mongo';
      console.log('✓ MongoDB connected');
      return;
    } catch (err) {
      console.log(`⚠ MongoDB unavailable (${err.message}), using in-memory store`);
    }
  } else {
    console.log('⚠ No MONGODB_URI, using in-memory store');
  }
}

function getMode() { return mode; }

module.exports = { connect, getMode };
