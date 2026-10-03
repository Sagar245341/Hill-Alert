const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

test('backend serves health and accepts a Socket.IO connection', async (t) => {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill());
  const port = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Backend startup timed out')), 10000);
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
      const match = output.match(/Backend server running on port (\d+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
    child.on('error', (error) => { clearTimeout(timeout); reject(error); });
    child.on('exit', (code) => { clearTimeout(timeout); reject(new Error(`Backend exited: ${code}`)); });
  });
  const base = `http://127.0.0.1:${port}`;
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).status, 'ok');
  const handshake = await fetch(`${base}/socket.io/?EIO=4&transport=polling`);
  assert.equal(handshake.status, 200);
  const packet = await handshake.text();
  assert.equal(packet[0], '0');
  const { sid } = JSON.parse(packet.slice(1));
  const url = `${base}/socket.io/?EIO=4&transport=polling&sid=${sid}`;
  const connect = await fetch(url, { method: 'POST', body: '40' });
  assert.equal(connect.status, 200);
  assert.match(await (await fetch(url)).text(), /^40/);
  await fetch(url, { method: 'POST', body: '1' });
  assert.equal((await fetch(`${base}/api/missing`)).status, 404);
});
