// Browser Z3 worker: load the Z3 WASM JS wrapper and run SMT-LIB payloads posted from the main thread.
// Expects the Z3 JS/WASM files to live under /z3/z3.wasm/ (z3w.js, z3w.wasm, protocol.js).

// Attempt to load protocol.js and z3w.js via importScripts (worker-global import).
// This avoids eval scoping issues and reduces constant reassignment risks.
async function loadZ3Assets() {
  const relBase = '/z3/z3.wasm/';
  const protocolPath = relBase + 'protocol.js';
  const wrapperPath = relBase + 'z3w.js';

  try {
    // Ensure Module exists and provide locateFile without reassigning a const.
    try {
      if (typeof self !== 'undefined') {
        if (!self.Module) {
          // create Module if not present
          self.Module = {};
        }
        // only set locateFile if not already set
        if (!self.Module.locateFile) {
          self.Module.locateFile = function (path) { return '/z3/z3.wasm/' + path; };
        }
      }
    } catch (e) {
      // Ignore errors when accessing Module; continue to attempt import
    }

    // Prefer importScripts when available (worker environment)
    if (typeof importScripts === 'function') {
      importScripts(protocolPath, wrapperPath);
      try { self.postMessage({ status: 'AssetsLoaded', debugs: ['protocol.js and z3 wrapper loaded via importScripts'] }); } catch (e) {}
      return true;
    }

    // Fallback: attempt to fetch+eval if importScripts isn't available
    // (kept for completeness, but are unlikely in worker)
    const respProto = await fetch(protocolPath);
    const respWrap = await fetch(wrapperPath);
    if (!respProto.ok || !respWrap.ok) {
      throw new Error('Failed to fetch Z3 assets: ' + protocolPath + ' / ' + wrapperPath);
    }
    const protoTxt = await respProto.text();
    const wrapTxt = await respWrap.text();
    (0, eval)(protoTxt);
    (0, eval)(wrapTxt);
    try { self.postMessage({ status: 'AssetsLoaded', debugs: ['protocol.js and z3 wrapper loaded via fetch+eval'] }); } catch (e) {}
    return true;
  } catch (e) {
    try { self.postMessage({ status: 'Error', errors: ['Failed to load Z3 assets: ' + String(e)] }); } catch (er) {}
    return false;
  }
}

// Load assets and then initialize the solver once assets are available.
loadZ3Assets().then((ok) => {
  if (ok) {
    initSolver();
  }
}).catch((e) => {
  try { self.postMessage({ status: 'Error', errors: ['Failed to load Z3 assets: ' + String(e)] }); } catch (e) {}
});

let solver = null;
let ready = false;
const INPUT_FNAME = 'input.smt2';

// Buffers to collect output printed by Z3
let stdoutLines = [];
let stderrLines = [];

function postResult(obj) {
  try {
    self.postMessage(obj);
  } catch (e) {
    // ignore
  }
}

function initSolver() {
  if (solver || typeof Z3 === 'undefined') return;

  // Initialize Z3 with handlers to capture output. Provide locateFile so the wasm is loaded from the known folder.
  solver = Z3({
    ENVIRONMENT: 'WORKER',
    locateFile: (path) => {
      // Ensure wasm and associated files are loaded from /z3/z3.wasm/
      return '/z3/z3.wasm/' + path;
    },
    print: function (msg) {
      if (typeof msg === 'string') {
        // split on newlines and push non-empty
        msg.split(/\r?\n/).forEach(s => { if (s.trim() !== '') stdoutLines.push(s); });
      }
    },
    printErr: function (msg) {
      if (typeof msg === 'string') {
        msg.split(/\r?\n/).forEach(s => { if (s.trim() !== '') stderrLines.push(s); });
      }
    },
    onRuntimeInitialized: function () {
      ready = true;
      postResult({ status: 'Ready', debugs: ['Z3 runtime initialized in worker'] });
    }
  });
}

// Note: do NOT initialize here prematurely; initSolver is called after assets load above.
// Initialize immediately (attempt; actual readiness is signalled via onRuntimeInitialized)
// initSolver();

