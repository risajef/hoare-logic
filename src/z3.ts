export type Z3Result = {
  status: string;
  results?: string[];
  debugs?: string[];
  errors?: string[];
};

// Try to run a Z3 JS worker available at /z3/z3-worker.js
// Similar to previous alt-ergo helper: try creating a worker from the deployed URL first to avoid
// importScripts resolving issues when creating a worker from a blob URL. If that fails, fetch the
// script and create a blob worker.
export async function tryZ3(lines: string[], timeoutMs = 6000): Promise<Z3Result | null> {
  if (typeof Worker === 'undefined') return { status: 'NoSolver' };

  const workerUrl = '/z3/z3-worker.js';

  // First, try to create a worker directly from the deployed URL. This is the most robust approach
  // when the server serves the worker file and its imported assets with normal same-origin URLs.
  let worker: Worker | null = null;
  let usedBlob = false;
  let blobUrl: string | null = null;

  try {
    try {
      worker = new Worker(workerUrl);
      console.log('Created worker from URL:', workerUrl);
    } catch (err) {
      // Try module type then fallback to classic
      try {
        worker = new Worker(workerUrl, { type: 'module' } as any);
        console.log('Created module worker from URL:', workerUrl);
      } catch (err2) {
        worker = null;
      }
    }
  } catch (e) {
    worker = null;
  }

  if (!worker) {
    // Fallback: fetch script then create blob worker
    console.log('Falling back to blob worker');
    let scriptText: string;
    try {
      const resp = await fetch(workerUrl, { cache: 'no-store' });
      if (!resp.ok) {
        return { status: 'NoSolver', errors: [`Worker fetch failed: ${resp.status} ${resp.statusText}`] };
      }
      scriptText = await resp.text();
    } catch (err: any) {
      return { status: 'NoSolver', errors: [`Worker fetch error: ${err?.message || String(err)}`] };
    }

    if (scriptText.trim().startsWith('<')) {
      return { status: 'NoSolver', errors: ['Worker file appears to be HTML (404 or server error). Check that /z3/z3-worker.js is deployed and reachable.'] };
    }

    const blob = new Blob([scriptText], { type: 'application/javascript' });
    blobUrl = URL.createObjectURL(blob);
    usedBlob = true;

    try {
      // Decide whether to create a module worker or classic worker based on the script content.
      const usesImportScripts = /\bimportScripts\s*\(/.test(scriptText);

      if (usesImportScripts) {
        // Classic worker required
        worker = new Worker(blobUrl);
        console.log('Created classic blob worker');
      } else {
        // Prefer module worker for scripts that use ES module syntax; fall back to classic if it fails
        try {
          worker = new Worker(blobUrl, { type: 'module' } as any);
          console.log('Created module blob worker');
        } catch (err) {
          worker = new Worker(blobUrl);
          console.log('Created classic blob worker after module failed');
        }
      }
    } catch (err) {
      try {
        worker = new Worker(blobUrl);
        console.log('Created classic blob worker on retry');
      } catch (e) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return { status: 'NoSolver', errors: [`Failed to create worker: ${String(err)}`] };
      }
    }
  }

  return new Promise<Z3Result | null>((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { worker?.terminate(); } catch {}
      if (usedBlob && blobUrl) URL.revokeObjectURL(blobUrl);
      resolve({ status: 'Timeout' });
    }, timeoutMs);

    worker!.onmessage = (ev: MessageEvent) => {
      const data = ev.data || {};
      console.log('Worker message:', data);

      // Only treat messages containing results or final errors as completion events.
      // Informational/status/debug messages (e.g. { status: 'Fallback', debugs: [...] }) are ignored so
      // we wait for the actual solver response after posting the payload.
      const hasResults = Array.isArray(data?.results) && data.results.length > 0;
      const hasErrors = Array.isArray(data?.errors) && data.errors.length > 0;

      if (!hasResults && !hasErrors) {
        // ignore informational messages but keep debug info in case of later errors
        return;
      }

      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (usedBlob && blobUrl) URL.revokeObjectURL(blobUrl);

      try {
        const results: string[] | undefined = data?.results || data?.results_lines || undefined;
        console.log('results', results)
        let statusStr = 'Unknown';
        if (results && results.length > 0) {
          
          const someUnsat = results.some(result => result.toLowerCase() === 'unsat');
          const allSat = results.every(result => result.toLowerCase() === 'sat');

          if (allSat) {
            statusStr = 'Valid';
          } else if (someUnsat) {
            statusStr = 'Invalid';
          } else {
            statusStr = 'Unknown';
          }
        }
        if (!results && data?.status && typeof data.status === 'object') {
          const keys = Object.keys(data.status);
          if (keys.includes('unsat') || keys.includes('Unsat')) statusStr = 'Valid';
          else if (keys.includes('sat') || keys.includes('Sat')) statusStr = 'Invalid';
          else statusStr = keys[0] || 'Unknown';
        }

        try { worker?.terminate(); } catch {}
        resolve({ status: statusStr, results: results, debugs: data?.debugs, errors: data?.errors });
      } catch (e) {
        try { worker?.terminate(); } catch {}
        resolve({ status: 'Error', errors: [String(e)] });
      }
    };

    worker!.onerror = (ev) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try { worker?.terminate(); } catch {}
      if (usedBlob && blobUrl) URL.revokeObjectURL(blobUrl);
      const msg = ev?.message || String(ev);
      resolve({ status: 'Error', errors: [msg] });
    };

    const payload = { filename: 'input.smt2', content: lines };
    try {
      worker!.postMessage(payload);
    } catch (e) {
      try { worker?.terminate(); } catch {}
      if (usedBlob && blobUrl) URL.revokeObjectURL(blobUrl);
      clearTimeout(timer);
      resolve({ status: 'NoSolver', errors: [String(e)] });
    }
  });
}
