const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'govinsight-nepal-jwt-secret';

function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' },
  );
}

module.exports = { signToken, JWT_SECRET };
