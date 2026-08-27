
const app = require('../index');

let seeded = false;

module.exports = async (req, res) => {
  if (!seeded) {
    seeded = true;

    app.seedIfNeeded().catch(err => console.warn('Seed skipped:', err.message));
  }
  return app(req, res);
};