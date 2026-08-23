const tls = require('tls');

function enabled() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}
function b64(value) { return Buffer.from(String(value), 'utf8').toString('base64'); }
function sanitize(value) { return String(value || '').replace(/[\r\n]+/g, ' ').trim(); }
function readLine(socket) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      if (/\r?\n$/.test(buffer) && !/^\d{3}-/m.test(buffer.split(/\r?\n/).filter(Boolean).slice(-1)[0] || '')) {
        socket.off('data', onData);
        resolve(buffer);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}
async function sendCommand(socket, command) {
  if (command) socket.write(command + '\r\n');
  const response = await readLine(socket);
  const code = Number(response.slice(0, 3));
  if (!Number.isFinite(code) || code >= 400) throw new Error(`SMTP failed: ${response.trim()}`);
  return response;
}
async function sendEmail({ to, subject, text }) {
  if (!enabled() || !to) return { skipped: true };
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const host = process.env.EMAIL_HOST || (process.env.EMAIL_SERVICE === 'gmail' ? 'smtp.gmail.com' : 'smtp.gmail.com');
  const port = Number(process.env.EMAIL_PORT || 465);
  const socket = tls.connect(port, host, { servername: host });
  await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); });
  await sendCommand(socket);
  await sendCommand(socket, `EHLO civicdrishti.local`);
  await sendCommand(socket, 'AUTH LOGIN');
  await sendCommand(socket, b64(user));
  await sendCommand(socket, b64(pass));
  await sendCommand(socket, `MAIL FROM:<${user}>`);
  await sendCommand(socket, `RCPT TO:<${to}>`);
  await sendCommand(socket, 'DATA');
  const body = [
    `From: Civicदृष्टि <${user}>`,
    `To: ${sanitize(to)}`,
    `Subject: ${sanitize(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '',
    'This is an automated Civicदृष्टि notification.',
  ].join('\r\n');
  socket.write(body.replace(/\r?\n\./g, '\r\n..') + '\r\n.\r\n');
  await sendCommand(socket);
  await sendCommand(socket, 'QUIT').catch(() => null);
  socket.end();
  return { sent: true };
}
function sendEmailQuietly(payload) {
  sendEmail(payload).catch(err => console.warn('Email notification skipped:', err.message));
}
module.exports = { sendEmail, sendEmailQuietly, enabled };
