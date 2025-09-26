export type AltErgoResult = {
  status: string;
  results?: string[];
  debugs?: string[];
  errors?: string[];
};

// Try to run an Alt-Ergo JS worker available at /alt-ergo/alt-ergo-worker.js
// This helper first fetches the worker file to ensure it is valid JS (not an HTML 404 page)
// which would otherwise cause an uncaught SyntaxError: Unexpected token '<' when the browser
// tries to parse the worker as JS.
export async function tryAltErgo(lines: string[], timeoutMs = 6000): Promise<AltErgoResult | null> {
  if (typeof Worker === 'undefined') return { status: 'NoSolver' };

  const workerUrl = '/alt-ergo/alt-ergo-worker.js';

  // First attempt to fetch the worker script to detect HTML/404 responses
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

  // If the fetched text looks like HTML (starts with '<'), we likely got an HTML error page
  if (scriptText.trim().startsWith('<')) {
    return { status: 'NoSolver', errors: ['Worker file appears to be HTML (404 or server error). Check that /alt-ergo/alt-ergo-worker.js is deployed and reachable.'] };
  }

  // Create a blob URL to instantiate the worker from the fetched script text
  const blob = new Blob([scriptText], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);

  let worker: Worker | null = null;
  try {
    worker = new Worker(blobUrl);
  } catch (err) {
    URL.revokeObjectURL(blobUrl);
    return { status: 'NoSolver', errors: [`Failed to create worker: ${String(err)}`] };
  }

  return new Promise<AltErgoResult | null>((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { worker?.terminate(); } catch {}
      URL.revokeObjectURL(blobUrl);
      resolve({ status: 'Timeout' });
    }, timeoutMs);

    worker!.onmessage = (ev: MessageEvent) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      URL.revokeObjectURL(blobUrl);

      const data = ev.data;
      try {
        const results: string[] | undefined = data?.results || data?.results_lines || undefined;
        let statusStr = 'Unknown';
        if (results && results.length > 0) {
          const joined = results.join('\n');
          if (/\bValid\b/i.test(joined) || /unsat/i.test(joined)) statusStr = 'Valid';
          else if (/\bInvalid\b/i.test(joined) || /sat/i.test(joined)) statusStr = 'Invalid';
          else if (/unknown|I don't know|Unknown/i.test(joined)) statusStr = 'Unknown';
          else statusStr = 'Unknown';
        }
        if (!results && data?.status && typeof data.status === 'object') {
          const keys = Object.keys(data.status);
          if (keys.includes('Unsat')) statusStr = 'Valid';
          else if (keys.includes('Sat')) statusStr = 'Invalid';
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
      URL.revokeObjectURL(blobUrl);
      const msg = ev?.message || String(ev);
      resolve({ status: 'Error', errors: [msg] });
    };

    const payload = { filename: 'input.ae', content: lines };
    try {
      worker!.postMessage(payload);
    } catch (e) {
      try { worker?.terminate(); } catch {}
      URL.revokeObjectURL(blobUrl);
      clearTimeout(timer);
      resolve({ status: 'NoSolver', errors: [String(e)] });
    }
  });
}
