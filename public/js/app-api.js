/**
 * IndiaOffers.in — API wiring layer.
 * Loads AFTER app-original.js and overrides every function that used to
 * mutate localStorage demo data, replacing it with real backend calls.
 * Rendering functions in app-original.js are untouched — they keep reading
 * the caches that IOApi.hydrate()/refreshMe() fill from the server.
 */

'use strict';

/* ═══════════════════════ AUTH ═══════════════════════ */

async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('Please fill all fields', 'error'); return; }
  try {
    const data = await IOApi.post('/api/auth/login', { email, password });
    IOApi.setToken(data.token);
    DB.setCurrentUser(data.user);
    await IOApi.refreshMe();
    updateAuthUI();
    showToast(`Welcome back, ${data.user.name}!`, 'success');
    setTimeout(() => navigate(data.user.isAdmin ? 'admin' : 'dashboard'), 500);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleSignup() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const referral = document.getElementById('signupReferral').value.trim();

  if (!name || !email || !password) { showToast('Please fill all required fields', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

  try {
    const data = await IOApi.post('/api/auth/register', { name, email, phone, password, referralCode: referral });
    IOApi.setToken(data.token);
    DB.setCurrentUser(data.user);
    await IOApi.refreshMe();
    updateAuthUI();
    showToast(`🎉 Account created! ₹${data.user.wallet} welcome bonus added.`, 'success');
    setTimeout(() => navigate('dashboard'), 500);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function logout() {
  IOApi.setToken(null);
  DB.setCurrentUser(null);
  ['orders', 'claims', 'withdrawals', 'favorites', 'referrals', 'notifications'].forEach(k => DB.set(k, []));
  updateAuthUI();
  showToast('Logged out successfully');
  navigate('home');
}

/* ═══════════════════════ SHOP & TRACK (real affiliate redirect) ═══════════════════════ */

function trackCashback(dealId) {
  const user = DB.getCurrentUser();
  if (!user) { showToast('Please login to track cashback', 'error'); navigate('auth'); return; }
  const deal = DB.get('deals').find(d => d.id === dealId);
  if (!deal) return;
  const store = DB.get('stores').find(s => s.id === deal.storeId);

  // Server logs the click, sets the io_click cookie, appends the affiliate
  // tag (Amazon tag / Flipkart affid / etc.) and redirects to the merchant.
  // The sale itself is tracked by postback/pixel/report — no fake orders.
  const merchantUrl = (store && store.affiliateUrl) || `https://${store ? store.url : ''}`;
  const goUrl = `${window.IO_API_BASE || ''}/go/${encodeURIComponent(store ? store.id : 'unknown')}`
              + `?url=${encodeURIComponent(merchantUrl)}`
              + `&uid=${encodeURIComponent(user.id)}`
              + `&deal=${encodeURIComponent(deal.id)}`;

  showToast('🎉 Redirecting to store… your purchase will be tracked automatically!', 'success');
  window.open(goUrl, '_blank', 'noopener');
}

/* ═══════════════════════ ORDER TRACKING ═══════════════════════ */

async function submitOrderTracking() {
  const storeId = document.getElementById('trackStore').value;
  const orderNumber = document.getElementById('trackOrderNum').value.trim();
  const amount = parseFloat(document.getElementById('trackAmount').value);
  const orderDate = document.getElementById('trackDate').value;
  const coupon = document.getElementById('trackCoupon').value.trim();
  const receiptFile = document.getElementById('receiptFile').files[0];

  if (!orderNumber || !amount || !orderDate) { showToast('Please fill all required fields', 'error'); return; }

  try {
    await IOApi.post('/api/orders', {
      storeId, orderNumber, orderAmount: amount, orderDate,
      couponUsed: coupon, receiptUploaded: !!receiptFile
    });
    await IOApi.refreshMe();
    updateNotifCount();
    closeModal('dealModal');
    showToast('✅ Order submitted! Tracking started.', 'success');
    renderTracking();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmReceiptUpload(orderId) {
  try {
    await IOApi.post(`/api/orders/${encodeURIComponent(orderId)}/receipt`);
    await IOApi.refreshMe();
    closeModal('dealModal');
    showToast('✅ Receipt uploaded!', 'success');
    renderTracking();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitEscalation(orderId) {
  const type = document.getElementById('escalateType').value;
  const desc = document.getElementById('escalateDesc').value;
  if (!desc) { showToast('Please describe the issue', 'error'); return; }
  try {
    await IOApi.post(`/api/orders/${encodeURIComponent(orderId)}/escalate`, { issueType: type, description: desc });
    await IOApi.refreshMe();
    closeModal('dealModal');
    showToast('⚠️ Order escalated. Support will contact within 24 hours.', 'success');
    renderTracking();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitClaim() {
  const storeId = document.getElementById('claimStore').value;
  const orderNumber = document.getElementById('claimOrderNum').value.trim();
  const orderAmount = parseFloat(document.getElementById('claimAmount').value);
  const orderDate = document.getElementById('claimDate').value;
  const expectedCashback = parseFloat(document.getElementById('claimCashback').value);
  const desc = document.getElementById('claimDesc').value.trim();
  const receipt = document.getElementById('claimReceipt').files[0];

  if (!orderNumber || !orderAmount || !orderDate || !expectedCashback || !desc) {
    showToast('Please fill all required fields', 'error'); return;
  }

  try {
    await IOApi.post('/api/claims', {
      storeId, orderNumber, orderAmount, orderDate, expectedCashback,
      notes: desc, receiptUploaded: !!receipt
    });
    await IOApi.refreshMe();
    showToast('✅ Claim submitted! We\'ll investigate within 7 days.', 'success');
    renderMissingCashback();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════ WALLET ═══════════════════════ */

async function requestWithdrawal() {
  const amount = parseInt(document.getElementById('withdrawAmount').value, 10);
  const details = document.getElementById('withdrawDetails').value.trim();
  if (!amount || amount < 250) { showToast('Minimum withdrawal is ₹250', 'error'); return; }
  if (!details) { showToast('Please enter account details', 'error'); return; }

  try {
    await IOApi.post('/api/withdraw', { amount, method: selectedWithdrawMethod, details });
    await IOApi.refreshMe();
    updateAuthUI();
    showToast('Withdrawal requested! Processing in 24-48 hours.', 'success');
    renderWallet();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════ FAVORITES / PROFILE / NOTIFICATIONS ═══════════════════════ */

function toggleFavorite(dealId) {
  const user = DB.getCurrentUser();
  if (!user) { navigate('auth'); return; }
  // Optimistic local update, then persist
  let favs = DB.get('favorites');
  const idx = favs.findIndex(f => f.userId === user.id && f.dealId === dealId);
  if (idx >= 0) { favs.splice(idx, 1); showToast('Removed from favorites'); }
  else { favs.push({ userId: user.id, dealId }); showToast('Added to favorites ❤️', 'success'); }
  DB.set('favorites', favs);
  IOApi.post('/api/favorites/toggle', { dealId }).catch(() => {});
  renderHome();
  if (document.getElementById('view-favorites').classList.contains('active')) renderFavorites();
  if (document.getElementById('view-deals').classList.contains('active')) renderAllDeals();
}

async function updateProfile() {
  const name = document.getElementById('profileName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  if (!name || !email) { showToast('Please fill all fields', 'error'); return; }
  try {
    await IOApi.put('/api/profile', { name, email, phone });
    await IOApi.refreshMe();
    updateAuthUI(); updateSidebar();
    showToast('Profile updated!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function changePassword() {
  const current = document.getElementById('currentPassword').value;
  const newPass = document.getElementById('newPassword').value;
  if (newPass.length < 6) { showToast('Password must be 6+ chars', 'error'); return; }
  try {
    await IOApi.put('/api/password', { currentPassword: current, newPassword: newPass });
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    showToast('Password changed!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function markNotifRead(id) {
  const notifs = DB.get('notifications');
  const n = notifs.find(x => x.id === id);
  if (n) n.read = true;
  DB.set('notifications', notifs);
  IOApi.post('/api/notifications/read', { id }).catch(() => {});
  updateNotifCount();
  renderNotifications();
}

function markAllRead(e) {
  e.stopPropagation();
  const user = DB.getCurrentUser();
  if (!user) return;
  const notifs = DB.get('notifications');
  notifs.forEach(n => { if (n.userId === user.id) n.read = true; });
  DB.set('notifications', notifs);
  IOApi.post('/api/notifications/read', {}).catch(() => {});
  updateNotifCount();
  renderNotifications();
}

/* ═══════════════════════ ADMIN ═══════════════════════ */

async function renderAdmin() {
  const admin = DB.getCurrentUser();
  document.getElementById('adminAvatar').textContent = admin.name.charAt(0).toUpperCase();
  document.getElementById('adminName').textContent = admin.name;
  document.getElementById('adminEmail').textContent = admin.email;
  try {
    await IOApi.refreshAdmin();
  } catch (err) {
    showToast('Failed to load admin data: ' + err.message, 'error');
  }
  renderAdminContent();
}

async function advanceOrderStatus(orderId) {
  try {
    await IOApi.post(`/api/admin/orders/${encodeURIComponent(orderId)}/advance`);
    await IOApi.refreshAdmin();
    showToast('Order status advanced', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function adminClaimAction(id, action) {
  try {
    await IOApi.post(`/api/admin/claims/${encodeURIComponent(id)}`, { action });
    await IOApi.refreshAdmin();
    showToast(action === 'approve' ? 'Claim approved! Cashback credited.' : 'Claim updated', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function updateClaimStatus(id) { adminClaimAction(id, 'investigate'); }
function approveClaim(id)      { adminClaimAction(id, 'approve'); }
function rejectClaim(id)       { adminClaimAction(id, 'reject'); }

async function adminWithdrawalAction(id, action) {
  try {
    await IOApi.post(`/api/admin/withdrawals/${encodeURIComponent(id)}`, { action });
    await IOApi.refreshAdmin();
    showToast(action === 'approve' ? 'Withdrawal approved!' : 'Withdrawal rejected. Amount refunded.', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
function approveWithdrawal(id) { adminWithdrawalAction(id, 'approve'); }
function rejectWithdrawal(id)  { adminWithdrawalAction(id, 'reject'); }

async function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  try {
    await IOApi.del(`/api/admin/users/${encodeURIComponent(id)}`);
    await IOApi.refreshAdmin();
    showToast('User deleted', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addStore() {
  const name = document.getElementById('newStoreName').value.trim();
  const category = document.getElementById('newStoreCategory').value;
  const cashback = document.getElementById('newStoreCashback').value.trim();
  const color = document.getElementById('newStoreColor').value;
  const desc = document.getElementById('newStoreDesc').value.trim();
  if (!name || !cashback) { showToast('Fill required fields', 'error'); return; }
  try {
    await IOApi.post('/api/admin/stores', { name, category, cashback, color, description: desc });
    await IOApi.hydrate();
    closeModal('dealModal');
    showToast('Store added!', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveStore(id) {
  try {
    await IOApi.put(`/api/admin/stores/${encodeURIComponent(id)}`, {
      name: document.getElementById('editStoreName').value.trim(),
      cashback: document.getElementById('editStoreCashback').value.trim(),
      rating: parseFloat(document.getElementById('editStoreRating').value),
      description: document.getElementById('editStoreDesc').value.trim()
    });
    await IOApi.hydrate();
    closeModal('dealModal');
    showToast('Store updated!', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteStore(id) {
  if (!confirm('Delete this store and all its deals?')) return;
  try {
    await IOApi.del(`/api/admin/stores/${encodeURIComponent(id)}`);
    await IOApi.hydrate();
    showToast('Store deleted', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function addDeal() {
  const title = document.getElementById('newDealTitle').value.trim();
  const storeId = document.getElementById('newDealStore').value;
  const cat = document.getElementById('newDealCat').value;
  const code = document.getElementById('newDealCode').value.trim();
  const cashback = document.getElementById('newDealCashback').value.trim();
  const desc = document.getElementById('newDealDesc').value.trim();
  const badge = document.getElementById('newDealBadge').value.trim() || 'NEW';
  const expiry = parseInt(document.getElementById('newDealExpiry').value, 10) || 7;
  const minOrder = parseInt(document.getElementById('newDealMin').value, 10) || 499;
  if (!title || !code || !cashback) { showToast('Fill required fields', 'error'); return; }
  try {
    await IOApi.post('/api/admin/deals', { storeId, title, cat, code, cashback, desc, badge, expiryDays: expiry, minOrder });
    await IOApi.hydrate();
    closeModal('dealModal');
    showToast('Deal added!', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function saveDeal(id) {
  try {
    await IOApi.put(`/api/admin/deals/${encodeURIComponent(id)}`, {
      title: document.getElementById('editDealTitle').value.trim(),
      code: document.getElementById('editDealCode').value.trim(),
      cashback: document.getElementById('editDealCashback').value.trim(),
      desc: document.getElementById('editDealDesc').value.trim()
    });
    await IOApi.hydrate();
    closeModal('dealModal');
    showToast('Deal updated!', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteDeal(id) {
  if (!confirm('Delete this deal?')) return;
  try {
    await IOApi.del(`/api/admin/deals/${encodeURIComponent(id)}`);
    await IOApi.hydrate();
    showToast('Deal deleted', 'success');
    renderAdminContent();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ═══════════════════════ HOME REDESIGN (banner rows / categories / flash band / store rows) ═══════════════════════ */

const CAT_ICONS = {
  shopping: '🛍️', fashion: '👗', electronics: '📱', food: '🍔', travel: '✈️',
  recharge: '📲', grocery: '🥦', health: '💊', beauty: '💄'
};

function shadeColor(hex, pct) {
  const n = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * pct);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt));
  return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
}
const storeGrad = (s, deg = 120) =>
  `linear-gradient(${deg}deg, ${shadeColor(s.color, 18)} 0%, ${s.color} 55%, ${shadeColor(s.color, -25)} 100%)`;

function ioPillHTML(cashback) {
  return `<span class="io-pill"><span class="io-tag">IO</span><span class="io-val">Upto ${cashback} Cashback</span></span>`;
}

function renderHome() {
  renderHeroBanners();
  renderCategories();
  renderFlashDealsRow();
  renderStoresGrid();
  renderStoreDealSections();
  renderTestimonials();
  renderTopEarnersPreview();
}

function renderHeroBanners() {
  const el = document.getElementById('heroBanners');
  if (!el) return;
  const stores = DB.get('stores');
  const deals = DB.get('deals');
  const top = stores.slice(0, 6);
  el.innerHTML = top.map(s => {
    const deal = deals.find(d => d.storeId === s.id && d.trending) || deals.find(d => d.storeId === s.id);
    return `<div class="promo-card" style="background:${storeGrad(s)}" onclick="openStore('${s.id}')">
      <div class="pc-bubble" style="width:190px;height:190px;right:-60px;top:-60px"></div>
      <div class="pc-bubble" style="width:120px;height:120px;right:50px;bottom:-70px"></div>
      <div class="pc-store"><span class="pc-dot" style="background:${s.color}">${s.initial}</span>${s.name}</div>
      <div>
        <div class="pc-title">${deal ? deal.title : 'Top Offers'}</div>
        <div class="pc-sub">${s.category.charAt(0).toUpperCase() + s.category.slice(1)} · ${s.dealsCount} live deals</div>
      </div>
      <div class="pc-foot">
        ${ioPillHTML(s.cashback)}
        <button class="grab-btn" onclick="event.stopPropagation(); ${deal ? `trackCashback('${deal.id}')` : `openStore('${s.id}')`}">Grab Deal</button>
      </div>
    </div>`;
  }).join('');
}

function renderCategories() {
  const el = document.getElementById('categoriesGrid');
  if (!el) return;
  el.innerHTML = Object.entries(CAT_ICONS).map(([cat, icon]) => `
    <div class="cat-circle" onclick="filterCategory('${cat}')">
      <div class="cc-icon">${icon}</div>
      <div class="cc-label">${cat === 'food' ? 'Food & Dining' : cat.charAt(0).toUpperCase() + cat.slice(1)}</div>
    </div>`).join('');
}

function renderFlashDealsRow() {
  const el = document.getElementById('flashDealsRow');
  if (!el) return;
  const stores = DB.get('stores');
  const deals = DB.get('deals');
  const flash = deals.filter(d => d.expiring).concat(deals.filter(d => d.trending && !d.expiring)).slice(0, 8);
  el.innerHTML = flash.map(d => {
    const s = stores.find(x => x.id === d.storeId) || { color: '#374151', initial: '?', name: '' };
    const off = (d.title.match(/(\d+%|₹\d+)\s*(OFF|off)/) || [])[1] || d.cashback;
    return `<div class="flash-card" onclick="openDeal('${d.id}')">
      <div class="fc-top" style="background:${storeGrad(s, 135)}">
        <span class="fc-initial">${s.initial}</span>
        <span class="fc-off">${off} OFF</span>
      </div>
      <div class="fc-body">
        <div class="fc-title">${d.title}</div>
        <div class="fc-store">${s.name} · min order ₹${d.minOrder}</div>
        <div class="fc-cb">+ ${d.cashback} Cashback</div>
      </div>
    </div>`;
  }).join('');
}

function renderStoreDealSections() {
  const el = document.getElementById('storeDealsSections');
  if (!el) return;
  const stores = DB.get('stores');
  const deals = DB.get('deals');
  const rows = stores
    .slice()
    .sort((a, b) => deals.filter(d => d.storeId === b.id).length - deals.filter(d => d.storeId === a.id).length)
    .slice(0, 4);

  el.innerHTML = rows.map(s => {
    const sd = deals.filter(d => d.storeId === s.id).slice(0, 6);
    if (sd.length === 0) return '';
    return `<section class="store-row">
      <div class="sr-head">
        <h2>${s.name} – Top Deals</h2>
        <a class="view-all" onclick="openStore('${s.id}')">View All →</a>
      </div>
      <div class="banner-scroll">
        ${sd.map(d => `<div class="deal-banner" style="background:${storeGrad(s)}" onclick="openDeal('${d.id}')">
          <div class="pc-bubble" style="width:150px;height:150px;right:-50px;top:-50px"></div>
          <div class="db-badge">${d.badge}</div>
          <div class="db-store"><span class="pc-dot" style="background:${s.color};width:20px;height:20px;border-radius:5px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px">${s.initial}</span>${s.name}</div>
          <div>
            <div class="db-title">${d.title}</div>
            <div class="db-sub">Code: ${d.code} · min ₹${d.minOrder}</div>
          </div>
          <div class="db-foot">
            ${ioPillHTML(d.cashback)}
            <button class="grab-btn" onclick="event.stopPropagation(); trackCashback('${d.id}')">Grab Deal</button>
          </div>
        </div>`).join('')}
      </div>
    </section>`;
  }).join('');
}

/* ═══════════════════════ DEALS-FIRST REDESIGN ═══════════════════════ */

const fmtINR = n => '₹' + Number(n).toLocaleString('en-IN');
let ioCurrentDealId = null;

/* Product-style deal card (replaces the old coupon card everywhere) */
function dealCardHTML(deal) {
  const store = DB.get('stores').find(s => s.id === deal.storeId) || { color: '#374151', initial: '?', name: '' };
  const hasPrices = deal.dealPrice != null && deal.originalPrice != null;
  return `<div class="pdeal-card" onclick="openDeal('${deal.id}')">
    <div class="pdeal-img" style="background-image:url('${deal.image || ''}')">
      ${deal.discountPct ? `<div class="pdeal-off">${deal.discountPct}% OFF</div>` : ''}
      ${deal.badge ? `<div class="pdeal-badge">${deal.badge}</div>` : ''}
    </div>
    <div class="pdeal-body">
      <div class="pdeal-store"><span class="ps-dot" style="background:${store.color}">${store.initial}</span>${store.name}</div>
      <div class="pdeal-title">${deal.title}</div>
      ${hasPrices
        ? `<div class="pdeal-prices"><span class="pdeal-price">${fmtINR(deal.dealPrice)}</span><span class="pdeal-mrp">${fmtINR(deal.originalPrice)}</span></div>`
        : `<div class="pdeal-prices"><span class="pdeal-price" style="font-size:15px">${deal.desc.substring(0, 40)}…</span></div>`}
      <div class="pdeal-cb">+ ${deal.cashback} IndiaOffers Cashback</div>
      <div class="pdeal-foot">
        <span class="pdeal-expiry">⏰ ${deal.expiry}</span>
        <button class="pdeal-btn" onclick="event.stopPropagation(); openDeal('${deal.id}')">View Deal</button>
      </div>
    </div>
  </div>`;
}

/* Deal detail page — image, prices, cashback, how-to steps, Get Deal */
function openDeal(id) {
  ioCurrentDealId = id;
  navigate('deal-detail');
  renderDealDetail();
}

function renderDealDetail() {
  const deal = DB.get('deals').find(d => d.id === ioCurrentDealId);
  const el = document.getElementById('dealDetailContent');
  if (!deal || !el) return;
  const store = DB.get('stores').find(s => s.id === deal.storeId) || { name: 'Store', color: '#374151', initial: '?', cashback: deal.cashback };
  document.getElementById('dealBreadcrumb').textContent = deal.title;

  const hasPrices = deal.dealPrice != null && deal.originalPrice != null;
  const steps = (deal.howToGet && deal.howToGet.length) ? deal.howToGet : [
    `Click "Get Deal" below — you'll be redirected to ${store.name}`,
    deal.code ? `Apply coupon code ${deal.code} at checkout` : 'The offer applies automatically on the landing page',
    'Complete your purchase as usual',
    'Cashback tracks automatically and appears in "Track Orders"'
  ];
  const related = DB.get('deals').filter(d => d.storeId === deal.storeId && d.id !== deal.id).slice(0, 4);

  el.innerHTML = `
    <div class="dd-wrap">
      <div><img class="dd-img" src="${deal.image || ''}" alt="${deal.title}" onerror="this.style.opacity=0"></div>
      <div>
        <div class="dd-store-chip"><span class="ps-dot" style="background:${store.color};width:20px;height:20px;border-radius:6px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800">${store.initial}</span>${store.name} · ⭐ ${store.rating || '4.0'}</div>
        <h1 class="dd-title">${deal.title}</h1>
        ${hasPrices ? `
          <div class="dd-prices">
            <span class="dd-price">${fmtINR(deal.dealPrice)}</span>
            <span class="dd-mrp">${fmtINR(deal.originalPrice)}</span>
            ${deal.discountPct ? `<span class="dd-off">${deal.discountPct}% OFF</span>` : ''}
          </div>
          <div class="dd-note">You save ${fmtINR(deal.originalPrice - deal.dealPrice)} on this ${deal.type === 'coupon' ? 'offer' : 'deal'}</div>
        ` : `<p style="color:var(--gray);font-size:15px;margin-bottom:6px">${deal.desc}</p>`}

        <div class="dd-cb-strip">💰 <span>Extra <span class="big">${deal.cashback} IndiaOffers Cashback</span> on this order — credited to your wallet</span></div>

        ${deal.code ? `
          <div class="dd-code-box">
            <div><div style="font-size:11px;color:#92400e;font-weight:600;margin-bottom:2px">COUPON CODE</div><div class="dd-code">${deal.code}</div></div>
            <button class="copy-btn" onclick="copyCoupon('${deal.code}', this)">Copy</button>
          </div>` : ''}

        <button class="dd-get-btn" onclick="getDeal('${deal.id}')">Get Deal at ${store.name} →</button>
        <div class="dd-note">⏰ Offer expires in ${deal.expiry} · ${deal.uses.toLocaleString('en-IN')} people grabbed this${deal.minOrder ? ` · min order ${fmtINR(deal.minOrder)}` : ''}</div>
      </div>
    </div>

    <div class="howto">
      <h3>📋 How to get this ${deal.type === 'coupon' ? 'offer' : 'deal'}</h3>
      <div class="howto-list">
        ${steps.map((s, i) => `<div class="howto-step"><div class="howto-num">${i + 1}</div><div>${s}</div></div>`).join('')}
      </div>
    </div>

    ${deal.desc && hasPrices ? `<div class="howto"><h3>ℹ️ About this deal</h3><p style="font-size:14.5px;color:#374151;line-height:1.7">${deal.desc}</p></div>` : ''}

    ${related.length ? `<h3 class="section-title-lg">More from ${store.name}</h3><div class="deals-grid">${related.map(dealCardHTML).join('')}</div>` : ''}
  `;
  window.scrollTo({ top: 0 });
}

/* Outbound: server resolves the deal's product URL, tags affiliate params, logs the click */
function getDeal(dealId) {
  const user = DB.getCurrentUser();
  const goUrl = `${window.IO_API_BASE || ''}/go/${encodeURIComponent((DB.get('deals').find(d => d.id === dealId) || {}).storeId || 'unknown')}`
              + `?deal=${encodeURIComponent(dealId)}`
              + (user ? `&uid=${encodeURIComponent(user.id)}` : '');
  if (!user) showToast('💡 Tip: login first so your cashback gets tracked!', '');
  else showToast('🎉 Redirecting… your purchase will be tracked automatically!', 'success');
  window.open(goUrl, '_blank', 'noopener');
}

/* Hero banners: admin-managed (falls back to auto store banners if none) */
function renderHeroBanners() {
  const el = document.getElementById('heroBanners');
  if (!el) return;
  const banners = DB.get('banners').filter(b => b.active !== false);
  if (banners.length === 0) return renderAutoStoreBanners(el);

  const stores = DB.get('stores');
  const deals  = DB.get('deals');
  el.innerHTML = banners.map(b => {
    const deal  = b.dealId ? deals.find(d => d.id === b.dealId) : null;
    const store = b.storeId ? stores.find(s => s.id === b.storeId) : (deal ? stores.find(s => s.id === deal.storeId) : null);
    const click = deal ? `openDeal('${deal.id}')` : (store ? `openStore('${store.id}')` : `navigate('deals')`);
    const bg = b.image
      ? `background-image:url('${b.image}');background-color:${b.bgColor}`
      : `background:linear-gradient(120deg, ${b.bgColor}, ${shadeColor(b.bgColor, -30)})`;
    return `<div class="promo-card ${b.image ? 'has-img' : ''}" style="${bg}" onclick="${click}">
      ${b.image ? '<div class="pc-overlay"></div>' : `<div class="pc-bubble" style="width:190px;height:190px;right:-60px;top:-60px"></div>`}
      ${store ? `<div class="pc-store"><span class="pc-dot" style="background:${store.color}">${store.initial}</span>${store.name}</div>` : '<div></div>'}
      <div>
        <div class="pc-title">${b.title}</div>
        <div class="pc-sub">${b.subtitle || ''}</div>
      </div>
      <div class="pc-foot">
        ${deal ? ioPillHTML(deal.cashback) : (store ? ioPillHTML(store.cashback) : '<span></span>')}
        <button class="grab-btn" onclick="event.stopPropagation(); ${click}">${deal ? 'View Deal' : 'Explore'}</button>
      </div>
    </div>`;
  }).join('');
}

function renderAutoStoreBanners(el) {
  const stores = DB.get('stores').slice(0, 6);
  const deals = DB.get('deals');
  el.innerHTML = stores.map(s => {
    const deal = deals.find(d => d.storeId === s.id && d.trending) || deals.find(d => d.storeId === s.id);
    return `<div class="promo-card" style="background:${storeGrad(s)}" onclick="${deal ? `openDeal('${deal.id}')` : `openStore('${s.id}')`}">
      <div class="pc-bubble" style="width:190px;height:190px;right:-60px;top:-60px"></div>
      <div class="pc-store"><span class="pc-dot" style="background:${s.color}">${s.initial}</span>${s.name}</div>
      <div><div class="pc-title">${deal ? deal.title : 'Top Offers'}</div><div class="pc-sub">${s.dealsCount} live deals</div></div>
      <div class="pc-foot">${ioPillHTML(s.cashback)}<button class="grab-btn">View Deal</button></div>
    </div>`;
  }).join('');
}

/* Hot deals grid on home */
function renderHotDeals() {
  const el = document.getElementById('hotDealsGrid');
  if (!el) return;
  const deals = DB.get('deals').slice().sort((a, b) => b.uses - a.uses).slice(0, 8);
  el.innerHTML = deals.map(dealCardHTML).join('');
}

/* extend home render */
function renderHome() {
  renderHeroBanners();
  renderCategories();
  renderFlashDealsRow();
  renderHotDeals();
  renderStoresGrid();
  renderStoreDealSections();
  renderTestimonials();
  renderTopEarnersPreview();
}

/* flash cards: use product image + price when available */
function renderFlashDealsRow() {
  const el = document.getElementById('flashDealsRow');
  if (!el) return;
  const stores = DB.get('stores');
  const deals = DB.get('deals');
  const flash = deals.filter(d => d.expiring).concat(deals.filter(d => d.trending && !d.expiring)).slice(0, 8);
  el.innerHTML = flash.map(d => {
    const s = stores.find(x => x.id === d.storeId) || { color: '#374151', initial: '?', name: '' };
    return `<div class="flash-card" onclick="openDeal('${d.id}')">
      <div class="fc-top" style="${d.image ? `background-image:url('${d.image}');background-size:cover;background-position:center` : `background:${storeGrad(s, 135)}`}">
        ${d.image ? '' : `<span class="fc-initial">${s.initial}</span>`}
        ${d.discountPct ? `<span class="fc-off">${d.discountPct}% OFF</span>` : ''}
      </div>
      <div class="fc-body">
        <div class="fc-title">${d.title}</div>
        <div class="fc-store">${s.name}${d.dealPrice != null ? ` · <b style="color:#111827">${fmtINR(d.dealPrice)}</b>` : ''}${d.originalPrice != null ? ` <s>${fmtINR(d.originalPrice)}</s>` : ''}</div>
        <div class="fc-cb">+ ${d.cashback} Cashback</div>
      </div>
    </div>`;
  }).join('');
}

/* store deal rows now open the deal page */
function renderStoreDealSections() {
  const el = document.getElementById('storeDealsSections');
  if (!el) return;
  const stores = DB.get('stores');
  const deals = DB.get('deals');
  const rows = stores.slice()
    .sort((a, b) => deals.filter(d => d.storeId === b.id).length - deals.filter(d => d.storeId === a.id).length)
    .slice(0, 4);
  el.innerHTML = rows.map(s => {
    const sd = deals.filter(d => d.storeId === s.id).slice(0, 6);
    if (!sd.length) return '';
    return `<section class="store-row">
      <div class="sr-head"><h2>${s.name} – Top Deals</h2><a class="view-all" onclick="openStore('${s.id}')">View All →</a></div>
      <div class="banner-scroll">${sd.map(d => `
        <div class="deal-banner ${d.image ? 'has-img' : ''}" style="${d.image ? `background-image:url('${d.image}');background-size:cover;background-position:center` : `background:${storeGrad(s)}`}" onclick="openDeal('${d.id}')">
          ${d.image ? '<div class="pc-overlay" style="border-radius:16px"></div>' : `<div class="pc-bubble" style="width:150px;height:150px;right:-50px;top:-50px"></div>`}
          <div class="db-badge">${d.badge}</div>
          <div class="db-store"><span class="pc-dot" style="background:${s.color};width:20px;height:20px;border-radius:5px;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:11px">${s.initial}</span>${s.name}</div>
          <div>
            <div class="db-title">${d.title}</div>
            <div class="db-sub">${d.dealPrice != null ? `${fmtINR(d.dealPrice)} <s style="opacity:.75">${fmtINR(d.originalPrice)}</s>` : (d.code ? `Code: ${d.code}` : '')}</div>
          </div>
          <div class="db-foot">${ioPillHTML(d.cashback)}<button class="grab-btn" onclick="event.stopPropagation(); openDeal('${d.id}')">View Deal</button></div>
        </div>`).join('')}
      </div>
    </section>`;
  }).join('');
}

/* ═══════════════════════ ADMIN: full deal editor + banners manager ═══════════════════════ */

function openAddDealModal() {
  const stores = DB.get('stores');
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Add New Deal</h2>
    <div class="form-group"><label>Title *</label><input type="text" id="fDealTitle" placeholder="e.g., Wireless Headphones at 70% OFF"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Store *</label><select id="fDealStore">${stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
      <div class="form-group"><label>Category</label><select id="fDealCat"><option value="shopping">Shopping</option><option value="fashion">Fashion</option><option value="electronics">Electronics</option><option value="food">Food</option><option value="travel">Travel</option><option value="recharge">Recharge</option><option value="grocery">Grocery</option><option value="health">Health</option><option value="beauty">Beauty</option></select></div>
      <div class="form-group"><label>MRP / Original Price (₹)</label><input type="number" id="fDealMrp" placeholder="4999"></div>
      <div class="form-group"><label>Deal Price (₹)</label><input type="number" id="fDealPrice" placeholder="1499"></div>
      <div class="form-group"><label>Coupon Code (optional)</label><input type="text" id="fDealCode" placeholder="SAVE50"></div>
      <div class="form-group"><label>Cashback % (blank = store default)</label><input type="text" id="fDealCb" placeholder="8%"></div>
      <div class="form-group"><label>Badge</label><input type="text" id="fDealBadge" placeholder="HOT / LOOT / NEW"></div>
      <div class="form-group"><label>Expires in (days)</label><input type="number" id="fDealExpiry" value="7"></div>
    </div>
    <div class="form-group"><label>Product Image URL</label><input type="text" id="fDealImg" placeholder="https://…/product.jpg"></div>
    <div class="form-group"><label>Deal URL (merchant product/offer page) *</label><input type="text" id="fDealUrl" placeholder="https://store.com/product-page"></div>
    <div class="form-group"><label>Description</label><textarea id="fDealDesc" rows="2"></textarea></div>
    <div class="form-group"><label>How to get this deal (one step per line)</label><textarea id="fDealSteps" rows="5" placeholder="Click Get Deal below\nAdd product to cart\nApply code at checkout\nComplete payment"></textarea></div>
    <div class="form-group"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="fDealTrending" style="width:auto"> Mark as Trending (shows in banners & flash deals)</label></div>
    <button class="submit-btn" onclick="addDeal()">Add Deal</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

async function addDeal() {
  const payload = {
    title: document.getElementById('fDealTitle').value.trim(),
    storeId: document.getElementById('fDealStore').value,
    cat: document.getElementById('fDealCat').value,
    originalPrice: document.getElementById('fDealMrp').value,
    dealPrice: document.getElementById('fDealPrice').value,
    code: document.getElementById('fDealCode').value.trim(),
    cashback: document.getElementById('fDealCb').value.trim(),
    badge: document.getElementById('fDealBadge').value.trim(),
    expiryDays: document.getElementById('fDealExpiry').value,
    imageUrl: document.getElementById('fDealImg').value.trim(),
    dealUrl: document.getElementById('fDealUrl').value.trim(),
    desc: document.getElementById('fDealDesc').value.trim(),
    howToGet: document.getElementById('fDealSteps').value,
    trending: document.getElementById('fDealTrending').checked
  };
  if (!payload.title) { showToast('Title is required', 'error'); return; }
  try {
    await IOApi.post('/api/admin/deals', payload);
    await IOApi.hydrate();
    closeModal('dealModal');
    showToast('Deal added!', 'success');
    renderAdminContent();
  } catch (err) { showToast(err.message, 'error'); }
}

function editDeal(id) {
  const d = DB.get('deals').find(x => x.id === id);
  if (!d) return;
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Edit Deal</h2>
    <div class="form-group"><label>Title</label><input type="text" id="eDealTitle" value="${d.title.replace(/"/g, '&quot;')}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>MRP (₹)</label><input type="number" id="eDealMrp" value="${d.originalPrice ?? ''}"></div>
      <div class="form-group"><label>Deal Price (₹)</label><input type="number" id="eDealPrice" value="${d.dealPrice ?? ''}"></div>
      <div class="form-group"><label>Coupon Code</label><input type="text" id="eDealCode" value="${d.code || ''}"></div>
      <div class="form-group"><label>Cashback</label><input type="text" id="eDealCb" value="${d.cashback}"></div>
      <div class="form-group"><label>Badge</label><input type="text" id="eDealBadge" value="${d.badge || ''}"></div>
      <div class="form-group"><label style="display:flex;align-items:center;gap:8px;margin-top:26px"><input type="checkbox" id="eDealTrending" style="width:auto" ${d.trending ? 'checked' : ''}> Trending</label></div>
    </div>
    <div class="form-group"><label>Product Image URL</label><input type="text" id="eDealImg" value="${d.image || ''}"></div>
    <div class="form-group"><label>Deal URL</label><input type="text" id="eDealUrl" value="${d.dealUrl || ''}"></div>
    <div class="form-group"><label>Description</label><textarea id="eDealDesc" rows="2">${d.desc}</textarea></div>
    <div class="form-group"><label>How to get (one step per line)</label><textarea id="eDealSteps" rows="5">${(d.howToGet || []).join('\n')}</textarea></div>
    <button class="submit-btn" onclick="saveDeal('${id}')">Save Changes</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

async function saveDeal(id) {
  try {
    await IOApi.put(`/api/admin/deals/${encodeURIComponent(id)}`, {
      title: document.getElementById('eDealTitle').value.trim(),
      originalPrice: document.getElementById('eDealMrp').value,
      dealPrice: document.getElementById('eDealPrice').value,
      code: document.getElementById('eDealCode').value.trim(),
      cashback: document.getElementById('eDealCb').value.trim(),
      badge: document.getElementById('eDealBadge').value.trim(),
      trending: document.getElementById('eDealTrending').checked,
      imageUrl: document.getElementById('eDealImg').value.trim(),
      dealUrl: document.getElementById('eDealUrl').value.trim(),
      desc: document.getElementById('eDealDesc').value.trim(),
      howToGet: document.getElementById('eDealSteps').value
    });
    await IOApi.hydrate();
    closeModal('dealModal');
    showToast('Deal updated!', 'success');
    renderAdminContent();
  } catch (err) { showToast(err.message, 'error'); }
}

/* Banners manager tab */
function renderAdminContent() {
  const content = document.getElementById('adminContent');
  if (currentAdminTab === 'dashboard') renderAdminDashboard(content);
  else if (currentAdminTab === 'users') renderAdminUsers(content);
  else if (currentAdminTab === 'stores') renderAdminStores(content);
  else if (currentAdminTab === 'deals') renderAdminDeals(content);
  else if (currentAdminTab === 'banners') renderAdminBanners(content);
  else if (currentAdminTab === 'orders') renderAdminOrders(content);
  else if (currentAdminTab === 'claims') renderAdminClaims(content);
  else if (currentAdminTab === 'withdrawals') renderAdminWithdrawals(content);
  else if (currentAdminTab === 'reports') renderAdminReports(content);
}

function renderAdminBanners(content) {
  const banners = DB.get('banners');
  const deals = DB.get('deals');
  const stores = DB.get('stores');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Homepage Banners</h2><p>These appear in the hero carousel, in sort order</p></div>
      <button class="btn btn-primary" onclick="openBannerModal()">+ Add Banner</button></div>
    <div class="table-container"><table>
      <thead><tr><th>Preview</th><th>Title</th><th>Links to</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${banners.map(b => {
        const deal = deals.find(d => d.id === b.dealId);
        const store = stores.find(s => s.id === b.storeId);
        return `<tr>
          <td><div style="width:90px;height:48px;border-radius:8px;background:${b.image ? `url('${b.image}') center/cover` : b.bgColor}"></div></td>
          <td><strong>${b.title}</strong><br><small style="color:var(--gray)">${b.subtitle || ''}</small></td>
          <td>${deal ? '🎁 ' + deal.title.substring(0, 30) : store ? '🏪 ' + store.name : '—'}</td>
          <td>${b.sortOrder}</td>
          <td><span class="status-badge status-${b.active ? 'approved' : 'rejected'}">${b.active ? 'live' : 'hidden'}</span></td>
          <td>
            <button class="action-btn edit" onclick="openBannerModal('${b.id}')">Edit</button>
            <button class="action-btn delete" onclick="deleteBanner('${b.id}')">Delete</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  `;
}

function openBannerModal(id) {
  const b = id ? DB.get('banners').find(x => x.id === id) : null;
  const deals = DB.get('deals');
  const stores = DB.get('stores');
  document.getElementById('dealModalContent').innerHTML = `
    <h2>${b ? 'Edit' : 'Add'} Banner</h2>
    <div class="form-group"><label>Title *</label><input type="text" id="fBanTitle" value="${b ? b.title.replace(/"/g, '&quot;') : ''}" placeholder="Mega Electronics Fest"></div>
    <div class="form-group"><label>Subtitle</label><input type="text" id="fBanSub" value="${b ? (b.subtitle || '') : ''}" placeholder="Up to 70% OFF + extra cashback"></div>
    <div class="form-group"><label>Image URL (recommended 900×500)</label><input type="text" id="fBanImg" value="${b ? (b.image || '') : ''}" placeholder="https://…/banner.jpg"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="form-group"><label>Background color (if no image)</label><input type="color" id="fBanColor" value="${b ? b.bgColor : '#2563eb'}"></div>
      <div class="form-group"><label>Sort order</label><input type="number" id="fBanSort" value="${b ? b.sortOrder : 0}"></div>
    </div>
    <div class="form-group"><label>Link to deal (opens deal page)</label>
      <select id="fBanDeal"><option value="">— none —</option>${deals.map(d => `<option value="${d.id}" ${b && b.dealId === d.id ? 'selected' : ''}>${d.title.substring(0, 50)}</option>`).join('')}</select></div>
    <div class="form-group"><label>…or link to store</label>
      <select id="fBanStore"><option value="">— none —</option>${stores.map(s => `<option value="${s.id}" ${b && b.storeId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></div>
    ${b ? `<div class="form-group"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="fBanActive" style="width:auto" ${b.active ? 'checked' : ''}> Live on homepage</label></div>` : ''}
    <button class="submit-btn" onclick="saveBanner(${b ? `'${b.id}'` : 'null'})">${b ? 'Save Changes' : 'Add Banner'}</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

async function saveBanner(id) {
  const payload = {
    title: document.getElementById('fBanTitle').value.trim(),
    subtitle: document.getElementById('fBanSub').value.trim(),
    imageUrl: document.getElementById('fBanImg').value.trim(),
    bgColor: document.getElementById('fBanColor').value,
    sortOrder: document.getElementById('fBanSort').value,
    dealId: document.getElementById('fBanDeal').value || null,
    storeId: document.getElementById('fBanStore').value || null
  };
  if (id) payload.active = document.getElementById('fBanActive').checked;
  if (!payload.title) { showToast('Title required', 'error'); return; }
  try {
    if (id) await IOApi.put(`/api/admin/banners/${encodeURIComponent(id)}`, payload);
    else await IOApi.post('/api/admin/banners', payload);
    await IOApi.refreshAdmin();
    closeModal('dealModal');
    showToast(`Banner ${id ? 'updated' : 'added'}!`, 'success');
    renderAdminContent();
  } catch (err) { showToast(err.message, 'error'); }
}

async function deleteBanner(id) {
  if (!confirm('Delete this banner?')) return;
  try {
    await IOApi.del(`/api/admin/banners/${encodeURIComponent(id)}`);
    await IOApi.refreshAdmin();
    showToast('Banner deleted', 'success');
    renderAdminContent();
  } catch (err) { showToast(err.message, 'error'); }
}
