// Wrapper worker: load alt-ergo.js and delegate messages to its worker API when available.
// This wrapper is tolerant: it first imports the provided alt-ergo.js file and then
// tries to use any common entrypoints. It returns diagnostic information if no API
// is detected so the app can show helpful messages.
(function () {
  // remember any existing onmessage handler (should be undefined in a fresh worker)
  const prevOnMessage = self.onmessage;

  try {
    // Construct an absolute URL for the alt-ergo bundle to avoid invalid relative paths
    var scriptUrl = '/alt-ergo/alt-ergo.js';
    try {
      if (typeof location !== 'undefined' && location && location.origin) {
        scriptUrl = location.origin + '/alt-ergo/alt-ergo.js';
      }
    } catch (e) {
      // ignore and fall back to root-relative
    }

    importScripts(scriptUrl);
  } catch (e) {
    self.postMessage({ status: 'Error', errors: ['Failed to import ' + scriptUrl + ': ' + String(e)] });
    return;
  }

  // If the imported script already registered an onmessage handler, we assume it
  // is the proper js-worker and do nothing further (that handler will receive messages).
  if (self.onmessage && self.onmessage !== prevOnMessage) {
    // The imported alt-ergo.js appears to act as a worker already.
    self.postMessage({ status: 'Ready', results: ['Alt-Ergo worker loaded and handling messages directly'] });
    return;
  }

  // Otherwise, attempt to find common exported APIs and wire a handler.
  // Candidate entry points (best-effort):
  // - self.alt_ergo_solve(payload) -> Promise-like or sync
  // - self.altErgo and self.altErgo.solve
  // - self.Module && Module._entrypoint / Module.ccall wrappers
  // - self.run || self.solve || self.main

  function isPromiseLike(x) {
    return x && typeof x.then === 'function';
  }

  async function tryCallSolve(payload) {
    // 1) well-known alt-ergo worker helper
    if (typeof self.alt_ergo_solve === 'function') {
      return self.alt_ergo_solve(payload);
    }
    // 2) altErgo namespace
    if (typeof self.altErgo === 'object' && typeof self.altErgo.solve === 'function') {
      return self.altErgo.solve(payload);
    }
    // 3) generic solve/run functions
    const names = ['solve', 'run', 'main'];
    for (const n of names) {
      if (typeof self[n] === 'function') return self[n](payload);
    }

    // 4) Module pattern (js_of_ocaml often exposes a Module variable)
    if (typeof self.Module !== 'undefined') {
      const Module = self.Module;
      // Some builds expose a ccall/ccall wrapper to call exported functions
      if (typeof Module.ccall === 'function') {
        // Try common entrypoints; this is speculative.
        try {
          if (typeof Module.ccall === 'function') {
            // no-op: we don't know exact binding names; fallthrough to heuristic
          }
        } catch (e) {
          // ignore
        }
      }
    }

    // Heuristic fallback: scan global function names for likely entrypoints
    try {
      const keys = Object.keys(self || {}).filter(k => typeof self[k] === 'function');
      // Prefer names containing these tokens
      const tokens = ['solve', 'alt', 'run', 'main', 'check', 'prove'];
      for (const k of keys) {
        const lk = k.toLowerCase();
        if (tokens.some(t => lk.includes(t))) {
          try {
            const fn = self[k];
            const res = fn(payload);
            return res;
          } catch (e) {
            // ignore and continue
          }
        }
      }

      // Last-resort: try a few function globals (limit attempts)
      let attempts = 0;
      for (const k of keys) {
        if (attempts >= 6) break;
        try {
          const fn = self[k];
          attempts++;
          const res = fn(payload);
          return res;
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      // ignore heuristics errors
    }

    throw new Error('No known solver API found in alt-ergo.js; check the built js-worker or provide a real alt-ergo-worker.js');
  }

  self.onmessage = function (ev) {
    const payload = ev.data || {};

    try {
      const maybe = tryCallSolve(payload);
      if (isPromiseLike(maybe)) {
        maybe.then((res) => {
          // If the solver returned a structured response, forward it.
          try {
            self.postMessage(res);
          } catch (e) {
            self.postMessage({ status: 'Error', errors: ['Failed to post solver response: ' + String(e)] });
          }
        }).catch((err) => {
          self.postMessage({ status: 'Error', errors: ['Solver promise rejected: ' + String(err)] });
        });
      } else {
        // Synchronous return; forward it
        self.postMessage(maybe);
      }
    } catch (err) {
      self.postMessage({ status: 'NoApi', errors: [(err && err.message) || String(err), 'Diagnostics: available globals: ' + Object.keys(self).slice(0,200).join(', ')] });
    }
  };
})();
