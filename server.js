require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const gateway = require('./lib/gatewayClient');
const fs = require('fs');
const path = require('path');

// ensure logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const logFile = path.join(logsDir, 'send.log');

function log(level, message, meta) {
  const ts = new Date().toISOString();
  const line = `${ts} [${level.toUpperCase()}] ${message}` + (meta ? ` ${JSON.stringify(meta)}` : '') + '\n';
  // console
  if (level === 'error') console.error(line.trim()); else console.log(line.trim());
  // append to file (best-effort)
  try { fs.appendFileSync(logFile, line); } catch (e) { console.error('Failed to write log file', e && e.message); }
}

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const IDENTIFIER = process.env.IDENTIFIER || '1senik2';

function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendCodeToGateway(phone) {
  if (!phone || typeof phone !== 'string') throw new Error('phone is required');
  const code = generateSixDigitCode();
  const message = `کد تایید شما: ${code}`;
  const mode = (process.env.GATEWAY_PROTOCOL || 'tcp').toLowerCase();
  log('info', 'Attempting to send code', { phone, mode });
  if (mode === 'tcp') {
    const host = process.env.GATEWAY_HOST || '87.248.139.249';
    const port = parseInt(process.env.GATEWAY_PORT || '8765', 10);
    const payload = `ID:${IDENTIFIER};TO:${phone};MSG:${message}<EOF>`;
    log('debug', 'TCP payload', { host, port, payload });
    try {
      const resp = await gateway.send({ mode: 'tcp', host, port, payload, timeout: 7000 });
      log('info', 'TCP send succeeded', { phone, resp });
      return { phone, code, gatewayResponse: resp };
    } catch (err) {
      log('error', 'TCP send failed', { phone, message: err && err.message, stack: err && err.stack });
      throw err;
    }
  }
  const gatewayUrl = process.env.GATEWAY_URL || 'http://87.248.139.249:8765/';
  const payload = { identifier: IDENTIFIER, to: phone, message };
  log('debug', 'HTTP payload', { gatewayUrl, payload });
  try {
    const resp = await gateway.send({ mode: 'http', url: gatewayUrl, payload, timeout: 7000 });
    log('info', 'HTTP send succeeded', { phone, resp });
    return { phone, code, gatewayResponse: resp };
  } catch (err) {
    log('error', 'HTTP send failed', { phone, message: err && err.message, stack: err && err.stack });
    throw err;
  }
}

app.post('/send-code', async (req, res) => {
  const phone = (req.body && req.body.phone) || req.query.phone;
  if (!phone) return res.status(400).json({ ok: false, error: 'phone is required' });

  try {
    const result = await sendCodeToGateway(phone);
    return res.json(Object.assign({ ok: true }, result));
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

// --- Logging endpoints ---
// GET /logs?lines=100  -> return last N lines of local log
app.get('/logs', (req, res) => {
  const lines = parseInt(req.query.lines || '200', 10);
  try {
    if (!fs.existsSync(logFile)) return res.status(404).send('Log file not found');
    const content = fs.readFileSync(logFile, 'utf8');
    const arr = content.split(/\r?\n/).filter(Boolean);
    const tail = arr.slice(-lines).join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(tail);
  } catch (e) {
    log('error', 'Failed to read log file', { error: e && e.message });
    return res.status(500).json({ ok: false, error: e && e.message });
  }
});

// GET /logs/download -> download full log file
app.get('/logs/download', (req, res) => {
  try {
    if (!fs.existsSync(logFile)) return res.status(404).send('Log file not found');
    return res.download(logFile);
  } catch (e) {
    log('error', 'Failed to send log file', { error: e && e.message });
    return res.status(500).json({ ok: false, error: e && e.message });
  }
});

const axios = require('axios');
// GET /remote-logs?url=... -> fetch logs from remote gateway URL (if gateway exposes logs via HTTP)
app.get('/remote-logs', async (req, res) => {
  const remoteUrl = req.query.url || process.env.GATEWAY_LOG_URL || process.env.GATEWAY_URL || 'http://87.248.139.249:8765/logs';
  log('info', 'Fetching remote logs', { remoteUrl });
  try {
    const resp = await axios.get(remoteUrl, { timeout: 7000 });
    // if remote returns JSON, forward as JSON; otherwise return text
    const ct = resp.headers['content-type'] || '';
    if (ct.indexOf('application/json') !== -1) {
      return res.json(resp.data);
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data, null, 2));
  } catch (e) {
    log('error', 'Failed to fetch remote logs', { remoteUrl, error: e && e.message });
    return res.status(502).json({ ok: false, error: e && e.message });
  }
});
// Interactive stdin mode: if server started in a TTY, accept phone numbers from stdin
if (process.stdin && process.stdin.isTTY) {
  try {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.setPrompt('Enter phone (or "exit"): ');
    rl.prompt();
    rl.on('line', async (line) => {
      const phone = line.trim();
      if (!phone) { rl.prompt(); return; }
      if (phone.toLowerCase() === 'exit') { rl.close(); process.exit(0); }
      process.stdout.write(`Sending code to ${phone} ... `);
      try {
        const result = await sendCodeToGateway(phone);
        console.log('OK');
        console.log(JSON.stringify(result, null, 2));
      } catch (err) {
        console.log('ERROR');
        console.error(err && err.message ? err.message : err);
      }
      rl.prompt();
    }).on('close', () => process.exit(0));
  } catch (e) {
    console.error('Interactive mode not available:', e.message);
  }
}
