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

// ── Header search: live suggestions (stores, deals, cards, guides) ────────────
(function () {
  const form = document.querySelector('.header .search');
  if (!form) return;
  const input = form.querySelector('input[name=q]');
  const box = document.createElement('div');
  box.className = 'sg-box';
  box.hidden = true;
  form.appendChild(box);

  const fmt = n => '₹' + Number(n).toLocaleString('en-IN');
  let ctrl = null, timer = null, items = [], sel = -1;

  const close = () => { box.hidden = true; sel = -1; };
  const esc = s => { const d = document.createElement('span'); d.textContent = s; return d.innerHTML; };

  function render(r, q) {
    const rows = [];
    r.stores.forEach(s => rows.push({
      url: '/store/' + s.slug,
      html: `${s.icon ? `<img src="${esc(s.icon)}" alt="" loading="lazy">` : `<i style="background:${esc(s.color || '#64748b')}"></i>`}<span><b>${esc(s.name)}</b><small>Store — deals &amp; coupons</small></span>`
    }));
    r.deals.forEach(d => rows.push({
      url: '/deal/' + d.slug,
      html: `<em>🛍️</em><span><b>${esc(d.title)}</b><small>${d.price != null ? 'Deal — ' + fmt(d.price) : 'Deal'}</small></span>`
    }));
    r.cards.forEach(c => rows.push({
      url: '/card/' + c.slug,
      html: `<em>💳</em><span><b>${esc(c.name)}</b><small>${esc(c.bank)} — bank card</small></span>`
    }));
    r.guides.forEach(g => rows.push({
      url: '/guide/' + g.slug,
      html: `<em>📖</em><span><b>${esc(g.title)}</b><small>Buying guide</small></span>`
    }));
    rows.push({ url: '/search?q=' + encodeURIComponent(q), html: `<em>🔍</em><span><b>Search everything for “${esc(q)}”</b></span>`, all: true });

    items = rows;
    sel = -1;
    box.innerHTML = rows.map((row, i) =>
      `<a class="sg-item${row.all ? ' sg-all' : ''}" data-i="${i}" href="${row.url}">${row.html}</a>`).join('');
    box.hidden = false;
  }

  function fetchSuggest() {
    const q = input.value.trim();
    if (q.length < 2) { close(); return; }
    if (ctrl) ctrl.abort();
    ctrl = new AbortController();
    fetch('/api/suggest?q=' + encodeURIComponent(q), { signal: ctrl.signal })
      .then(r => r.json())
      .then(r => render(r, q))
      .catch(() => {});
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(fetchSuggest, 180); });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) fetchSuggest(); });
  input.addEventListener('keydown', e => {
    if (box.hidden) return;
    const links = [...box.querySelectorAll('.sg-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sel = e.key === 'ArrowDown' ? Math.min(sel + 1, links.length - 1) : Math.max(sel - 1, -1);
      links.forEach((l, i) => l.classList.toggle('on', i === sel));
      if (sel >= 0) links[sel].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && sel >= 0) {
      e.preventDefault();
      location.href = links[sel].href;
    } else if (e.key === 'Escape') {
      close();
    }
  });
  document.addEventListener('click', e => { if (!form.contains(e.target)) close(); });
})();

// ── /stores: instant store filter (all stores are already on the page) ────────
(function () {
  const input = document.getElementById('store-filter');
  if (!input) return;
  const cards = [...document.querySelectorAll('.store-grid .store-card')];
  const empty = document.getElementById('store-filter-empty');
  const names = cards.map(c => (c.querySelector('b') || c).textContent.trim().toLowerCase());
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    cards.forEach((c, i) => {
      const hit = !q || names[i].includes(q);
      c.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  });
})();

// ── Searchable grouped multi-select (categories / bank cards) ─────────────────
document.querySelectorAll('.msearch').forEach(root => {
  root.classList.add('js');                         // signals CSS to hide the raw list
  const chips  = root.querySelector('.ms-chips');
  const input  = root.querySelector('.ms-search');
  const menu   = root.querySelector('.ms-menu');
  const empty  = root.querySelector('.ms-empty');
  const opts   = [...root.querySelectorAll('.ms-opt')];
  const boxes  = opts.map(o => o.querySelector('input'));
  const count  = root.querySelector('.ms-count');

  // Keep the menu (incl. its Done footer) clear of the mobile bottom tab bar /
  // viewport edge — the control grows as chips are added, pushing the menu down.
  const nudge = () => requestAnimationFrame(() => {
    if (menu.hidden) return;
    const gap = menu.getBoundingClientRect().bottom - (window.innerHeight - 90);
    if (gap > 0) window.scrollBy({ top: gap, behavior: 'smooth' });
  });
  const open = () => {
    if (!menu.hidden) return;
    menu.hidden = false; root.classList.add('ms-open'); input.setAttribute('aria-expanded', 'true');
    nudge();
  };
  const close = () => { menu.hidden = true; root.classList.remove('ms-open'); input.setAttribute('aria-expanded', 'false'); };

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
    if (count) {
      const n = boxes.filter(b => b.checked).length;
      count.textContent = n ? n + ' selected' : 'Pick as many as you like';
    }
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
    // Let the native checkbox toggle, then sync UI. Clear the search so the
    // full list is back for the next pick (and keep focus for fast multi-add).
    setTimeout(() => { renderChips(); input.value = ''; filter(); input.focus(); nudge(); }, 0);
  }));
  const done = root.querySelector('.ms-done');
  if (done) done.addEventListener('click', () => { close(); input.blur(); });
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
