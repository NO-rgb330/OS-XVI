let pyodide = null;
let loadingPromise = null;

export async function initPython() {
  if (pyodide) return pyodide;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    if (!window.loadPyodide) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'));
        document.head.appendChild(script);
      });
    }
    
    pyodide = await window.loadPyodide({
      stdout: (text) => console.log('[Python]', text),
      stderr: (text) => console.error('[Python]', text),
      stdin: () => prompt('Python input:') || ''
    });
    
    console.log('Python runtime ready');
    return pyodide;
  })();

  return loadingPromise;
}

export function getPython() {
  return pyodide;
}
