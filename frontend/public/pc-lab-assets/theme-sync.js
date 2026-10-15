/* Nested same-origin lab documents follow the site's theme without reloading
   the exercise or touching its progress. Standalone previews use the saved theme. */
(() => {
  const root = document.documentElement;
  let host = null;
  try {
    if (parent !== window && parent.location.origin === location.origin) {
      host = parent.document.documentElement;
    }
  } catch { /* An embedded cross-origin preview uses its own saved preference. */ }

  function syncTheme() {
    let theme = host?.getAttribute('data-theme');
    if (!theme) {
      try { theme = localStorage.getItem('aitutor-theme'); }
      catch { /* Storage is optional for the public lab. */ }
    }
    root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }
  const observer = new MutationObserver(syncTheme);
  function connect() {
    syncTheme();
    if (host) observer.observe(host, { attributes: true, attributeFilter: ['data-theme'] });
  }
  connect();
  window.addEventListener('pagehide', () => observer.disconnect());
  window.addEventListener('pageshow', connect);
  window.addEventListener('storage', event => {
    if (event.key === 'aitutor-theme' || event.key === null) syncTheme();
  });
})();
