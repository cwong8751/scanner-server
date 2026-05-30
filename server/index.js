import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import QRCode from 'qrcode';
import ip from 'ip';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' }, maxHttpBufferSize: 5e6 }); // 100mb max buffer for images
let currentPort = 3232;

function getServerUrl(port) {
  const localIp = ip.address();
  return `http://${localIp}:${port}`;
}

// SSE clients for the frontend
const sseClients = new Set();

function broadcast(event, payload) {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    client.write(line);
  }
}

function emitLog(message) {
  broadcast('log', { message, timestamp: new Date().toISOString() });
}

// Register socket handlers once
io.on('connection', (socket) => {
  const id = socket.handshake.query.deviceId || socket.id;
  emitLog(`Device connected [${id}]`);

  socket.on('scan-data', (data) => {
    broadcast('scan-data', data);
  });

  socket.on('barcode', (data) => {        // ← add this
    broadcast('scan-data', { barcode: data });
    emitLog(`Device [${id}] scanned: ${data}`);
  });

  socket.on('image', (data, ack) => {          // ← add this
    broadcast('scan-data', { image: data });
    emitLog(`Device [${id}] sent image (${Math.round(data.length / 1024)}kb)`);  // ← add
    
    // return a receipt so the phone doesnt close prematurely 
    if(typeof ack === 'function') {
      ack({ status: 'image received' });
    }
  });

  socket.on('status', (status) => {
    emitLog(`Device [${id}] status: ${status}`);
  });

  socket.on('disconnect', (reason) => {
    emitLog(`Device disconnected [${id}] — ${reason}`);
  });
});

async function stopSocketServer() {
  await new Promise((resolve) => {
    httpServer.closeAllConnections?.();
    httpServer.close(resolve);
  });
}

async function startSocketServer(port) {
  await new Promise((resolve, reject) => {
    httpServer.listen(port, '0.0.0.0', resolve);
    httpServer.once('error', reject);
  });
}

app.get('/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.get('/qr', async (req, res) => {
  const url = getServerUrl(currentPort);
  const qrDataUrl = await QRCode.toDataURL(url, { width: 256 });
  res.json({ url, qr: qrDataUrl });
});

app.post('/restart', async (req, res) => {
  emitLog('Server restarting…');
  io.disconnectSockets(true);

  // No port change — just kick everyone off
  emitLog(`Server ready on port ${currentPort}`);

  const url = getServerUrl(currentPort);
  const qrDataUrl = await QRCode.toDataURL(url, { width: 256 });
  res.json({ url, qr: qrDataUrl });
});

await startSocketServer(currentPort);
emitLog(`Server started on port ${currentPort}`);
console.log(`Socket.IO server running on ${getServerUrl(currentPort)}`);