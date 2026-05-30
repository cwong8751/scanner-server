import pkg from '/Users/carl/Documents/GitHub/scanner-server/node_modules/socket.io-client/dist/socket.io.esm.min.js';
const { io } = pkg;

const s = io('ws://localhost:3232', { query: { deviceId: 'scanner-001' } });
s.on('connect', async () => {
  console.log('connected');

  // barcode first
  s.emit('barcode', '452465\n');
  await new Promise(r => setTimeout(r, 300));

  // then image (tiny 1×1 PNG base64)
  const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
  s.emit('image', tiny, (ack) => console.log('ack:', ack));

  await new Promise(r => setTimeout(r, 600));
  s.disconnect();
  process.exit(0);
});
s.on('connect_error', e => { console.error(e.message); process.exit(1); });
