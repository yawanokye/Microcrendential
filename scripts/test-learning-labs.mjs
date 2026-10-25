import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let playwright; try { playwright = require('playwright'); } catch { playwright = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright'); }
const directory = mkdtempSync(join(tmpdir(), 'ucc-browser-test-working-labs-'));
const port = Number(process.env.TEST_PORT || 3116), origin = `http://127.0.0.1:${port}`, secret = 'isolated-working-labs';
const env = { ...process.env, DATA_DIR: directory, SQLITE_PATH: join(directory, 'test.sqlite'), AUTH_SECRET: secret, NODE_ENV: 'production', DEMONSTRATION_FULL_FUNCTIONALITY: 'true', NEXT_PUBLIC_APP_URL: origin, AUTO_BACKUP_ENABLED: 'false', PORT: String(port), HOSTNAME: '127.0.0.1' };
for (const key of Object.keys(env)) if (/^(OPENAI_|GOOGLE_|RESEND_|GMAIL_|SMTP_)/.test(key) || key === 'SUPPORT_EMAIL') delete env[key];
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-learning-labs-test.ts'], { env, stdio: 'pipe' });
const server = spawn(process.execPath, [resolve('.next/standalone/server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser; server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
const cookie = name => { const body = Buffer.from(JSON.stringify({ email: `${name}@example.test`, fullName: `Test ${name}`, expiresAt: Date.now() + 3600000, version: 3, sessionVersion: 1 })).toString('base64url'); return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`; };
async function api(name, path, payload, method = 'POST') { const response = await fetch(origin + path, { method: payload ? method : 'GET', headers: { cookie: `ucc_render_session=${cookie(name)}`, origin, ...(payload instanceof FormData ? {} : { 'content-type': 'application/json' }) }, ...(payload ? { body: payload instanceof FormData ? payload : JSON.stringify(payload) } : {}) }); return { response, data: await response.json() }; }
const checks = [], errors = [], result = {};
const passed = message => { checks.push(message); console.log(message); };
const out = resolve(process.env.TEST_ARTIFACT_DIR || 'validation/working-labs-v13.4.0');
async function context(name, viewport = { width: 1440, height: 1000 }) { const c = await browser.newContext({ viewport }); await c.addCookies([{ name: 'ucc_render_session', value: cookie(name), url: origin }]); return c; }
try {
  let ready = false; for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/health/live')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 250)); } assert.ok(ready);
  const runtime = await fetch(origin + '/api/learning-labs/runtime'); assert.match(runtime.headers.get('content-security-policy'), /sandbox allow-scripts/); assert.ok(runtime.headers.get('content-security-policy').includes('connect-src ' + origin + '/api/learning-labs/python/')); assert.equal(runtime.headers.get('x-frame-options'), 'SAMEORIGIN');
  browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || playwright.chromium.executablePath(), args: process.env.TEST_CHROMIUM_EXECUTABLE ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu'] : [] });
  const owner = await context('owner'), page = await owner.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(origin + '/facilitator-studio'); await page.locator('.clickable-course-card').filter({ hasText: 'E2E-LAB-DRAFT' }).getByRole('button', { name: 'Open editor', exact: true }).click();
  await page.getByLabel('Jump to any stage').selectOption('content'); const author = page.locator('.lab-author'); await author.getByText('Plan, build and test a learning lab', { exact: true }).click();
  assert.equal(await author.getByLabel('Require a passing result for lesson completion').isChecked(), false);
  assert.equal(await author.getByRole('button', { name: 'Apply working lab to lesson', exact: true }).isEnabled(), false);
  await author.getByRole('button', { name: 'Test working lab as learner', exact: true }).click(); const dialog = page.getByRole('dialog'); const preview = dialog.locator('.learning-lab');
  await preview.getByRole('button', { name: 'Run code', exact: true }).click(); await preview.getByLabel('Lab output', { exact: true }).filter({ hasText: '250' }).waitFor();
  passed('Facilitator tests an actual JavaScript programme before applying an optional lab');
  await preview.getByLabel('JavaScript programme', { exact: true }).fill('while (true) {}'); await preview.getByRole('button', { name: 'Run code', exact: true }).click(); await preview.getByRole('alert').filter({ hasText: '1.8 seconds' }).waitFor();
  await preview.getByLabel('JavaScript programme', { exact: true }).fill('return { document: typeof document, window: typeof window, origin: self.origin };'); await preview.getByRole('button', { name: 'Run code', exact: true }).click(); await preview.getByLabel('Lab output', { exact: true }).filter({ hasText: '"origin": "null"' }).waitFor(); assert.match(await preview.getByLabel('Lab output', { exact: true }).innerText(), /"document": "undefined"/);
  passed('Browser code has an opaque origin, no document access, and an enforced execution timeout');
  await dialog.getByRole('button', { name: 'Return to lab design', exact: true }).click();
  await author.getByLabel('I checked the task, required resources, evidence, rubric and outcome links').check(); assert.equal(await author.getByRole('button', { name: 'Apply working lab to lesson', exact: true }).isEnabled(), true);
  await author.getByRole('button', { name: 'Apply working lab to lesson', exact: true }).click(); await page.getByRole('button', { name: 'Undo last studio change', exact: true }).click();
  await author.getByRole('button', { name: 'Apply working lab to lesson', exact: true }).click(); const save = page.waitForResponse(r => r.url() === origin + '/api/courses' && r.request().method() === 'PUT'); await page.getByRole('button', { name: 'Save draft', exact: true }).click(); assert.ok((await save).ok());
  let data = await api('owner', '/api/courses?code=E2E-LAB-DRAFT'); assert.equal(data.data.courses[0].activities[0].lab.reviewed, true); assert.equal(data.data.courses[0].activities[0].required, false); assert.equal(data.data.courses[0].activities[0].gradingMode, 'facilitator');
  passed('Applied labs save with reviewed settings and optional completion, and their changes support Undo');
  await author.getByLabel('Lab title', { exact: true }).fill('Revised lab title needs a new test'); assert.equal(await author.getByRole('button', { name: 'Apply working lab to lesson', exact: true }).isEnabled(), false);
  await page.getByLabel('Jump to any stage').selectOption('review'); await page.getByRole('heading', { name: 'Development review and outcome evidence', exact: true }).waitFor(); assert.ok(await page.getByText('No approved, previewed question or required lesson activity', { exact: false }).count() >= 1);
  passed('Editing tested settings requires another preview and outcome review highlights missing assessed evidence');
  const learner = await context('learner', { width: 390, height: 844 }), lp = await learner.newPage(); lp.on('pageerror', e => errors.push(e.message));
  data = await api('learner', '/api/courses?code=E2E-LABS'); assert.equal(data.data.courses[0].activities.filter(a => a.lab).length, 5);
  const invalid = new FormData(); invalid.append('courseCode', 'E2E-LABS'); invalid.append('activityId', 'working-coding'); invalid.append('responseText', JSON.stringify({ version: 1, kind: 'coding', mark: 100, passed: true })); data = await api('learner', '/api/learning-activity-submissions', invalid); assert.equal(data.response.status, 400);
  passed('Incomplete or forged lab completion fields cannot bypass required evidence');
  for (const kind of ['coding', 'data_science', 'ai', 'cybersecurity', 'experiment']) {
    await lp.goto(origin + `/learn/E2E-LABS/lab-${kind}`); const lab = lp.locator('.learning-lab'); await lab.waitFor();
    if (kind === 'coding') { await lab.getByRole('button', { name: 'Run code', exact: true }).click(); await lab.getByLabel('Lab output', { exact: true }).filter({ hasText: '250' }).waitFor(); await lab.getByLabel('Working dataset CSV', { exact: true }).fill('item,cost\nBooks,125\nTransport,50\nMaterials,80'); await lab.getByRole('button', { name: 'Run code', exact: true }).click(); await lab.getByLabel('Lab output', { exact: true }).filter({ hasText: '255' }).waitFor(); }
    if (kind === 'data_science') { await lab.getByRole('button', { name: 'Calculate statistics', exact: true }).click(); await lab.getByLabel('Lab output', { exact: true }).filter({ hasText: 'missingOrNonNumeric' }).waitFor(); const output = JSON.parse(await lab.getByLabel('Lab output', { exact: true }).innerText()); assert.equal(output.count, 7); assert.equal(output.missingOrNonNumeric, 1); }
    if (kind === 'ai') { await lab.getByRole('button', { name: 'Train and evaluate model', exact: true }).click(); let output = JSON.parse(await lab.getByLabel('Lab output', { exact: true }).innerText()); const slope = output.slope; assert.equal(output.trainingRows, 9); assert.equal(output.testRows, 3); await lab.getByLabel('Working dataset CSV', { exact: true }).fill((await lab.getByLabel('Working dataset CSV', { exact: true }).inputValue()).replace('2,37', '2,90')); await lab.getByRole('button', { name: 'Train and evaluate model', exact: true }).click(); output = JSON.parse(await lab.getByLabel('Lab output', { exact: true }).innerText()); assert.notEqual(output.slope, slope); }
    if (kind === 'cybersecurity') { await lab.getByRole('button', { name: 'Run detection rule', exact: true }).click(); let output = JSON.parse(await lab.getByLabel('Lab output', { exact: true }).innerText()); assert.equal(output.alerts.length, 1); await lab.getByLabel('Failure threshold', { exact: true }).fill('1'); await lab.getByRole('button', { name: 'Run detection rule', exact: true }).click(); output = JSON.parse(await lab.getByLabel('Lab output', { exact: true }).innerText()); assert.equal(output.alerts.length, 2); }
    if (kind === 'experiment') { for (const voltage of [2, 4, 6]) { await lab.getByLabel('Voltage V', { exact: true }).fill(String(voltage)); await lab.getByRole('button', { name: 'Record measurement', exact: true }).click(); } await lab.getByRole('button', { name: 'Fit observation trend', exact: true }).click(); const output = JSON.parse(await lab.getByLabel('Lab output', { exact: true }).innerText()); assert.ok(Math.abs(output.slope - .01) < 1e-9); await lab.getByRole('img', { name: /Scatter plot of current against voltage/ }).waitFor(); }
    await lab.getByLabel('Findings and limitations', { exact: true }).fill('I changed an input and compared the result with an independent check. These observations support a limited conclusion about this supplied dataset and model.');
    await lp.waitForTimeout(1250); await lp.reload(); await lp.waitForFunction(() => document.querySelector('[aria-label="Findings and limitations"]')?.value.includes('I changed an input'));
    const overflow = await lp.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(overflow <= 2, `${kind}: no horizontal overflow (${overflow})`);
    await lp.getByRole('button', { name: 'Submit evidence for human marking', exact: true }).click(); await lp.getByRole('button', { name: 'Evidence saved; grading pending', exact: true }).waitFor();
    data = await api('learner', `/api/learning-activity-submissions?courseCode=E2E-LABS&activityId=working-${kind}`); const submission = data.data.submissions[0]; assert.equal(submission.status, 'submitted'); assert.equal(submission.mark, null); assert.equal(submission.passed, 0); result[kind] = submission.id;
    if (process.env.TEST_SCREENSHOT_DIR) { mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true }); await lp.screenshot({ path: join(process.env.TEST_SCREENSHOT_DIR, `working-${kind}-mobile.png`), fullPage: true }); }
    passed(`${kind}: a working experiment changes results, survives refresh and submits complete evidence on mobile without awarding a client grade`);
  }
  await lp.goto(origin + '/learn/E2E-PYTHON/python-lesson');
  const python = lp.locator('.learning-lab'); await python.getByLabel('Python programme', { exact: true }).waitFor();
  await python.getByRole('button', { name: 'Run code', exact: true }).click(); await python.getByLabel('Lab output', { exact: true }).filter({ hasText: '250' }).waitFor({ timeout: 65000 });
  assert.match(await python.getByLabel('Lab output', { exact: true }).innerText(), /Records examined:/);
  passed('Python executes inside the lesson using the bundled local interpreter without a Colab or AI account');
  await python.getByLabel('Python programme', { exact: true }).fill("import numpy as np\nimport pandas as pd\nframe = pd.DataFrame(data)\nresult = {'rows': len(frame), 'total': float(np.sum(frame['cost']))}\nprint(frame.to_string(index=False))");
  await python.getByRole('button', { name: 'Run code', exact: true }).click(); await python.getByLabel('Lab output', { exact: true }).filter({ hasText: 'Books' }).waitFor({ timeout: 65000 });
  assert.match(await python.getByLabel('Lab output', { exact: true }).innerText(), /Books/);
  if (process.env.TEST_SCREENSHOT_DIR) await lp.screenshot({ path: join(process.env.TEST_SCREENSHOT_DIR, 'working-python-mobile.png'), fullPage: true });
  passed('NumPy and pandas run real calculations against the lesson dataset with locally supplied package files');
  await python.getByLabel('Python programme', { exact: true }).fill('while True:\n    pass'); await python.getByRole('button', { name: 'Run code', exact: true }).click(); await python.getByRole('alert').filter({ hasText: '5 seconds' }).waitFor({ timeout: 65000 });
  await python.getByLabel('Python programme', { exact: true }).fill("print('Python recovered')\nresult = {'rows': len(data)}"); await python.getByRole('button', { name: 'Run code', exact: true }).click(); await python.getByLabel('Lab output', { exact: true }).filter({ hasText: 'Python recovered' }).waitFor({ timeout: 65000 });
  const downloading = lp.waitForEvent('download'); await python.getByRole('button', { name: 'Download Python notebook', exact: true }).click(); const download = await downloading; const notebook = JSON.parse(readFileSync(await download.path(), 'utf8')); assert.equal(notebook.nbformat, 4); assert.ok(notebook.cells[1].source.join('').includes('Python recovered'));
  passed('Timed-out Python work recovers and the learner can export an editable Jupyter notebook');
  await python.getByLabel('Findings and limitations', { exact: true }).fill('I ran Python and scientific libraries, checked the totals and confirmed that this dataset is fictional and small.');
  await lp.getByRole('button', { name: 'Submit evidence for human marking', exact: true }).click(); await lp.getByRole('button', { name: 'Evidence saved; grading pending', exact: true }).waitFor();
  data = await api('learner', '/api/learning-activity-submissions?courseCode=E2E-PYTHON&activityId=working-python'); assert.equal(data.data.submissions[0].mark, null); const pythonId = data.data.submissions[0].id; data = await api('owner', '/api/delivery/evidence?type=inline&id=' + pythonId); assert.equal(JSON.parse(data.data.record.response_text).language, 'python');
  data = await api('learner', '/api/assessments', { courseCode: 'E2E-LABS', answers: { final: 'Evidence' } }); assert.equal(data.response.status, 409);
  data = await api('outsider', '/api/delivery/evidence', { type: 'inline', id: result.coding, mark: 100, feedback: 'Attempted unassigned marking' }, 'PATCH'); assert.equal(data.response.status, 403);
  data = await api('owner', '/api/delivery/evidence?type=inline&id=' + result.coding); assert.ok(JSON.parse(data.data.record.response_text).runs.length >= 2); assert.match(data.data.record.rubric, /test cases/);
  data = await api('owner', '/api/delivery/evidence', { type: 'inline', id: result.coding, mark: 85, feedback: 'The code and independent check demonstrate the task. Improve the explanation of edge cases.' }, 'PATCH'); assert.equal(data.response.status, 200); assert.equal(data.data.passed, true);
  data = await api('learner', '/api/assessments', { courseCode: 'E2E-LABS', answers: { final: 'Evidence' } }); assert.equal(data.response.status, 202);
  passed('Required lab evidence blocks the final assessment until an authorised facilitator records a passing result');
  data = await api('owner', '/api/delivery/evidence?courseCode=E2E-LABS&filter=all'); assert.equal(data.data.items.length, 5);
  assert.deepEqual(errors, []); passed('Lab evidence appears in the gradebook queue and all authoring and learner screens render without page errors');
  mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'results.json'), JSON.stringify({ passed: checks.length, checks, node: process.version, environment: 'Local production standalone server and synthetic test data', liveServices: 'No AI, email, payment, Colab or external lab service contacted' }, null, 2) + '\n'); console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) { console.error(logs.slice(-4000)); throw error; }
finally { await browser?.close(); server.kill('SIGTERM'); }
