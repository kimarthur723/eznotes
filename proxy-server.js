const http = require('http');
const httpProxy = require('http-proxy');

// Create proxy instances
const nextProxy = httpProxy.createProxyServer({
  target: 'http://localhost:3000',
  ws: false
});

const wsProxy = httpProxy.createProxyServer({
  target: 'http://localhost:8080',
  ws: true
});

// Create HTTP server
const server = http.createServer((req, res) => {
  // Route all HTTP requests to Next.js
  console.log(`HTTP ${req.method} ${req.url}`);
  nextProxy.web(req, res);
});

// Handle WebSocket upgrade requests
server.on('upgrade', (req, socket, head) => {
  console.log(`WebSocket upgrade request: ${req.url}`);

  // Route WebSocket connections to the WebSocket server
  wsProxy.ws(req, socket, head);
});

// Error handling
nextProxy.on('error', (err, req, res) => {
  console.error('Next.js proxy error:', err.message);
  if (res.writeHead) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Proxy Error');
  }
});

wsProxy.on('error', (err, req, socket) => {
  console.error('WebSocket proxy error:', err.message);
  if (socket.writable) {
    socket.end();
  }
});

const PORT = 9000;
server.listen(PORT, () => {
  console.log(`🔄 Reverse proxy server listening on port ${PORT}`);
  console.log(`   HTTP traffic → Next.js (port 3000)`);
  console.log(`   WebSocket traffic → WebSocket server (port 8080)`);
});
