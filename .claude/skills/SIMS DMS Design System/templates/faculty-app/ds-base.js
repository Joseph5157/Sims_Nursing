// templates/faculty-app/ds-base.js
// Loads the SIMS DMS design system (global CSS + component bundle) for this template.
// In a consuming project, point `base` at the bound _ds/<folder> tree relative to this page.
(() => {
  const base = '../..';
  for (const p of ['styles.css']) {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = base + '/' + p;
    document.head.appendChild(l);
  }
  // Skip if a synchronous loader already defined the bundle (see index.html head).
  if (document.querySelector('script[data-ds-bundle]')) return;
  const s = document.createElement('script');
  s.src = base + '/_ds_bundle.js';
  s.onerror = () => console.error('ds-base.js: failed to load ' + s.src +
    ' — if this is a consuming project, point the base line at the bound _ds/<folder> tree relative to this page; in a fresh design system this can mean the bundle is not compiled yet');
  document.head.appendChild(s);
})();
