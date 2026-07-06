/* IndiaOffers v2 — tiny progressive enhancements (site works fully without JS). */
'use strict';

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
