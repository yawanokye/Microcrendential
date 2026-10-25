import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { GET as runtime } from '../src/app/api/learning-labs/runtime/route.ts';
import { GET as asset } from '../src/app/api/learning-labs/python/[version]/[file]/route.ts';
const require = createRequire(import.meta.url);
let playwright; try { playwright = require('playwright'); } catch { playwright = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright'); }
const server = createServer(async (req, res) => {
  const base = `http://${req.headers.host}`, url = new URL(req.url, base);
  if (process.env.TEST_LAB_DEBUG) console.log('REQUEST', url.pathname);
  const request = new Request(url, { headers: req.headers });
  let response;
  if (url.pathname === '/') response = new Response('<!doctype html><title>Runtime acceptance</title><iframe sandbox="allow-scripts" src="/api/learning-labs/runtime"></iframe>', { headers: { 'content-type': 'text/html' } });
  else if (url.pathname === '/api/learning-labs/runtime') response = runtime(request);
  else if (url.pathname.startsWith('/api/learning-labs/python/')) { const parts = url.pathname.split('/'); response = await asset(request, { params: Promise.resolve({ version: parts[4], file: parts[5] }) }); }
  else response = new Response('Unavailable', { status: 404 });
  res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
console.log("Runtime test server ready", origin);
let browser;
try {
  browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || playwright.chromium.executablePath(), args: process.env.TEST_CHROMIUM_EXECUTABLE ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu'] : [] });
  console.log('Runtime test browser ready');
  const page = await browser.newPage(); page.on('requestfailed', req => console.log('REQUEST FAILED', req.url(), req.failure()?.errorText)); page.on('pageerror', error => console.log('PAGE ERROR', error.message)); page.on('console', msg => { if (msg.type() === 'error') console.log(msg.text().slice(0, 1000)); });
  await page.goto(origin); console.log('Runtime parent page loaded'); await page.locator('iframe').waitFor();
  await page.waitForTimeout(200);
  const run = (language, code, data = [{ cost: 120 }, { cost: 50 }, { cost: 80 }]) => page.evaluate(({ language, code, data }) => new Promise(resolve => {
    const token = crypto.randomUUID(), frame = document.querySelector('iframe');
    const timer = setTimeout(() => { removeEventListener('message', receive); resolve({ error: 'Harness response timeout' }); }, 70000);
    const receive = event => { if (event.source === frame.contentWindow && event.data?.type === 'ucc-lab-result' && event.data.token === token) { clearTimeout(timer); removeEventListener('message', receive); resolve(event.data); } };
    addEventListener('message', receive); frame.contentWindow.postMessage({ type: 'ucc-lab-run', language, token, code, data }, '*');
  }), { language, code, data });
  let result = await run('javascript', 'return { total: data.reduce((sum,row)=>sum+row.cost,0), origin: self.origin };'); assert.equal(result.error, null, JSON.stringify(result)); assert.equal(result.result.value.total, 250); assert.equal(result.result.value.origin, 'null'); console.log('JavaScript execution and opaque origin passed');
  result = await run('python', "print('Python is running')\nresult = {'total': sum(row['cost'] for row in data)}"); assert.equal(result.error, null, JSON.stringify(result)); assert.equal(result.result.value.total, 250); assert.ok(result.result.logs.some(line => line.includes('Python is running'))); console.log('Python execution and stdout passed');
  result = await run('python', "import numpy as np\nimport pandas as pd\nframe = pd.DataFrame(data)\nresult = {'total': float(np.sum(frame['cost'])), 'rows': len(frame)}"); assert.equal(result.error, null, JSON.stringify(result)); assert.equal(result.result.value.total, 250); assert.equal(result.result.value.rows, 3); console.log('NumPy and pandas passed');
  result = await run('javascript', `return await fetch(${JSON.stringify(origin + '/api/auth/session')}).then(r=>r.text());`); assert.ok(result.error); console.log('Non-runtime network requests blocked');
  result = await run('python', 'while True:\n    pass'); assert.match(result.error, /5 seconds/); console.log('Python infinite loop terminated');
  console.log(JSON.stringify({ passed: 5 }));
} finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