self.onmessage = async (ev) => {
  const data = ev.data || {};

  // Accept two payload shapes:
  // 1) { filename, content } where content is array of strings or a single string (used by tryZ3)
  // 2) protocol-style messages: { kind: queries.VERIFY, payload: { input, args } }

  let content = null;
  // default args: request SMTLIB2 parsing. Do NOT include a program-name token ('z3') which
  // Emscripten/Z3 will interpret as a filename to open.
  let args = ['-smt2'];

  if (data && data.kind === (self.queries && self.queries.VERIFY)) {
    const pl = data.payload || {};
    content = pl.input || '';
    if (Array.isArray(pl.args) && pl.args.length) args = pl.args.slice();
  } else if (data && (data.filename !== undefined || data.content !== undefined)) {
    content = data.content !== undefined ? data.content : '';
  } else if (data && data.payload && (data.payload.content || data.payload.input)) {
    content = data.payload.content || data.payload.input;
  } else {
    // Unknown message shape — ignore
    return;
  }

  if (Array.isArray(content)) content = content.join('\n');
  content = String(content || '');

  // Ensure solver initialized
  if (!solver || !ready) {
    // Try to (re)initialize and wait for runtime init. Many browsers load WASM asynchronously
    // so the main thread may post a job before onRuntimeInitialized fires. Instead of failing
    // immediately, poll for readiness for a short period.
    try {
      initSolver();
    } catch (e) {
      postResult({ status: 'Error', errors: ['Failed to initialize Z3 runtime: ' + String(e)] });
      return;
    }

    // wait up to maxWaitMs for ready flag to become true
    const maxWaitMs = 3000;
    const pollInterval = 50;
    let waited = 0;
    while (!ready && waited < maxWaitMs) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, pollInterval));
      waited += pollInterval;
    }

    if (!ready) {
      // still not ready; return NoApi so main can fallback
      postResult({ status: 'NoApi', errors: ['Z3 runtime not ready in worker.'] });
      return;
    }
  }

  // Clear output buffers
  stdoutLines = [];
  stderrLines = [];

  try {
    // Write input to Emscripten FS
    try { solver.FS.unlink(INPUT_FNAME); } catch (e) { /* ignore */ }
    solver.FS.writeFile(INPUT_FNAME, content, { encoding: 'utf8' });

    // run Z3. Provide args and ensure INPUT_FNAME is included if not already.
    var provided = Array.isArray(args) ? args.slice() : [];
    provided = provided.filter(a => (typeof a === 'string' && a.trim() !== '' && a !== 'z3'));

    // If the args do not include an SMT input filename, append ours. Consider any arg that
    // looks like a filename (ends with .smt2 or equals INPUT_FNAME) as indicating the input was already specified.
    const hasFileLike = provided.some(a => (typeof a === 'string' && (a === INPUT_FNAME || /\.smt2$/i.test(a))));
    if (!hasFileLike) {
      provided.push(INPUT_FNAME);
    }

    // Call main (this runs the Emscripten program synchronously)
    // Emit debug info: args, FS listing, input file existence and a short preview
    try {
      const fsList = (solver && solver.FS) ? (() => { try { return solver.FS.readdir('/'); } catch (e) { return ['FS_ERROR', String(e)]; } })() : null;
      const inputExists = (solver && solver.FS) ? (() => { try { return solver.FS.lookupPath(INPUT_FNAME).exists; } catch (e) { return String(e); } })() : null;
      const inputPreview = (solver && solver.FS) ? (() => { try { const s = solver.FS.readFile(INPUT_FNAME, { encoding: 'utf8' }); return typeof s === 'string' ? s.slice(0, 512) : String(s).slice(0,512); } catch (e) { return String(e); } })() : null;
      postResult({ debugs: ['About to callMain'], args: provided, fs: fsList, inputExists: inputExists, inputPreview: inputPreview });
    } catch (e) {
      try { postResult({ debugs: ['Failed to collect debug info before callMain'], error: String(e) }); } catch (er) {}
    }

    // Deduplicate args and ensure we don't accidentally pass a stray 'z3' token
    provided = provided.filter(a => a !== 'z3');
    // keep order but remove duplicates
    const seen = new Set();
    const sanitized = [];
    for (const a of provided) {
      if (typeof a !== 'string') continue;
      if (!seen.has(a)) {
        seen.add(a);
        sanitized.push(a);
      }
    }
    // Call Emscripten main with sanitized argv. Do NOT prepend 'z3' — some builds treat that as a filename.
    solver.callMain(sanitized);

    // After execution, collect stdoutLines and stderrLines and post result
    try { postResult({ debugs: ['callMain completed, collecting output'], stdoutLen: stdoutLines.length, stderrLen: stderrLines.length }); } catch (e) {}
     if (stdoutLines.length > 0) {
       postResult({ results: stdoutLines, debugs: ['z3 run completed'] });
       return;
     }

    // If no stdout, but stderr contains something, report as error
    if (stderrLines.length > 0) {
      postResult({ status: 'Error', errors: stderrLines });
      return;
    }

    // Nothing produced — unknown
    postResult({ results: ['unknown'], debugs: ['z3 produced no stdout/stderr'] });
  } catch (err) {
    postResult({ status: 'Error', errors: ['Worker execution error: ' + String(err)] });
  }
};
