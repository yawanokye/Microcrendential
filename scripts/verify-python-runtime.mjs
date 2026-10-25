import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = resolve('public/vendor/pyodide');
try {
  const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
  if (manifest.version !== '314.0.7') throw new Error('The Python runtime version does not match this release.');
  const required = ['pyodide.js', 'pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json', 'PYODIDE-LICENSE.txt', 'PYTHON-LICENSE.txt', 'NOTICE.txt'];
  const lock = JSON.parse(readFileSync(resolve(root, 'pyodide-lock.json'), 'utf8'));
  for (const name of ['numpy', 'pandas', 'python-dateutil', 'pytz', 'six']) {
    const entry = lock.packages?.[name];
    if (!entry || manifest.packages?.[name] !== entry.version) throw new Error(`Missing or inconsistent bundled Python package: ${name}`);
    required.push(entry.file_name);
  }
  if (!required.every(name => Object.hasOwn(manifest.files, name))) throw new Error('The Python manifest is incomplete.');
  for (const [name, file] of Object.entries(manifest.files)) {
    if (!/^[a-zA-Z0-9_.-]+$/.test(name) || name.includes('..')) throw new Error('Invalid Python asset name.');
    const path = resolve(root, name), bytes = readFileSync(path);
    if (statSync(path).size !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Python runtime file is missing or changed: ${name}`);
  }
  console.log(`Python runtime verified: ${manifest.version}, ${Object.keys(manifest.files).length} local files, NumPy and pandas included.`);
} catch (error) { console.error(`Python runtime check failed. ${error.message} Restore public/vendor/pyodide from the complete release ZIP.`); process.exitCode = 1; }
