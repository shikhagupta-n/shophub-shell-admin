import './index.css';

// Ensure optional analytics globals exist.
// Reason: some pages call `window.gtag` and should not crash when GA script isn't injected.
if (typeof window !== 'undefined' && typeof window.gtag !== 'function') {
  window.gtag = () => {};
}

async function start() {
  const [{ default: React }, { default: ReactDOM }, { default: App }] = await Promise.all([
    import('react'),
    import('react-dom/client'),
    import('./App.jsx'),
  ]);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

start().catch((e) => {
  console.error('[shell-admin] Failed to start app:', e);
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = `<pre style="padding:16px;white-space:pre-wrap;font-family:ui-monospace,monospace;color:#111">Startup failed:\n${String(
      e?.message ?? e,
    )}</pre>`;
  }
});

