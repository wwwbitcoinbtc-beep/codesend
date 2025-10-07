Simple REST API to generate 6-digit verification codes and forward them to a gateway.

Usage
1. Copy `.env.example` to `.env` and set `GATEWAY_URL` to your gateway (default is http://87.248.139.249:8765/)
2. Install deps:

   npm install

3. Run server:

   node server.js

4. Send request:

   POST http://localhost:3000/send-code
   Body: { "phone": "09919901583" }

Response contains the generated code and gateway response.

Note: The gateway client currently POSTs JSON to the gateway URL. If the gateway expects different framing (e.g. raw ASCII with <EOF>), update `lib/gatewayClient.js` accordingly.
