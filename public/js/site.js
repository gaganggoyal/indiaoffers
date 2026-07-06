/* IndiaOffers v2 — tiny progressive enhancements (site works fully without JS). */
'use strict';

// ── Mobile nav: hamburger toggle ──────────────────────────────────────────────
// Without JS the nav simply shows stacked; adding `js-nav` lets CSS collapse it
// behind the hamburger button, which we then wire up here.
(function () {
  const header = document.querySelector('.header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!header || !toggle || !nav) return;
  header.classList.add('js-nav');
  const setOpen = open => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
})();

// ── PWA: register the service worker (enables "Add to Home Screen" + offline) ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

// ── PWA: show our own "Install app" button only when the browser offers install ──
(function () {
  let deferred = null;
  const btn = document.getElementById('pwa-install');
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();                 // suppress the mini-infobar; use our button
    deferred = e;
    if (btn) btn.hidden = false;
  });
  if (btn) btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { if (btn) btn.hidden = true; });
})();

// Copy-to-clipboard for coupon codes
document.addEventListener('click', e => {
  const btn = e.target.closest('.btn-copy');
  if (!btn) return;
  const code = btn.dataset.code;
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const prev = btn.textContent;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = prev; }, 1600);
  });
});

// ── Searchable grouped multi-select (categories / bank cards) ─────────────────
document.querySelectorAll('.msearch').forEach(root => {
  root.classList.add('js');                         // signals CSS to hide the raw list
  const chips  = root.querySelector('.ms-chips');
  const input  = root.querySelector('.ms-search');
  const menu   = root.querySelector('.ms-menu');
  const empty  = root.querySelector('.ms-empty');
  const opts   = [...root.querySelectorAll('.ms-opt')];
  const boxes  = opts.map(o => o.querySelector('input'));

  const open = () => { menu.hidden = false; input.setAttribute('aria-expanded', 'true'); };
  const close = () => { menu.hidden = true; input.setAttribute('aria-expanded', 'false'); };

  function renderChips() {
    chips.innerHTML = '';
    boxes.filter(b => b.checked).forEach(b => {
      const label = b.closest('.ms-opt').querySelector('.ms-otext').textContent.trim();
      const chip = document.createElement('span');
      chip.className = 'ms-chip';
      chip.innerHTML = '<span></span><button type="button" aria-label="Remove">×</button>';
      chip.querySelector('span').textContent = label;
      chip.querySelector('button').addEventListener('click', e => {
        e.stopPropagation(); b.checked = false; renderChips(); filter();
      });
      chips.appendChild(chip);
    });
    input.placeholder = boxes.some(b => b.checked) ? 'Add more…' : root.dataset.placeholder;
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    let any = false;
    root.querySelectorAll('.ms-group').forEach(g => {
      let shown = 0;
      g.querySelectorAll('.ms-opt').forEach(o => {
        const hit = !q || o.dataset.text.includes(q);
        o.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      g.style.display = shown ? '' : 'none';
      if (shown) any = true;
    });
    if (empty) empty.hidden = any;
  }

  opts.forEach((o, i) => o.addEventListener('click', e => {
    // Let the native checkbox toggle, then sync UI.
    setTimeout(() => { renderChips(); }, 0);
  }));
  root.querySelector('.ms-control').addEventListener('click', e => {
    if (e.target === input || e.target.closest('.ms-chip')) return;
    input.focus();
  });
  input.addEventListener('focus', open);
  input.addEventListener('input', () => { open(); filter(); });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); input.blur(); } });
  root.querySelector('.ms-caret').addEventListener('click', () => (menu.hidden ? open() : close()));
  document.addEventListener('click', e => { if (!root.contains(e.target)) close(); });

  renderChips();
  filter();
});
