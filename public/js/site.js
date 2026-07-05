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
