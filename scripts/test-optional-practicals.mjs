import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHmac } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch { playwright = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright'); }
const directory = mkdtempSync(join(tmpdir(), 'ucc-browser-test-practicals-'));
const port = Number(process.env.TEST_PORT || 3115), origin = `http://127.0.0.1:${port}`;
const secret = 'isolated-optional-practicals-acceptance';
const env = { ...process.env, DATA_DIR: directory, SQLITE_PATH: join(directory, 'test.sqlite'), AUTH_SECRET: secret, NODE_ENV: 'production', DEMONSTRATION_FULL_FUNCTIONALITY: 'true', NEXT_PUBLIC_APP_URL: origin, AUTO_BACKUP_ENABLED: 'false', PORT: String(port), HOSTNAME: '127.0.0.1' };
for (const key of Object.keys(env)) if (/^(OPENAI_|GOOGLE_|RESEND_|GMAIL_|SMTP_)/.test(key) || key === 'SUPPORT_EMAIL') delete env[key];
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/seed-native-test.ts'], { env, stdio: 'pipe' });
const fixture = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
  import {buildIllustrativeCourseTemplate} from './src/lib/illustrative-course.ts';
  const asset={name:'Example.txt',size:0,type:'text/plain',publicUrl:'${origin}/examples/example.txt'};
  const course=buildIllustrativeCourseTemplate('${origin}',Object.fromEntries(['casePack','capstoneBrief','notebook','questionBank'].map(k=>[k,asset])));
  course.assessmentConfig.questions=course.assessmentConfig.questions.map(q=>({...q,previewed:true,approved:true}));
  console.log(JSON.stringify(course));
`], { env, encoding: 'utf8' }));
const server = spawn(process.execPath, [resolve('.next/standalone/server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let logs = '', browser;
server.stdout.on('data', d => logs += d); server.stderr.on('data', d => logs += d);
const body = Buffer.from(JSON.stringify({ email: 'owner@example.test', fullName: 'Test owner', expiresAt: Date.now() + 3600000, version: 3, sessionVersion: 1 })).toString('base64url');
const cookie = `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
const checks = [], errors = [];
const passed = message => { checks.push(message); console.log(message); };
const out = resolve(process.env.TEST_ARTIFACT_DIR || 'validation/optional-practicals-v13.3.2');
async function api(path, payload, method = 'POST') {
  const response = await fetch(origin + path, { method: payload ? method : 'GET', headers: { cookie: `ucc_render_session=${cookie}`, origin, 'content-type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
  const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data;
}
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin + '/api/health/live')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 250)); }
  assert.ok(ready);
  const native = (await api('/api/courses?code=E2E-NATIVE')).courses[0];
  const sectionId = fixture.design.sections[0].id;
  const draft = { ...fixture, code: 'E2E-NO-PRACTICAL', title: 'Optional practical skip acceptance', activities: native.activities.map(a => ({ ...a, sectionId })), materials: [...fixture.materials, ...native.materials.map(m => ({ ...m, sectionId, outcomeIds: [fixture.design.outcomes[0].id] }))], submissionMode: 'draft' };
  const created = await api('/api/courses', draft);
  assert.ok(created.quality.ready, JSON.stringify(created.quality.checks.filter(check => !check.passed)));
  browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.TEST_CHROMIUM_EXECUTABLE || playwright.chromium.executablePath(), args: process.env.TEST_CHROMIUM_EXECUTABLE ? ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu'] : [] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: 'ucc_render_session', value: cookie, url: origin }]);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  async function openDraft() {
    await page.goto(origin + '/facilitator-studio');
    await page.locator('.clickable-course-card').filter({ hasText: draft.code }).getByRole('button', { name: 'Open editor', exact: true }).click();
    await page.getByLabel('Jump to any stage').selectOption('activities');
  }
  await openDraft();
  const builder = page.locator('.programme-activities-builder');
  const none = () => builder.getByRole('button', { name: /^No (additional )?practical activity/ });
  assert.equal(await none().getAttribute('aria-pressed'), 'true');
  assert.equal(await builder.getByLabel('Activity title', { exact: true }).count(), 0);
  if (process.env.TEST_SCREENSHOT_DIR) {
    mkdirSync(process.env.TEST_SCREENSHOT_DIR, { recursive: true });
    await builder.screenshot({ path: join(process.env.TEST_SCREENSHOT_DIR, 'optional-practicals-desktop.png') });
  }
  passed('No practical activity is selected by default and the optional editor is hidden');
  await builder.getByRole('button', { name: /Interactive virtual practical/ }).click();
  await builder.getByRole('combobox', { name: /^Approved practical/ }).waitFor();
  await builder.getByRole('button', { name: /Google Colab coding activity/ }).click();
  await builder.getByText('Upload master .ipynb notebook', { exact: true }).waitFor();
  await none().click(); assert.equal(await builder.getByLabel('Activity title', { exact: true }).count(), 0);
  passed('Facilitators can choose either practical editor and return to no practical activity');
  await builder.getByRole('button', { name: 'Skip practical activities', exact: true }).click();
  await page.locator('.assessment-builder').waitFor();
  const savedResponse = page.waitForResponse(r => r.url() === origin + '/api/courses' && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  assert.ok((await savedResponse).ok());
  let saved = (await api('/api/courses?code=' + draft.code)).courses[0];
  assert.equal(saved.activities.filter(a => a.kind !== 'inline').length, 0);
  assert.ok(native.activities.every(original => saved.activities.some(a => a.id === original.id && a.required)));
  passed('Skipping reaches assessment and saves with zero practicals while retaining all five required lesson activities');
  await openDraft();
  assert.equal(await none().getAttribute('aria-pressed'), 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  const skip = builder.getByRole('button', { name: 'Skip practical activities', exact: true });
  await skip.scrollIntoViewIfNeeded(); assert.ok(await skip.isVisible());
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  if (process.env.TEST_SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.TEST_SCREENSHOT_DIR, 'optional-practicals-mobile.png') });
  await skip.click(); await page.locator('.assessment-builder').waitFor();
  passed('Saved courses reopen with no practical selected and the skip action works on a phone without horizontal overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Jump to any stage').selectOption('review');
  const submit = page.getByRole('button', { name: 'Submit version for UCC review', exact: true });
  assert.ok(await submit.isEnabled(), await page.locator('.review-checklist').allTextContents());
  const reviewResponse = page.waitForResponse(r => r.url() === origin + '/api/courses' && r.request().method() === 'PUT');
  await submit.click(); assert.ok((await reviewResponse).ok());
  saved = (await api('/api/courses?code=' + draft.code)).courses[0]; assert.equal(saved.status, 'pending_review');
  assert.equal(saved.activities.filter(a => a.kind !== 'inline').length, 0);
  passed('A complete course submits for academic review without a separate practical activity');
  await api('/api/courses', { ...draft, code: 'E2E-KEEP-PRACTICAL', title: 'Retain saved practical acceptance', activities: [...draft.activities, fixture.activities.find(a => a.kind === 'virtual_lab')] });
  draft.code = 'E2E-KEEP-PRACTICAL';
  await openDraft();
  await none().click();
  assert.equal(await builder.getByRole('heading', { name: '1 optional practical tool', exact: true }).count(), 1);
  assert.equal(await builder.getByRole('button', { name: 'Skip practical activities', exact: true }).count(), 0);
  const keepResponse = page.waitForResponse(r => r.url() === origin + '/api/courses' && r.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click(); assert.ok((await keepResponse).ok());
  saved = (await api('/api/courses?code=' + draft.code)).courses[0];
  assert.equal(saved.activities.filter(a => a.kind === 'virtual_lab').length, 1);
  assert.ok(native.activities.every(original => saved.activities.some(a => a.id === original.id && a.required)));
  passed('No additional practical activity preserves saved practicals and required lesson activities');
  assert.deepEqual(errors, []); passed('The complete skip and retain workflows render without browser errors');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'results.json'), JSON.stringify({ passed: checks.length, checks, node: process.version, liveAi: 'Not called for this practical-selection UI fix.' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: checks.length, checks }));
} catch (error) { console.error(logs.slice(-4000)); throw error; }
finally { await browser?.close(); server.kill('SIGTERM'); }
