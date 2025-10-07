const http = require('http');

const PORT = process.env.MOCK_HTTP_PORT ? parseInt(process.env.MOCK_HTTP_PORT, 10) : 8765;

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Mock gateway received:', body);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      // echo back what we received (and add a simple status)
      try {
        const parsed = JSON.parse(body);
        res.end(JSON.stringify({ ok: true, received: parsed }));
      } catch (e) {
        res.end(JSON.stringify({ ok: true, receivedRaw: body }));
      }
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Mock gateway: send a POST');
  }
});

server.listen(PORT, () => console.log(`Mock HTTP gateway listening on ${PORT}`));
