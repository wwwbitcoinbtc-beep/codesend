const axios = require('axios');
const net = require('net');

/**
 * Send payload to gateway. Mode depends on `mode` param or environment:
 * - http: POST JSON to URL
 * - tcp: connect to host:port and send ASCII payload (ensure <EOF> termination)
 *
 * payload: for tcp we will format as: ID:{identifier};TO:{to};MSG:{message}<EOF>
 */
async function send({ mode = process.env.GATEWAY_PROTOCOL || 'http', url, host, port, timeout = 5000, payload, identifier }) {
  if (mode === 'tcp') {
    return sendTcp({ host, port, timeout, payload, identifier });
  }
  // default http
  try {
    const resp = await axios.post(url, payload, { timeout });
    return { status: resp.status, data: resp.data };
  } catch (err) {
    if (err.response) return { status: err.response.status, data: err.response.data };
    throw err;
  }
}

function sendTcp({ host, port, timeout = 5000, payload, identifier }) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    let dataBuf = '';
    let timer = null;

    client.setEncoding('ascii');

    client.connect(port, host, () => {
      // ensure payload ends with <EOF>
      let out = payload;
      if (!out.endsWith('<EOF>')) out = out + '<EOF>';
      client.write(out, 'ascii');
    });

    client.on('data', (data) => {
      dataBuf += data;
      if (dataBuf.indexOf('<EOF>') !== -1) {
        clearTimeout(timer);
        client.end();
        resolve({ status: 'ok', data: dataBuf });
      }
    });

    client.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    client.on('close', () => {
      if (dataBuf.indexOf('<EOF>') === -1) {
        resolve({ status: 'closed', data: dataBuf });
      }
    });

    timer = setTimeout(() => {
      client.destroy();
      reject(new Error('timeout waiting for tcp response'));
    }, timeout);
  });
}

module.exports = { send };
