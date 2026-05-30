const { io } = require('/Users/carl/Documents/GitHub/scanner-server/node_modules/socket.io-client');

const s = io('ws://localhost:3232', { query: { deviceId: 'scanner-001' } });
s.on('connect', async () => {
  console.log('connected');

  s.emit('barcode', '452465\n');

  await new Promise(r => setTimeout(r, 300));

  // 1×1 red PNG base64
  const tiny = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  s.emit('image', tiny, (ack) => console.log('ack:', ack));

  await new Promise(r => setTimeout(r, 600));
  s.disconnect();
  process.exit(0);
});
s.on('connect_error', e => { console.error(e.message); process.exit(1); });
