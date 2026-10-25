import { PYTHON_LAB_VERSION } from "@/lib/python-lab-runtime";
// Static, credential-free browser execution harness. Learner code never runs on the server.
const page = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Isolated learning lab runner</title></head><body><script>
'use strict';
const pythonBase = __PYTHON_BASE__;
let active = null, activeToken = '';
function pythonWorkerBoot() {
  self.onmessage = async event => {
    const request = event.data, logs = [];
    const log = value => { if (logs.length < 40) logs.push(String(value).slice(0, 1200)); };
    try {
      const nativeFetch = self.fetch.bind(self);
      self.fetch = (resource, options) => {
        const url = new URL(typeof resource === 'string' ? resource : resource.url || String(resource), request.pythonBase);
        if (!url.href.startsWith(request.pythonBase)) throw new Error('Network access is restricted to the supplied Python runtime files.');
        return nativeFetch(url.href, {...options,mode:'cors',credentials:'omit'});
      };
      self.postMessage({progress:'Loading the local Python runtime and selected libraries'});
      importScripts(request.pythonBase + 'pyodide.js');
      const py = await loadPyodide({indexURL:request.pythonBase,stdout:log,stderr:log});
      await py.loadPackagesFromImports(request.code);
      py.globals.set('_ucc_data_json', JSON.stringify(request.data));
      await py.runPythonAsync('import json as _ucc_json\ndata = _ucc_json.loads(_ucc_data_json)\nresult = None');
      self.postMessage({started:true});
      await py.runPythonAsync(request.code);
      const json = await py.runPythonAsync('_ucc_json.dumps(result, default=str, allow_nan=False)');
      const output = JSON.stringify({value:JSON.parse(json),logs});
      if (output.length > 24000) throw new Error('Output exceeds 24,000 characters. Print or return a smaller summary.');
      self.postMessage({output});
    } catch(error) { self.postMessage({error:String(error&&error.message||error).slice(0,1600)}); }
  };
}
addEventListener('message', event => {
  if (event.source !== parent || parent === window) return;
  if (event.data?.type === 'ucc-lab-cancel' && event.data.token === activeToken) { active?.(); return; }
  if (event.data?.type !== 'ucc-lab-run') return;
  const request = event.data;
  if (typeof request.token !== 'string' || request.token.length > 100 || typeof request.code !== 'string' || request.code.length > 20000 || !Array.isArray(request.data) || request.data.length > 1000) return;
  if (active) active();
  let worker, timer, finished = false, objectUrl;
  const finish = (result, error) => {
    if (finished) return;
    finished = true; clearTimeout(timer); worker?.terminate(); if (objectUrl) URL.revokeObjectURL(objectUrl);
    parent.postMessage({type:'ucc-lab-result',token:request.token,result,error}, '*');
  };
  activeToken = request.token;
  active = () => finish(null, 'Run stopped. Your code and data are retained.');
  const python = request.language === 'python';
  const prefix = "'use strict';self.onmessage=async function(event){const data=event.data;const logs=[];const console=Object.freeze(Object.fromEntries(['log','warn','error'].map(level=>[level,(...items)=>{if(logs.length<30)logs.push(items.map(v=>{try{return typeof v==='string'?v:JSON.stringify(v)}catch{return String(v)}}).join(' ').slice(0,1000))}])));try{const result=await(async function(data,console){\n";
  const suffix = "\n})(data,console);const output=JSON.stringify({value:result===undefined?null:result,logs});if(output.length>24000)throw new Error('Output exceeds 24,000 characters. Return a smaller summary.');self.postMessage({output});}catch(error){self.postMessage({error:String(error&&error.message||error).slice(0,1000)})}};";
  try {
    const source = python ? '(' + pythonWorkerBoot.toString() + ')()' : prefix + request.code + suffix;
    objectUrl = URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    worker = new Worker(objectUrl);
    worker.onmessage = message => {
      if (typeof message.data?.progress === 'string') { parent.postMessage({type:'ucc-lab-progress',token:request.token,message:message.data.progress}, '*'); return; }
      if (message.data?.started) { clearTimeout(timer); timer = setTimeout(()=>finish(null,'Python run stopped after 5 seconds. Check for an infinite loop or reduce the work.'),5000); return; }
      if (typeof message.data?.error === 'string') return finish(null,message.data.error.slice(0,1600));
      if (typeof message.data?.output !== 'string' || message.data.output.length > 24000) return finish(null,'The programme returned an invalid result.');
      try { finish(JSON.parse(message.data.output),null); } catch { finish(null,'The programme returned invalid JSON output.'); }
    };
    worker.onerror = error => { error.preventDefault(); finish(null,error.message||'The programme could not run. Check its syntax.'); };
    timer = setTimeout(()=>finish(null,python ? 'Python could not initialise within 60 seconds. Check the connection or choose Colab.' : 'Run stopped after 1.8 seconds. Check for an infinite loop or reduce the work.'),python ? 60000 : 1800);
    worker.postMessage(python ? {...request,pythonBase} : request.data);
  } catch(error) { finish(null,String(error&&error.message||error).slice(0,1000)); }
});
</script></body></html>`;

export function GET(request: Request) {
  // Next may construct an internal localhost URL behind a proxy. Serve assets from
  // the actual request host and its forwarded scheme, never an internal hostname.
  const url = new URL(request.url), host = request.headers.get("host");
  if (host && /^[a-zA-Z0-9.:[\]-]+$/.test(host)) url.host = host;
  const scheme = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (scheme === "https" || scheme === "http") url.protocol = scheme + ":";
  const base = `${url.origin}/api/learning-labs/python/${PYTHON_LAB_VERSION}/`;
  return new Response(page.replace("__PYTHON_BASE__", JSON.stringify(base).replaceAll("<", "\\u003c")), { headers: {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "content-security-policy": `default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' blob: ${base}; worker-src blob:; connect-src ${base}; img-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox allow-scripts`,
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "x-content-type-options": "nosniff",
    "x-frame-options": "SAMEORIGIN",
    "referrer-policy": "no-referrer",
  } });
}
