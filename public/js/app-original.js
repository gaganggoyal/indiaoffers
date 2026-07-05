const DB = {
  init() {
    if (!localStorage.getItem('io_initialized_v3')) this.seed();
  },
  seed() {
    // Server-backed data (users, stores, deals, orders, claims, withdrawals,
    // favorites, referrals, notifications) is hydrated from the API by IOApi.
    // Only static UI content is seeded locally.
    const testimonials = [
      { id: 't1', name: 'Rajesh Kumar', city: 'Mumbai', rating: 5, text: 'IndiaOffers has saved me thousands! I earn cashback on every purchase.', avatar: 'R' },
      { id: 't2', name: 'Meera Joshi', city: 'Bangalore', rating: 5, text: 'Best cashback platform in India. The order tracking feature is amazing.', avatar: 'M' },
      { id: 't3', name: 'Amit Shah', city: 'Delhi', rating: 4, text: 'Great deals and genuine cashback. Have been using for 2 years.', avatar: 'A' },
      { id: 't4', name: 'Divya Nair', city: 'Chennai', rating: 5, text: 'The referral program is awesome! Earned ₹2000 just by referring friends.', avatar: 'D' },
    ];

    const blogs = [
      { id: 'b1', title: '10 Ways to Save Money on Online Shopping in 2026', excerpt: 'Discover the best strategies to maximize your savings.', category: 'Tips', date: 'June 25, 2026', readTime: '5 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/171ff5d1b-118e-48c2-a0cf-9c3414a0c790.png' },
      { id: 'b2', title: 'How Cashback Works: Complete Guide', excerpt: 'New to cashback? Learn how it works.', category: 'Guide', date: 'June 20, 2026', readTime: '7 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/13c5458fc-3ae8-41b6-8470-81f01d5cbf6c.png' },
      { id: 'b3', title: 'Best Fashion Deals This Season', excerpt: 'Top 5 stores offering amazing discounts.', category: 'Fashion', date: 'June 18, 2026', readTime: '4 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/1c0f58d22-565f-4e60-94ff-0f6f525ee50e.png' },
      { id: 'b4', title: 'Food Delivery Hacks', excerpt: 'Save 30% on every order.', category: 'Food', date: 'June 15, 2026', readTime: '6 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/1186bcab4-ee8e-428e-b305-31e4d36e9830.png' },
      { id: 'b5', title: 'Electronics Shopping Guide', excerpt: 'When to buy for best deals.', category: 'Electronics', date: 'June 12, 2026', readTime: '5 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/13c5458fc-3ae8-41b6-8470-81f01d5cbf6c.png' },
      { id: 'b6', title: 'Travel Smart: Save on Flights', excerpt: 'Insider tips to save big.', category: 'Travel', date: 'June 8, 2026', readTime: '8 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/1c0f58d22-565f-4e60-94ff-0f6f525ee50e.png' },
      { id: 'b7', title: 'Understanding Order Tracking', excerpt: 'Complete guide to our tracking system.', category: 'Guide', date: 'June 5, 2026', readTime: '6 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/171ff5d1b-118e-48c2-a0cf-9c3414a0c790.png' },
      { id: 'b8', title: 'Browser Extension Guide', excerpt: 'Never miss a cashback opportunity.', category: 'Tips', date: 'June 1, 2026', readTime: '4 min', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/13c5458fc-3ae8-41b6-8470-81f01d5cbf6c.png' },
    ];

    const faqs = [
      { q: 'What is IndiaOffers.in?', a: 'India\'s leading cashback and coupons platform.' },
      { q: 'How does cashback work?', a: 'Stores pay us commission, we share it with you as cashback.' },
      { q: 'How do I track my order?', a: 'Go to "Track Orders" and submit order details.' },
      { q: 'What are the tracking stages?', a: 'Pending → Tracking → Verified → Confirmed → Paid.' },
      { q: 'When will I receive my cashback?', a: 'Typically 30-60 days after purchase.' },
      { q: 'What if my cashback is not tracked?', a: 'Use "Missing Cashback" feature to submit a claim.' },
      { q: 'How do I withdraw my cashback?', a: 'Go to My Wallet, choose method, enter amount (min ₹250).' },
      { q: 'How does the referral program work?', a: 'Share your code. Both earn ₹100 when friend makes first purchase.' },
    ];

    localStorage.setItem('io_initialized_v3', 'true');
    ['users','stores','deals','orders','claims','cashbacks','withdrawals',
     'favorites','referrals','notifications'].forEach(k => {
      localStorage.setItem('io_' + k, JSON.stringify([]));
    });
    localStorage.setItem('io_testimonials', JSON.stringify(testimonials));
    localStorage.setItem('io_blogs', JSON.stringify(blogs));
    localStorage.setItem('io_faqs', JSON.stringify(faqs));
    localStorage.removeItem('io_current_user');
    localStorage.removeItem('io_token');
  },
  get(key) { return JSON.parse(localStorage.getItem('io_' + key) || '[]'); },
  set(key, data) { localStorage.setItem('io_' + key, JSON.stringify(data)); },
  getCurrentUser() {
    try { return JSON.parse(localStorage.getItem('io_current_user')) || null; }
    catch (e) { return null; }
  },
  setCurrentUser(user) {
    if (user) localStorage.setItem('io_current_user', JSON.stringify(user));
    else localStorage.removeItem('io_current_user');
  }
};

// Utility functions - toast, modal, carousel, helpers
let currentSlide = 0;

function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function subscribeNewsletter() {
  const email = document.getElementById('newsletterEmail').value;
  if (!email) { showToast('Please enter email', 'error'); return; }
  showToast('✅ Subscribed successfully!', 'success');
  document.getElementById('newsletterEmail').value = '';
}

function initCarousel() {
  const track = document.getElementById('carouselTrack');
  if (!track) return; // home no longer uses the old carousel
  const dotsContainer = document.getElementById('carouselDots');
  const slides = track.children;
  for (let i = 0; i < slides.length; i++) {
    const dot = document.createElement('div');
    dot.className = `dot ${i === 0 ? 'active' : ''}`;
    dot.onclick = () => goToSlide(i);
    dotsContainer.appendChild(dot);
  }
  setInterval(() => moveCarousel(1), 5000);
}

function moveCarousel(dir) {
  const track = document.getElementById('carouselTrack');
  if (!track) return;
  const slides = track.children;
  currentSlide = (currentSlide + dir + slides.length) % slides.length;
  updateCarousel();
}

function goToSlide(index) { currentSlide = index; updateCarousel(); }

function updateCarousel() {
  const track = document.getElementById('carouselTrack');
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
}

function startFlashTimer() {
  let h = 8, m = 45, s = 30;
  setInterval(() => {
    s--;
    if (s < 0) { s = 59; m--; }
    if (m < 0) { m = 59; h--; }
    if (h < 0) { h = 23; }
    const fH = document.getElementById('fHours');
    const fM = document.getElementById('fMins');
    const fS = document.getElementById('fSecs');
    if (fH) fH.textContent = String(h).padStart(2, '0');
    if (fM) fM.textContent = String(m).padStart(2, '0');
    if (fS) fS.textContent = String(s).padStart(2, '0');
  }, 1000);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function copyCoupon(code, btn) {
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    showToast(`Coupon ${code} copied!`, 'success');
    setTimeout(() => { btn.textContent = 'Copy Code'; btn.classList.remove('copied'); }, 2000);
  });
}

function toggleFaq(i) { document.querySelectorAll('.faq-item')[i].classList.toggle('active'); }

document.addEventListener('click', () => {
  const dd = document.getElementById('userDropdown');
  const np = document.getElementById('notifPanel');
  if (dd) dd.classList.remove('active');
  if (np) np.classList.remove('active');
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.classList.remove('active'); });
});

// Home page renders
let currentCategory = 'all';

function renderHome() {
  renderCategories();
  renderStoresGrid();
  renderFeaturedDeals();
  renderTestimonials();
  renderTopEarnersPreview();
}

function renderCategories() {
  const categories = [
    { id: 'all', name: 'All', icon: '🛍️' }, { id: 'shopping', name: 'Shopping', icon: '' },
    { id: 'fashion', name: 'Fashion', icon: '👗' }, { id: 'electronics', name: 'Electronics', icon: '📱' },
    { id: 'food', name: 'Food', icon: '🍕' }, { id: 'travel', name: 'Travel', icon: '✈️' },
    { id: 'recharge', name: 'Recharge', icon: '📶' }, { id: 'grocery', name: 'Grocery', icon: '🥬' },
    { id: 'health', name: 'Health', icon: '💊' }, { id: 'beauty', name: 'Beauty', icon: '💄' },
  ];
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = categories.map(cat => `
    <div class="cat-card ${currentCategory === cat.id ? 'active' : ''}" onclick="filterCategory('${cat.id}')">
      <div class="cat-icon">${cat.icon}</div><div class="cat-name">${cat.name}</div>
    </div>`).join('');
}

function filterCategory(cat) {
  currentCategory = cat;
  renderCategories();
  navigate('deals');
  renderAllDeals();
}

function renderStoresGrid() {
  const stores = DB.get('stores').slice(0, 10);
  const grid = document.getElementById('storesGrid');
  if (grid) grid.innerHTML = stores.map(s => storeCardHTML(s)).join('');
}

function storeCardHTML(store) {
  return `<div class="store-card" onclick="openStore('${store.id}')">
    <div class="store-logo" style="background: ${store.color}">${store.initial}</div>
    <div class="store-name">${store.name}</div>
    <div class="store-cashback">Up to ${store.cashback} cashback</div>
    <div class="store-deals-count">${store.dealsCount} active deals • ⭐ ${store.rating}</div>
  </div>`;
}

function renderFeaturedDeals() {
  const deals = DB.get('deals').filter(d => d.trending).slice(0, 8);
  const grid = document.getElementById('featuredDealsGrid');
  if (grid) grid.innerHTML = deals.map(d => dealCardHTML(d)).join('');
}

function dealCardHTML(deal) {
  const store = DB.get('stores').find(s => s.id === deal.storeId);
  const user = DB.getCurrentUser();
  const isFav = user && DB.get('favorites').some(f => f.userId === user.id && f.dealId === deal.id);
  return `<div class="deal-card">
    <div class="deal-image" style="background-image: url('${deal.image || ''}')" onclick="openDeal('${deal.id}')">
      <div class="deal-badge">${deal.badge}</div>
      <div class="deal-cashback"> ${deal.cashback} CB</div>
      ${user ? `<div class="deal-fav" onclick="event.stopPropagation(); toggleFavorite('${deal.id}')">${isFav ? '❤️' : '🤍'}</div>` : ''}
    </div>
    <div class="deal-body" onclick="openDeal('${deal.id}')">
      <div class="deal-store">${store ? store.name : ''}</div>
      <div class="deal-title">${deal.title}</div>
      <div class="deal-desc">${deal.desc.substring(0, 70)}...</div>
      <div class="deal-meta">
        <div class="deal-expiry">⏰ ${deal.expiry}</div>
        <button class="coupon-btn" onclick="event.stopPropagation(); openDealModal('${deal.id}')">Get Code</button>
      </div>
    </div>
  </div>`;
}

function renderTestimonials() {
  const testimonials = DB.get('testimonials');
  const grid = document.getElementById('testimonialsGrid');
  if (!grid) return;
  grid.innerHTML = testimonials.map(t => `
    <div class="testimonial-card">
      <div class="testimonial-stars">${'★'.repeat(t.rating)}${'☆'.repeat(5-t.rating)}</div>
      <div class="testimonial-text">"${t.text}"</div>
      <div class="testimonial-user">
        <div class="testimonial-avatar">${t.avatar}</div>
        <div class="testimonial-info"><h5>${t.name}</h5><p>${t.city}</p></div>
      </div>
    </div>`).join('');
}

function renderTopEarnersPreview() {
  const users = DB.get('users').filter(u => !u.isAdmin).sort((a, b) => b.totalEarned - a.totalEarned).slice(0, 5);
  const container = document.getElementById('topEarnersPreview');
  if (!container) return;
  container.innerHTML = users.map((u, i) => {
    const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
    return `<div class="leaderboard-item">
      <div class="leaderboard-rank ${rankClass}">${i+1}</div>
      <div class="leaderboard-info"><h5>${u.name}</h5><p>${u.referrals} referrals • Joined ${u.joined}</p></div>
      <div class="leaderboard-amount">₹${u.totalEarned.toLocaleString('en-IN')}</div>
    </div>`;
  }).join('');
}

// Stores module
let currentStoreFilter = 'all';
let currentStoreId = null;
let currentStoreTab = 'deals';

function renderStores() {
  const stores = DB.get('stores');
  const categories = ['all', ...new Set(stores.map(s => s.category))];
  document.getElementById('storeFilters').innerHTML = categories.map(c => `
    <div class="filter-chip ${currentStoreFilter === c ? 'active' : ''}" onclick="setStoreFilter('${c}')">${c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}</div>
  `).join('');
  const filtered = currentStoreFilter === 'all' ? stores : stores.filter(s => s.category === currentStoreFilter);
  document.getElementById('allStoresGrid').innerHTML = filtered.map(s => storeCardHTML(s)).join('');
}

function setStoreFilter(cat) { currentStoreFilter = cat; renderStores(); }

function openStore(id) {
  currentStoreId = id;
  navigate('store-detail');
  renderStoreDetail();
}

function renderStoreDetail() {
  const store = DB.get('stores').find(s => s.id === currentStoreId);
  if (!store) return;
  if (typeof updateSEOForStore === 'function') updateSEOForStore(store);
  document.getElementById('storeBreadcrumb').textContent = store.name;
  document.getElementById('storeHero').innerHTML = `
    <div class="store-hero-logo" style="background: ${store.color}">${store.initial}</div>
    <div class="store-hero-info">
      <h1>${store.name}</h1>
      <p>${store.description}</p>
      <div class="store-hero-stats">
        <div class="store-stat"><div class="label">Cashback</div><div class="value">${store.cashback}</div></div>
        <div class="store-stat"><div class="label">Active Deals</div><div class="value">${store.dealsCount}</div></div>
        <div class="store-stat"><div class="label">Category</div><div class="value" style="text-transform: capitalize;">${store.category}</div></div>
        <div class="store-stat"><div class="label">Rating</div><div class="value">⭐ ${store.rating}</div></div>
        <div class="store-stat"><div class="label">Users</div><div class="value">${(store.totalUsers/1000).toFixed(0)}K+</div></div>
      </div>
    </div>
    <button class="btn btn-primary btn-lg" onclick="showToast('Redirecting to ${store.name}...')">Shop Now →</button>
  `;
  renderStoreContent();
}

function switchStoreTab(tab, e) {
  currentStoreTab = tab;
  document.querySelectorAll('#view-store-detail .tab').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  renderStoreContent();
}

function renderStoreContent() {
  const store = DB.get('stores').find(s => s.id === currentStoreId);
  const deals = DB.get('deals').filter(d => d.storeId === currentStoreId);
  const content = document.getElementById('storeContent');
  
  if (currentStoreTab === 'deals' || currentStoreTab === 'coupons') {
    const filtered = currentStoreTab === 'coupons' ? deals.filter(d => d.type === 'coupon') : deals;
    if (filtered.length === 0) content.innerHTML = `<div class="empty-state"><div class="icon">🎁</div><h3>No deals found</h3></div>`;
    else content.innerHTML = `<div class="deals-grid">${filtered.map(d => dealCardHTML(d)).join('')}</div>`;
  } else if (currentStoreTab === 'reviews') {
    content.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 16px;">
        <h3 style="margin-bottom: 20px;">⭐ ${store.rating} / 5.0 Average Rating</h3>
        <div style="display: grid; gap: 16px;">
          ${[
            { name: 'Priya S.', rating: 5, text: 'Great cashback offers!', date: '2 days ago' },
            { name: 'Rahul K.', rating: 4, text: 'Reliable platform.', date: '1 week ago' },
            { name: 'Ananya M.', rating: 5, text: 'Best deals compared to other cashback sites.', date: '2 weeks ago' },
          ].map(r => `
            <div style="padding: 16px; background: var(--light-gray); border-radius: 12px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <strong>${r.name}</strong>
                <span style="color: var(--warning);">${'★'.repeat(r.rating)}</span>
              </div>
              <p style="font-size: 14px; color: #374151; margin-bottom: 6px;">${r.text}</p>
              <small style="color: var(--gray);">${r.date}</small>
            </div>
          `).join('')}
        </div>
      </div>`;
  } else if (currentStoreTab === 'about') {
    content.innerHTML = `
      <div style="background: white; padding: 30px; border-radius: 16px;">
        <h3 style="margin-bottom: 16px;">About ${store.name}</h3>
        <p style="line-height: 1.7; color: var(--gray); margin-bottom: 20px;">${store.description}</p>
        <h4 style="margin-bottom: 12px;">Why shop through IndiaOffers?</h4>
        <ul style="line-height: 2; color: var(--gray); padding-left: 20px;">
          <li>Earn up to ${store.cashback} cashback on every purchase</li>
          <li>Exclusive coupons and deals</li>
          <li>Real-time order tracking</li>
          <li>Free and easy to use</li>
          <li>Withdraw earnings to bank or UPI</li>
        </ul>
        <button class="btn btn-primary btn-lg" style="margin-top: 20px;" onclick="showToast('Redirecting to ${store.name}...')">Start Shopping →</button>
      </div>`;
  }
}

// Deals module
let currentDealFilter = 'all';
let currentDealId = null;

function renderAllDeals(searchQuery = '') {
  const deals = DB.get('deals');
  const categories = ['all', ...new Set(deals.map(d => d.cat))];
  document.getElementById('dealFilters').innerHTML = `
    <div class="filter-chip ${currentDealFilter === 'all' ? 'active' : ''}" onclick="setDealFilter('all')">All</div>
    ${categories.filter(c => c !== 'all').map(c => `<div class="filter-chip ${currentDealFilter === c ? 'active' : ''}" onclick="setDealFilter('${c}')">${c.charAt(0).toUpperCase() + c.slice(1)}</div>`).join('')}
  `;
  let filtered = currentDealFilter === 'all' ? deals : deals.filter(d => d.cat === currentDealFilter);
  if (searchQuery) {
    filtered = filtered.filter(d => {
      const store = DB.get('stores').find(s => s.id === d.storeId);
      return d.title.toLowerCase().includes(searchQuery) || d.desc.toLowerCase().includes(searchQuery) || (store && store.name.toLowerCase().includes(searchQuery));
    });
  }
  const grid = document.getElementById('allDealsGrid');
  if (filtered.length === 0) grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;"><div class="icon">🔍</div><h3>No deals found</h3></div>`;
  else grid.innerHTML = filtered.map(d => dealCardHTML(d)).join('');
}

function setDealFilter(cat) { currentDealFilter = cat; renderAllDeals(); }

function openDeal(id) {
  currentDealId = id;
  navigate('deal-detail');
  renderDealDetail();
}

function renderDealDetail() {
  const deal = DB.get('deals').find(d => d.id === currentDealId);
  if (!deal) return;
  const store = DB.get('stores').find(s => s.id === deal.storeId);
  if (typeof updateSEOForDeal === 'function') updateSEOForDeal(deal, store);
  document.getElementById('dealBreadcrumb').textContent = deal.title;
  const related = DB.get('deals').filter(d => d.storeId === deal.storeId && d.id !== deal.id).slice(0, 4);
  
  document.getElementById('dealDetailContent').innerHTML = `
    <div class="grid-2" style="gap: 30px;">
      <div>
        <div style="background: white; border-radius: 16px; overflow: hidden;">
          <div style="height: 300px; background-image: url('${deal.image || ''}'); background-size: cover; background-position: center; background-color: var(--light-gray);"></div>
        </div>
      </div>
      <div>
        <div style="background: white; border-radius: 16px; padding: 30px;">
          <div style="display: flex; gap: 8px; margin-bottom: 12px;">
            <span class="status-badge status-active">${deal.badge}</span>
            <span class="status-badge status-processing">${deal.type === 'coupon' ? 'Coupon' : 'Deal'}</span>
          </div>
          <div style="font-size: 12px; color: var(--gray); font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">${store ? store.name : ''}</div>
          <h1 style="font-size: 26px; margin-bottom: 12px;">${deal.title}</h1>
          <p style="color: var(--gray); line-height: 1.6; margin-bottom: 20px;">${deal.desc}</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
            <div style="background: #ecfdf5; padding: 14px; border-radius: 12px;">
              <div style="font-size: 11px; color: var(--gray);">Cashback</div>
              <div style="font-size: 20px; font-weight: 800; color: var(--primary);">${deal.cashback}</div>
            </div>
            <div style="background: #fef3c7; padding: 14px; border-radius: 12px;">
              <div style="font-size: 11px; color: var(--gray);">Expires In</div>
              <div style="font-size: 20px; font-weight: 800; color: #92400e;">${deal.expiry}</div>
            </div>
            <div style="background: #eff6ff; padding: 14px; border-radius: 12px;">
              <div style="font-size: 11px; color: var(--gray);">Used By</div>
              <div style="font-size: 20px; font-weight: 800; color: #1e40af;">${deal.uses || 0}</div>
            </div>
          </div>
          <div class="coupon-code-box">
            <div style="font-size: 13px; color: #92400e; margin-bottom: 8px;">Use Coupon Code</div>
            <div class="coupon-code">${deal.code}</div>
            <button class="copy-btn" onclick="copyCoupon('${deal.code}', this)">Copy Code</button>
          </div>
          <div style="background: var(--light-gray); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 8px;">How to use:</div>
            <ol style="font-size: 13px; color: #4b5563; padding-left: 20px; line-height: 1.8;">
              <li>Click "Copy Code" above</li>
              <li>Visit ${store ? store.name : 'store'} website</li>
              <li>Shop your favorite items (min. order ₹${deal.minOrder || 0})</li>
              <li>Apply code at checkout</li>
              <li>Submit order details in "Track Orders"</li>
              <li>Earn ${deal.cashback} cashback!</li>
            </ol>
          </div>
          <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="trackCashback('${deal.id}')">Shop Now & Track Order →</button>
        </div>
      </div>
    </div>
    ${related.length > 0 ? `<div style="margin-top: 40px;"><h3 style="margin-bottom: 20px;">More deals from ${store ? store.name : 'this store'}</h3><div class="deals-grid">${related.map(d => dealCardHTML(d)).join('')}</div></div>` : ''}
  `;
}

function trackCashback(dealId) {
  const user = DB.getCurrentUser();
  if (!user) { showToast('Please login to track cashback', 'error'); navigate('auth'); return; }
  const deal = DB.get('deals').find(d => d.id === dealId);
  const store = DB.get('stores').find(s => s.id === deal.storeId);

  // ── REAL AFFILIATE REDIRECT ────────────────────────────────────────────────
  // Routes through our tracking backend (/go/:store) which logs the click,
  // sets a 1st-party io_click cookie (read by pixel.js on the merchant site),
  // appends the correct affiliate tag (Amazon tag / Flipkart affid / etc.),
  // then redirects to the real merchant page.
  const merchantUrl = (store && store.affiliateUrl) || `https://${store ? store.url : ''}`;
  const goUrl = `${window.IO_API_BASE || 'https://api.indiaoffers.in'}/go/${encodeURIComponent(store ? store.id : 'unknown')}`
              + `?url=${encodeURIComponent(merchantUrl)}`
              + `&uid=${encodeURIComponent(user.id)}`
              + `&deal=${encodeURIComponent(deal.id)}`;

  const orders = DB.get('orders');
  const newOrder = {
    id: 'o' + Date.now(), userId: user.id, dealId: deal.id, storeId: deal.storeId,
    orderNumber: 'OD-' + deal.code + '-' + Math.floor(Math.random() * 9000000 + 1000000),
    orderAmount: deal.minOrder + Math.floor(Math.random() * 2000),
    cashbackAmount: Math.floor(Math.random() * 500) + 100,
    status: 'pending', orderDate: new Date().toISOString().split('T')[0],
    trackDate: new Date().toISOString().split('T')[0],
    verifiedDate: null, confirmedDate: null, paidDate: null,
    notes: 'Order submitted, under review', receiptUploaded: false
  };
  orders.push(newOrder);
  DB.set('orders', orders);
  
  const notifs = DB.get('notifications');
  notifs.unshift({
    id: 'n' + Date.now(), userId: user.id,
    title: 'Order Submitted for Tracking',
    message: `Order ${newOrder.orderNumber} is being tracked`,
    type: 'tracking', time: 'Just now', read: false, icon: '📦'
  });
  DB.set('notifications', notifs);
  updateNotifCount();
  
  showToast('🎉 Redirecting to store... cashback tracks automatically!', 'success');
  window.open(goUrl, '_blank', 'noopener');
  setTimeout(() => navigate('tracking'), 1200);
}

function openDealModal(id) {
  const deal = DB.get('deals').find(d => d.id === id);
  if (!deal) return;
  const store = DB.get('stores').find(s => s.id === deal.storeId);
  document.getElementById('dealModalContent').innerHTML = `
    <h2>${deal.title}</h2>
    <p style="color: var(--primary); font-weight: 600;">${store ? store.name : ''} • ${deal.cashback} Cashback</p>
    <p>${deal.desc}</p>
    <div class="coupon-code-box">
      <div style="font-size: 13px; color: #92400e; margin-bottom: 8px;">Use Coupon Code</div>
      <div class="coupon-code">${deal.code}</div>
      <button class="copy-btn" onclick="copyCoupon('${deal.code}', this)">Copy Code</button>
    </div>
    <button class="submit-btn" onclick="trackCashback('${deal.id}'); closeModal('dealModal');">Shop Now & Track Order →</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function toggleFavorite(dealId) {
  const user = DB.getCurrentUser();
  if (!user) { navigate('auth'); return; }
  let favs = DB.get('favorites');
  const idx = favs.findIndex(f => f.userId === user.id && f.dealId === dealId);
  if (idx >= 0) { favs.splice(idx, 1); showToast('Removed from favorites'); }
  else { favs.push({ userId: user.id, dealId }); showToast('Added to favorites ❤️', 'success'); }
  DB.set('favorites', favs);
  renderHome();
  if (document.getElementById('view-favorites').classList.contains('active')) renderFavorites();
  if (document.getElementById('view-deals').classList.contains('active')) renderAllDeals();
}

// Order tracking module
let currentTrackingFilter = 'all';

function renderTracking() {
  const user = DB.getCurrentUser();
  const orders = DB.get('orders').filter(o => o.userId === user.id);
  const content = document.getElementById('trackingContent');
  
  const statusCounts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    tracking: orders.filter(o => o.status === 'tracking').length,
    verified: orders.filter(o => o.status === 'verified').length,
    confirmed: orders.filter(o => o.status === 'confirmed').length,
    paid: orders.filter(o => o.status === 'paid').length,
    disputed: orders.filter(o => o.status === 'disputed').length,
  };
  
  const filtered = currentTrackingFilter === 'all' ? orders : orders.filter(o => o.status === currentTrackingFilter);
  const totalCashback = orders.filter(o => ['confirmed', 'paid'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  const pendingCashback = orders.filter(o => ['pending', 'tracking', 'verified'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  
  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-icon">📦</div><h4>Total Orders Tracked</h4><div class="value">${orders.length}</div></div>
      <div class="stat-card orange"><div class="stat-card-icon">💰</div><h4>Cashback Earned</h4><div class="value">₹${totalCashback}</div></div>
      <div class="stat-card blue"><div class="stat-card-icon">⏳</div><h4>Pending Cashback</h4><div class="value">₹${pendingCashback}</div></div>
      <div class="stat-card purple"><div class="stat-card-icon">✅</div><h4>Success Rate</h4><div class="value">${orders.length ? Math.round((orders.filter(o => ['confirmed', 'paid', 'verified'].includes(o.status)).length / orders.length) * 100) : 0}%</div></div>
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 24px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <h3>My Tracked Orders</h3>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm" onclick="openSubmitOrderModal()">+ Submit New Order</button>
          <button class="btn btn-ghost btn-sm" onclick="navigate('missing-cashback')">🔍 Missing Cashback?</button>
        </div>
      </div>
      
      <div class="filters-bar">
        <div class="filter-chip ${currentTrackingFilter === 'all' ? 'active' : ''}" onclick="setTrackingFilter('all')">All (${statusCounts.all})</div>
        <div class="filter-chip ${currentTrackingFilter === 'pending' ? 'active' : ''}" onclick="setTrackingFilter('pending')">⏳ Pending (${statusCounts.pending})</div>
        <div class="filter-chip ${currentTrackingFilter === 'tracking' ? 'active' : ''}" onclick="setTrackingFilter('tracking')">📍 Tracking (${statusCounts.tracking})</div>
        <div class="filter-chip ${currentTrackingFilter === 'verified' ? 'active' : ''}" onclick="setTrackingFilter('verified')">✓ Verified (${statusCounts.verified})</div>
        <div class="filter-chip ${currentTrackingFilter === 'confirmed' ? 'active' : ''}" onclick="setTrackingFilter('confirmed')">✅ Confirmed (${statusCounts.confirmed})</div>
        <div class="filter-chip ${currentTrackingFilter === 'paid' ? 'active' : ''}" onclick="setTrackingFilter('paid')">💰 Paid (${statusCounts.paid})</div>
        <div class="filter-chip ${currentTrackingFilter === 'disputed' ? 'active' : ''}" onclick="setTrackingFilter('disputed')">⚠️ Disputed (${statusCounts.disputed})</div>
      </div>
      
      ${filtered.length === 0 ? `<div class="empty-state"><div class="icon">📦</div><h3>No orders found</h3><button class="btn btn-primary" onclick="openSubmitOrderModal()">Submit Order</button></div>` : `
        <div style="display: grid; gap: 16px;">
          ${filtered.map(o => orderCardHTML(o)).join('')}
        </div>
      `}
    </div>
    
    <div style="background: white; border-radius: 16px; padding: 30px;">
      <h3 style="margin-bottom: 16px;">📋 How Order Tracking Works</h3>
      <div class="steps-grid" style="grid-template-columns: repeat(5, 1fr); gap: 15px;">
        <div class="step"><div class="step-num" style="background: #fef3c7; color: #92400e;">1</div><h3 style="font-size: 14px;">Submit</h3><p style="font-size: 12px;">Submit order details</p></div>
        <div class="step"><div class="step-num" style="background: #dbeafe; color: #1e40af;">2</div><h3 style="font-size: 14px;">Tracking</h3><p style="font-size: 12px;">Verify with store (24-48 hrs)</p></div>
        <div class="step"><div class="step-num" style="background: #e0e7ff; color: #3730a3;">3</div><h3 style="font-size: 14px;">Verified</h3><p style="font-size: 12px;">Store confirms validity</p></div>
        <div class="step"><div class="step-num" style="background: #d1fae5; color: #065f46;">4</div><h3 style="font-size: 14px;">Confirmed</h3><p style="font-size: 12px;">After return period</p></div>
        <div class="step"><div class="step-num" style="background: linear-gradient(135deg, var(--primary), #60a5fa); color: white;">5</div><h3 style="font-size: 14px;">Paid</h3><p style="font-size: 12px;">Cashback to wallet</p></div>
      </div>
    </div>
  `;
}

function orderCardHTML(order) {
  const store = DB.get('stores').find(s => s.id === order.storeId);
  const deal = DB.get('deals').find(d => d.id === order.dealId);
  const statusConfig = {
    pending: { color: '#fef3c7', text: '#92400e', label: 'Pending Review' },
    tracking: { color: '#dbeafe', text: '#1e40af', label: 'Tracking' },
    verified: { color: '#e0e7ff', text: '#3730a3', label: 'Verified' },
    confirmed: { color: '#d1fae5', text: '#065f46', label: 'Confirmed' },
    paid: { color: '#d1fae5', text: '#065f46', label: 'Paid' },
    disputed: { color: '#fce7f3', text: '#9d174d', label: 'Under Dispute' },
  };
  const cfg = statusConfig[order.status] || statusConfig.pending;
  
  return `<div style="border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <div style="width: 40px; height: 40px; background: ${store ? store.color : '#ccc'}; color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700;">${store ? store.initial : '?'}</div>
          <div>
            <h4 style="font-size: 15px;">${store ? store.name : 'Store'}</h4>
            <p style="font-size: 12px; color: var(--gray);">Order: ${order.orderNumber}</p>
          </div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="background: ${cfg.color}; color: ${cfg.text}; padding: 6px 14px; border-radius: 50px; font-size: 12px; font-weight: 700;">${cfg.label}</div>
        <div style="font-size: 12px; color: var(--gray); margin-top: 6px;">${order.orderDate}</div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; padding: 14px; background: var(--light-gray); border-radius: 10px;">
      <div><div style="font-size: 11px; color: var(--gray);">Order Amount</div><div style="font-weight: 700;">₹${order.orderAmount.toLocaleString('en-IN')}</div></div>
      <div><div style="font-size: 11px; color: var(--gray);">Cashback</div><div style="font-weight: 700; color: var(--primary);">₹${order.cashbackAmount}</div></div>
      <div><div style="font-size: 11px; color: var(--gray);">Deal</div><div style="font-weight: 600; font-size: 12px;">${deal ? deal.code : 'N/A'}</div></div>
      <div><div style="font-size: 11px; color: var(--gray);">Receipt</div><div style="font-weight: 600; font-size: 12px;">${order.receiptUploaded ? '✅ Uploaded' : '⚠️ Pending'}</div></div>
    </div>
    
    <div style="margin-bottom: 16px;">
      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Tracking Timeline:</div>
      ${renderTimeline(order)}
    </div>
    
    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
      <button class="btn btn-ghost btn-sm" onclick="viewOrderDetails('${order.id}')">View Details</button>
      ${!order.receiptUploaded ? `<button class="btn btn-primary btn-sm" onclick="uploadReceipt('${order.id}')">📎 Upload Receipt</button>` : ''}
      ${['pending', 'tracking'].includes(order.status) ? `<button class="btn btn-accent btn-sm" onclick="escalateOrder('${order.id}')">⚠️ Escalate</button>` : ''}
      ${order.status === 'disputed' ? `<button class="btn btn-danger btn-sm" onclick="showToast('Support team will contact you within 24 hours', 'success')">Contact Support</button>` : ''}
    </div>
  </div>`;
}

function renderTimeline(order) {
  const stages = [
    { key: 'pending', label: 'Order Submitted', date: order.trackDate, icon: '📝', desc: 'Order details submitted' },
    { key: 'tracking', label: 'Tracking with Store', date: order.trackDate && order.status !== 'pending' ? addDays(order.trackDate, 1) : null, icon: '📍', desc: 'Verifying order with store' },
    { key: 'verified', label: 'Store Verified', date: order.verifiedDate, icon: '✓', desc: 'Store confirmed validity' },
    { key: 'confirmed', label: 'Cashback Confirmed', date: order.confirmedDate, icon: '✅', desc: 'Return period over' },
    { key: 'paid', label: 'Paid to Wallet', date: order.paidDate, icon: '💰', desc: 'Cashback credited' },
  ];
  
  const statusOrder = ['pending', 'tracking', 'verified', 'confirmed', 'paid'];
  const currentIdx = statusOrder.indexOf(order.status);
  
  return `<div class="tracking-timeline">
    ${stages.map((s, i) => {
      let cls = '';
      if (order.status === 'disputed') cls = i === 0 ? 'completed' : (i === 1 ? 'rejected' : '');
      else if (i < currentIdx) cls = 'completed';
      else if (i === currentIdx) cls = 'active';
      
      return `<div class="timeline-step ${cls}">
        <div class="timeline-dot">${s.icon}</div>
        <div class="timeline-content">
          <h4>${s.label}</h4>
          <p>${s.desc}</p>
          ${s.date ? `<div class="time">${s.date}</div>` : (i <= currentIdx && order.status !== 'disputed' ? '<div class="time">Expected soon</div>' : '')}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

function setTrackingFilter(f) { currentTrackingFilter = f; renderTracking(); }

function openSubmitOrderModal() {
  const stores = DB.get('stores');
  document.getElementById('dealModalContent').innerHTML = `
    <h2>📦 Submit Order for Tracking</h2>
    <p>Enter your order details to start tracking your cashback</p>
    <div class="form-warning">⚠️ Submit within 24 hours of purchase</div>
    <div class="form-group"><label>Store</label>
      <select id="trackStore">${stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Order Number / ID</label><input type="text" id="trackOrderNum" placeholder="e.g., OD-FLIP-1234567"></div>
    <div class="form-group"><label>Order Amount (₹)</label><input type="number" id="trackAmount" placeholder="Enter total amount"></div>
    <div class="form-group"><label>Order Date</label><input type="date" id="trackDate" value="${new Date().toISOString().split('T')[0]}"></div>
    <div class="form-group"><label>Coupon Code Used</label><input type="text" id="trackCoupon" placeholder="e.g., FLIP70"></div>
    <div class="form-group">
      <label>Upload Receipt / Screenshot</label>
      <div class="upload-area" onclick="document.getElementById('receiptFile').click()">
        <div class="icon">📎</div>
        <div style="font-weight: 600;">Click to upload receipt</div>
        <div style="font-size: 12px; color: var(--gray);">PNG, JPG or PDF (max 5MB)</div>
      </div>
      <input type="file" id="receiptFile" style="display:none" accept="image/*,.pdf">
    </div>
    <button class="submit-btn" onclick="submitOrderTracking()">Submit for Tracking</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function submitOrderTracking() {
  const user = DB.getCurrentUser();
  const storeId = document.getElementById('trackStore').value;
  const orderNumber = document.getElementById('trackOrderNum').value.trim();
  const amount = parseFloat(document.getElementById('trackAmount').value);
  const orderDate = document.getElementById('trackDate').value;
  const coupon = document.getElementById('trackCoupon').value.trim();
  const receiptFile = document.getElementById('receiptFile').files[0];
  
  if (!orderNumber || !amount || !orderDate) { showToast('Please fill all required fields', 'error'); return; }
  
  const store = DB.get('stores').find(s => s.id === storeId);
  const cashbackPct = parseInt(store.cashback) || 5;
  const cashbackAmount = Math.round(amount * cashbackPct / 100);
  
  const orders = DB.get('orders');
  orders.push({
    id: 'o' + Date.now(), userId: user.id, dealId: null, storeId,
    orderNumber, orderAmount: amount, cashbackAmount,
    status: 'pending', orderDate, trackDate: new Date().toISOString().split('T')[0],
    verifiedDate: null, confirmedDate: null, paidDate: null,
    notes: `Manual submission. Coupon: ${coupon || 'None'}`,
    receiptUploaded: !!receiptFile
  });
  DB.set('orders', orders);
  
  const notifs = DB.get('notifications');
  notifs.unshift({
    id: 'n' + Date.now(), userId: user.id,
    title: 'Order Submitted',
    message: `Order ${orderNumber} submitted for tracking`,
    type: 'tracking', time: 'Just now', read: false, icon: '📦'
  });
  DB.set('notifications', notifs);
  updateNotifCount();
  
  closeModal('dealModal');
  showToast('✅ Order submitted! Tracking started.', 'success');
  renderTracking();
}

function viewOrderDetails(orderId) {
  const order = DB.get('orders').find(o => o.id === orderId);
  if (!order) return;
  const store = DB.get('stores').find(s => s.id === order.storeId);
  const deal = DB.get('deals').find(d => d.id === order.dealId);
  
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Order Details</h2>
    <div style="background: var(--light-gray); padding: 16px; border-radius: 12px; margin-bottom: 20px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
        <div><strong>Order ID:</strong><br>${order.orderNumber}</div>
        <div><strong>Store:</strong><br>${store ? store.name : 'N/A'}</div>
        <div><strong>Order Date:</strong><br>${order.orderDate}</div>
        <div><strong>Order Amount:</strong><br>₹${order.orderAmount.toLocaleString('en-IN')}</div>
        <div><strong>Cashback:</strong><br><span style="color: var(--primary); font-weight: 700;">₹${order.cashbackAmount}</span></div>
        <div><strong>Status:</strong><br><span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span></div>
        ${deal ? `<div style="grid-column: 1/-1;"><strong>Deal Used:</strong><br>${deal.title} (${deal.code})</div>` : ''}
      </div>
    </div>
    <h3 style="margin-bottom: 12px;">Tracking Timeline</h3>
    ${renderTimeline(order)}
    ${order.notes ? `<div style="background: #eff6ff; padding: 14px; border-radius: 10px; margin-top: 16px;"><strong>Note:</strong> ${order.notes}</div>` : ''}
  `;
  document.getElementById('dealModal').classList.add('active');
}

function uploadReceipt(orderId) {
  document.getElementById('dealModalContent').innerHTML = `
    <h2>📎 Upload Receipt</h2>
    <p>Upload your order receipt for faster verification</p>
    <div class="upload-area" onclick="document.getElementById('receiptUpload').click()">
      <div class="icon">📄</div>
      <div style="font-weight: 600;">Click to upload</div>
    </div>
    <input type="file" id="receiptUpload" style="display:none" accept="image/*,.pdf">
    <button class="submit-btn" onclick="confirmReceiptUpload('${orderId}')">Upload Receipt</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function confirmReceiptUpload(orderId) {
  const orders = DB.get('orders');
  const o = orders.find(x => x.id === orderId);
  if (o) {
    o.receiptUploaded = true;
    o.notes = (o.notes || '') + ' | Receipt uploaded';
    DB.set('orders', orders);
  }
  closeModal('dealModal');
  showToast('✅ Receipt uploaded!', 'success');
  renderTracking();
}

function escalateOrder(orderId) {
  document.getElementById('dealModalContent').innerHTML = `
    <h2>⚠️ Escalate Order</h2>
    <p>Having issues? Let us know and we'll prioritize it.</p>
    <div class="form-group"><label>Issue Type</label>
      <select id="escalateType">
        <option>Delay in tracking</option>
        <option>Cashback amount incorrect</option>
        <option>Order not showing</option>
        <option>Store not responding</option>
        <option>Other</option>
      </select>
    </div>
    <div class="form-group"><label>Describe the issue</label><textarea id="escalateDesc" rows="4" placeholder="Tell us what happened..."></textarea></div>
    <button class="submit-btn" onclick="submitEscalation('${orderId}')">Submit Escalation</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function submitEscalation(orderId) {
  const type = document.getElementById('escalateType').value;
  const desc = document.getElementById('escalateDesc').value;
  if (!desc) { showToast('Please describe the issue', 'error'); return; }
  
  const orders = DB.get('orders');
  const o = orders.find(x => x.id === orderId);
  if (o) {
    o.status = 'disputed';
    o.notes = (o.notes || '') + ` | Escalated: ${type} - ${desc}`;
    DB.set('orders', orders);
  }
  closeModal('dealModal');
  showToast('⚠️ Order escalated. Support will contact within 24 hours.', 'success');
  renderTracking();
}

function renderMissingCashback() {
  const user = DB.getCurrentUser();
  const claims = DB.get('claims').filter(c => c.userId === user.id);
  const stores = DB.get('stores');
  const content = document.getElementById('missingCashbackContent');
  
  content.innerHTML = `
    <div class="grid-2">
      <div>
        <div style="background: white; padding: 30px; border-radius: 16px;">
          <h3 style="margin-bottom: 16px;">🔍 Submit Missing Cashback Claim</h3>
          <div class="form-warning">⚠️ Claims must be submitted within 7 days of purchase</div>
          <div class="form-group"><label>Store</label>
            <select id="claimStore">${stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label>Order Number</label><input type="text" id="claimOrderNum" placeholder="Enter order ID"></div>
          <div class="form-group"><label>Order Amount (₹)</label><input type="number" id="claimAmount" placeholder="Total order value"></div>
          <div class="form-group"><label>Order Date</label><input type="date" id="claimDate"></div>
          <div class="form-group"><label>Expected Cashback (₹)</label><input type="number" id="claimCashback" placeholder="Expected amount"></div>
          <div class="form-group"><label>Describe the issue</label><textarea id="claimDesc" rows="4" placeholder="Explain what happened..."></textarea></div>
          <div class="form-group">
            <label>Upload Receipt (Required)</label>
            <div class="upload-area" onclick="document.getElementById('claimReceipt').click()">
              <div class="icon">📎</div>
              <div style="font-weight: 600;">Upload receipt</div>
            </div>
            <input type="file" id="claimReceipt" style="display:none" accept="image/*,.pdf">
          </div>
          <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="submitClaim()">Submit Claim</button>
        </div>
      </div>
      <div>
        <div style="background: white; padding: 30px; border-radius: 16px; margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">📋 My Claims</h3>
          ${claims.length === 0 ? '<p style="color: var(--gray); text-align: center; padding: 20px;">No claims submitted yet</p>' : `
            <div style="display: grid; gap: 12px;">
              ${claims.map(c => {
                const store = DB.get('stores').find(s => s.id === c.storeId);
                return `<div style="padding: 14px; background: var(--light-gray); border-radius: 10px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <strong>${store ? store.name : 'Store'}</strong>
                    <span class="status-badge status-${c.status === 'investigating' ? 'processing' : c.status}">${c.status}</span>
                  </div>
                  <div style="font-size: 13px; color: var(--gray);">Order: ${c.orderNumber}</div>
                  <div style="font-size: 13px; color: var(--gray);">Amount: ₹${c.orderAmount} | Expected: ₹${c.expectedCashback}</div>
                  <div style="font-size: 12px; color: var(--gray); margin-top: 6px;">Submitted: ${c.submittedDate}</div>
                </div>`;
              }).join('')}
            </div>
          `}
        </div>
        <div style="background: white; padding: 30px; border-radius: 16px;">
          <h3 style="margin-bottom: 16px;">💡 Tips for Successful Claims</h3>
          <ul style="line-height: 2; color: var(--gray); padding-left: 20px; font-size: 14px;">
            <li>Submit within 7 days of purchase</li>
            <li>Upload clear receipt screenshot</li>
            <li>Include order ID and amount</li>
            <li>Ensure you clicked through IndiaOffers</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function submitClaim() {
  const user = DB.getCurrentUser();
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
  
  const claims = DB.get('claims');
  claims.push({
    id: 'cl' + Date.now(), userId: user.id, storeId, orderNumber,
    orderAmount, expectedCashback, orderDate,
    submittedDate: new Date().toISOString().split('T')[0],
    status: 'pending', notes: desc, orderId: null,
    receiptUploaded: !!receipt
  });
  DB.set('claims', claims);
  
  showToast('✅ Claim submitted! We\'ll investigate within 7 days.', 'success');
  renderMissingCashback();
}

// Dashboard module
function renderDashboard() {
  const user = DB.getCurrentUser();
  const orders = DB.get('orders').filter(o => o.userId === user.id);
  const totalEarned = orders.filter(o => ['confirmed', 'paid'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  const pending = orders.filter(o => ['pending', 'tracking', 'verified'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  const favs = DB.get('favorites').filter(f => f.userId === user.id).length;
  const referrals = DB.get('referrals').filter(r => r.referrerId === user.id).length;
  
  document.getElementById('dashContent').innerHTML = `
    <div class="dashboard-header">
      <div><h2>Welcome back, ${user.name.split(' ')[0]}! 👋</h2><p>Here's your cashback summary</p></div>
      <button class="btn btn-primary" onclick="navigate('wallet')">Withdraw Cashback</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-icon">💰</div><h4>Wallet Balance</h4><div class="value">₹${user.wallet}</div><div class="change">Available to withdraw</div></div>
      <div class="stat-card orange"><div class="stat-card-icon">🎁</div><h4>Total Earned</h4><div class="value">₹${totalEarned}</div><div class="change">Lifetime earnings</div></div>
      <div class="stat-card blue"><div class="stat-card-icon">⏳</div><h4>Pending Cashback</h4><div class="value">₹${pending}</div><div class="change">${orders.filter(o => ['pending', 'tracking', 'verified'].includes(o.status)).length} orders</div></div>
      <div class="stat-card purple"><div class="stat-card-icon">👥</div><h4>Referrals</h4><div class="value">${referrals}</div></div>
      <div class="stat-card pink"><div class="stat-card-icon">❤️</div><h4>Favorites</h4><div class="value">${favs}</div></div>
    </div>
    <div class="grid-2">
      <div class="chart-container">
        <div class="chart-title">Recent Orders</div>
        ${orders.length === 0 ? '<p style="color: var(--gray); text-align: center; padding: 20px;">No orders yet</p>' : `
          <table><thead><tr><th>Store</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            ${orders.slice(-5).reverse().map(o => {
              const store = DB.get('stores').find(s => s.id === o.storeId);
              return `<tr><td>${store ? store.name : 'Store'}</td><td><strong>₹${o.cashbackAmount}</strong></td><td><span class="status-badge status-${o.status}">${o.status}</span></td></tr>`;
            }).join('')}
          </tbody></table>
        `}
      </div>
      <div class="chart-container">
        <div class="chart-title">Quick Actions</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <button class="btn btn-primary" onclick="navigate('deals')" style="padding: 20px; flex-direction: column; height: 100px;">🛍️<br>Shop & Earn</button>
          <button class="btn btn-accent" onclick="navigate('tracking')" style="padding: 20px; flex-direction: column; height: 100px;">📦<br>Track Orders</button>
          <button class="btn btn-ghost" onclick="navigate('wallet')" style="padding: 20px; flex-direction: column; height: 100px;">💸<br>Withdraw</button>
          <button class="btn btn-ghost" onclick="navigate('missing-cashback')" style="padding: 20px; flex-direction: column; height: 100px;">🔍<br>Claim Missing</button>
        </div>
      </div>
    </div>
  `;
}

function renderCashbacks() {
  const user = DB.getCurrentUser();
  const orders = DB.get('orders').filter(o => o.userId === user.id).reverse();
  const content = document.getElementById('cashbacksContent');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Cashback History</h2><p>Track all your cashback transactions</p></div></div>
    ${orders.length === 0 ? `<div class="empty-state"><div class="icon">🎁</div><h3>No cashbacks yet</h3><button class="btn btn-primary" onclick="navigate('deals')">Browse Deals</button></div>` : `
      <div class="table-container"><table>
        <thead><tr><th>Date</th><th>Store</th><th>Order ID</th><th>Amount</th><th>Cashback</th><th>Status</th></tr></thead>
        <tbody>${orders.map(o => {
          const store = DB.get('stores').find(s => s.id === o.storeId);
          return `<tr><td>${o.orderDate}</td><td><strong>${store ? store.name : 'Store'}</strong></td><td style="font-size: 12px;">${o.orderNumber}</td><td>₹${o.orderAmount}</td><td><strong style="color: var(--primary);">₹${o.cashbackAmount}</strong></td><td><span class="status-badge status-${o.status}">${o.status}</span></td></tr>`;
        }).join('')}</tbody>
      </table></div>
    `}
  `;
}

function renderTopEarners() {
  const users = DB.get('users').filter(u => !u.isAdmin).sort((a, b) => b.totalEarned - a.totalEarned);
  const content = document.getElementById('topEarnersContent');
  content.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="leaderboard">
          <h3 style="margin-bottom: 20px;">🏆 Monthly Leaderboard</h3>
          ${users.map((u, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`;
            return `<div class="leaderboard-item">
              <div class="leaderboard-rank ${rankClass}">${medal}</div>
              <div class="leaderboard-info"><h5>${u.name}</h5><p>${u.referrals} referrals • Member since ${u.joined}</p></div>
              <div class="leaderboard-amount">₹${u.totalEarned.toLocaleString('en-IN')}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div>
        <div style="background: white; padding: 30px; border-radius: 16px; margin-bottom: 20px;">
          <h3 style="margin-bottom: 16px;">🎁 Rewards</h3>
          <div style="display: grid; gap: 12px;">
            <div style="padding: 16px; background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; border-radius: 12px;">
              <div style="font-size: 14px; font-weight: 600;">🥇 1st Place</div>
              <div style="font-size: 22px; font-weight: 800;">₹5,000 Bonus</div>
            </div>
            <div style="padding: 16px; background: linear-gradient(135deg, #cbd5e1, #94a3b8); color: white; border-radius: 12px;">
              <div style="font-size: 14px; font-weight: 600;">🥈 2nd Place</div>
              <div style="font-size: 22px; font-weight: 800;">₹3,000 Bonus</div>
            </div>
            <div style="padding: 16px; background: linear-gradient(135deg, #d97706, #92400e); color: white; border-radius: 12px;">
              <div style="font-size: 14px; font-weight: 600;">🥉 3rd Place</div>
              <div style="font-size: 22px; font-weight: 800;">₹2,000 Bonus</div>
            </div>
          </div>
        </div>
        <div style="background: white; padding: 30px; border-radius: 16px;">
          <h3 style="margin-bottom: 16px;">📈 How to Climb</h3>
          <ul style="line-height: 2; color: var(--gray); padding-left: 20px;">
            <li>Shop more through IndiaOffers</li>
            <li>Refer friends (₹100 per referral)</li>
            <li>Use high-cashback deals</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Wallet, Favorites, Referrals, Profile modules
let selectedWithdrawMethod = 'Bank Transfer';

function renderWallet() {
  const user = DB.getCurrentUser();
  const withdrawals = DB.get('withdrawals').filter(w => w.userId === user.id).reverse();
  const content = document.getElementById('walletContent');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>My Wallet</h2><p>Manage your cashback balance</p></div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-icon">💰</div><h4>Available Balance</h4><div class="value">₹${user.wallet}</div></div>
      <div class="stat-card orange"><div class="stat-card-icon">💸</div><h4>Total Withdrawn</h4><div class="value">₹${withdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + w.amount, 0)}</div></div>
      <div class="stat-card blue"><div class="stat-card-icon">⏳</div><h4>Pending</h4><div class="value">₹${withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0)}</div></div>
    </div>
    <div class="chart-container">
      <div class="chart-title">Withdraw Cashback</div>
      <div class="form-info">Minimum withdrawal: ₹250. Processing: 24-48 hours.</div>
      <div class="form-group"><label>Select Method</label>
        <div class="withdraw-methods">
          <div class="withdraw-method active" onclick="selectWithdrawMethod(this, 'Bank Transfer')"><div class="icon">🏦</div><div class="name">Bank Transfer</div></div>
          <div class="withdraw-method" onclick="selectWithdrawMethod(this, 'UPI')"><div class="icon">📱</div><div class="name">UPI</div></div>
          <div class="withdraw-method" onclick="selectWithdrawMethod(this, 'Paytm')"><div class="icon">💳</div><div class="name">Paytm</div></div>
        </div>
      </div>
      <div class="form-group"><label>Amount (₹)</label><input type="number" id="withdrawAmount" placeholder="Min ₹250" min="250" max="${user.wallet}"></div>
      <div class="form-group"><label>Account Details</label><input type="text" id="withdrawDetails" placeholder="Bank/UPI/Paytm"></div>
      <button class="btn btn-primary btn-lg" style="width: 100%;" onclick="requestWithdrawal()">Request Withdrawal</button>
    </div>
    <div class="chart-container">
      <div class="chart-title">Withdrawal History</div>
      ${withdrawals.length === 0 ? '<p style="color: var(--gray); text-align: center; padding: 20px;">No withdrawals yet</p>' : `
        <table><thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Details</th><th>Status</th></tr></thead>
        <tbody>${withdrawals.map(w => `<tr><td>${w.date}</td><td><strong>₹${w.amount}</strong></td><td>${w.method}</td><td>${w.details}</td><td><span class="status-badge status-${w.status}">${w.status}</span></td></tr>`).join('')}</tbody></table>
      `}
    </div>
  `;
}

function selectWithdrawMethod(el, method) {
  document.querySelectorAll('.withdraw-method').forEach(m => m.classList.remove('active'));
  el.classList.add('active');
  selectedWithdrawMethod = method;
}

function requestWithdrawal() {
  const user = DB.getCurrentUser();
  const amount = parseInt(document.getElementById('withdrawAmount').value);
  const details = document.getElementById('withdrawDetails').value.trim();
  if (!amount || amount < 250) { showToast('Minimum withdrawal is ₹250', 'error'); return; }
  if (amount > user.wallet) { showToast('Insufficient balance', 'error'); return; }
  if (!details) { showToast('Please enter account details', 'error'); return; }
  const withdrawals = DB.get('withdrawals');
  withdrawals.push({ id: 'w' + Date.now(), userId: user.id, amount, method: selectedWithdrawMethod, status: 'pending', date: new Date().toISOString().split('T')[0], details });
  DB.set('withdrawals', withdrawals);
  const users = DB.get('users');
  const u = users.find(x => x.id === user.id);
  u.wallet -= amount;
  DB.set('users', users);
  updateAuthUI();
  showToast('Withdrawal requested! Processing in 24-48 hours.', 'success');
  renderWallet();
}

function renderFavorites() {
  const user = DB.getCurrentUser();
  const favs = DB.get('favorites').filter(f => f.userId === user.id);
  const deals = favs.map(f => DB.get('deals').find(d => d.id === f.dealId)).filter(Boolean);
  const content = document.getElementById('favoritesContent');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>My Favorites</h2><p>Your saved deals</p></div></div>
    ${deals.length === 0 ? `<div class="empty-state"><div class="icon">❤️</div><h3>No favorites yet</h3><button class="btn btn-primary" onclick="navigate('deals')">Browse Deals</button></div>` : `<div class="deals-grid">${deals.map(d => dealCardHTML(d)).join('')}</div>`}
  `;
}

function renderReferrals() {
  const user = DB.getCurrentUser();
  const referrals = DB.get('referrals').filter(r => r.referrerId === user.id);
  const totalBonus = referrals.reduce((s, r) => s + r.bonus, 0);
  const content = document.getElementById('referralsContent');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Refer & Earn</h2><p>Invite friends and earn ₹100</p></div></div>
    <div class="referral-card">
      <h2 style="font-size: 24px; margin-bottom: 8px;">Your Referral Code</h2>
      <p style="opacity: 0.9;">Share this code. You both earn ₹100!</p>
      <div class="referral-code">${user.referralCode}</div>
      <button class="btn" style="background: white; color: #8b5cf6;" onclick="copyReferralCode('${user.referralCode}')">📋 Copy Code</button>
      <button class="btn" style="background: rgba(255,255,255,0.2); color: white; margin-left: 8px;" onclick="shareReferral()">📤 Share</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card purple"><div class="stat-card-icon">👥</div><h4>Total Referrals</h4><div class="value">${referrals.length}</div></div>
      <div class="stat-card"><div class="stat-card-icon">💰</div><h4>Total Bonus</h4><div class="value">₹${totalBonus}</div></div>
    </div>
    <div class="chart-container">
      <div class="chart-title">Your Referrals</div>
      ${referrals.length === 0 ? '<p style="color: var(--gray); text-align: center; padding: 20px;">No referrals yet</p>' : `
        <table><thead><tr><th>Date</th><th>Friend</th><th>Bonus</th><th>Status</th></tr></thead>
        <tbody>${referrals.map(r => {
          const friend = DB.get('users').find(u => u.id === r.referredId);
          return `<tr><td>${r.date}</td><td>${friend ? friend.name : 'Friend'}</td><td><strong style="color: var(--primary);">₹${r.bonus}</strong></td><td><span class="status-badge status-approved">Earned</span></td></tr>`;
        }).join('')}</tbody></table>
      `}
    </div>
  `;
}

function copyReferralCode(code) { navigator.clipboard.writeText(code); showToast('Referral code copied!', 'success'); }
function shareReferral() {
  const user = DB.getCurrentUser();
  const text = `Join IndiaOffers.in and earn cashback! Use my code ${user.referralCode} for ₹100 bonus. Sign up: indiaoffers.in`;
  if (navigator.share) navigator.share({ title: 'IndiaOffers.in', text });
  else { navigator.clipboard.writeText(text); showToast('Referral message copied!', 'success'); }
}

function renderProfile() {
  const user = DB.getCurrentUser();
  const content = document.getElementById('profileContent');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>My Profile</h2><p>Manage your account details</p></div></div>
    <div class="grid-2">
      <div>
        <h3 style="margin-bottom: 16px;">Personal Information</h3>
        <div class="form-group"><label>Full Name</label><input type="text" id="profileName" value="${user.name}"></div>
        <div class="form-group"><label>Email</label><input type="email" id="profileEmail" value="${user.email}"></div>
        <div class="form-group"><label>Phone</label><input type="tel" id="profilePhone" value="${user.phone}"></div>
        <button class="btn btn-primary" onclick="updateProfile()">Save Changes</button>
      </div>
      <div>
        <h3 style="margin-bottom: 16px;">Account Details</h3>
        <div style="background: var(--light-gray); padding: 20px; border-radius: 12px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span style="color: var(--gray);">Member Since</span><strong>${user.joined}</strong></div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;"><span style="color: var(--gray);">Referral Code</span><strong style="color: var(--primary);">${user.referralCode}</strong></div>
          <div style="display: flex; justify-content: space-between;"><span style="color: var(--gray);">Account Type</span><strong>${user.isAdmin ? 'Admin' : 'User'}</strong></div>
        </div>
        <h3 style="margin-bottom: 16px;">Change Password</h3>
        <div class="form-group"><label>Current Password</label><input type="password" id="currentPassword"></div>
        <div class="form-group"><label>New Password</label><input type="password" id="newPassword"></div>
        <button class="btn btn-primary" onclick="changePassword()">Update Password</button>
      </div>
    </div>
  `;
}

function updateProfile() {
  const user = DB.getCurrentUser();
  const name = document.getElementById('profileName').value.trim();
  const email = document.getElementById('profileEmail').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();
  if (!name || !email || !phone) { showToast('Please fill all fields', 'error'); return; }
  const users = DB.get('users');
  const u = users.find(x => x.id === user.id);
  u.name = name; u.email = email; u.phone = phone;
  DB.set('users', users);
  updateAuthUI(); updateSidebar();
  showToast('Profile updated!', 'success');
}

function changePassword() {
  const user = DB.getCurrentUser();
  const current = document.getElementById('currentPassword').value;
  const newPass = document.getElementById('newPassword').value;
  if (current !== user.password) { showToast('Current password incorrect', 'error'); return; }
  if (newPass.length < 6) { showToast('Password must be 6+ chars', 'error'); return; }
  const users = DB.get('users');
  const u = users.find(x => x.id === user.id);
  u.password = newPass;
  DB.set('users', users);
  showToast('Password changed!', 'success');
}

// Admin panel module
let currentAdminTab = 'dashboard';

function renderAdmin() {
  const admin = DB.getCurrentUser();
  document.getElementById('adminAvatar').textContent = admin.name.charAt(0).toUpperCase();
  document.getElementById('adminName').textContent = admin.name;
  document.getElementById('adminEmail').textContent = admin.email;
  renderAdminContent();
}

function switchAdminTab(tab, e) {
  currentAdminTab = tab;
  document.querySelectorAll('#view-admin .sidebar-nav a').forEach(a => a.classList.remove('active'));
  e.target.closest('a').classList.add('active');
  renderAdminContent();
}

function renderAdminContent() {
  const content = document.getElementById('adminContent');
  if (currentAdminTab === 'dashboard') renderAdminDashboard(content);
  else if (currentAdminTab === 'users') renderAdminUsers(content);
  else if (currentAdminTab === 'stores') renderAdminStores(content);
  else if (currentAdminTab === 'deals') renderAdminDeals(content);
  else if (currentAdminTab === 'orders') renderAdminOrders(content);
  else if (currentAdminTab === 'claims') renderAdminClaims(content);
  else if (currentAdminTab === 'withdrawals') renderAdminWithdrawals(content);
  else if (currentAdminTab === 'reports') renderAdminReports(content);
}

function renderAdminDashboard(content) {
  const users = DB.get('users').filter(u => !u.isAdmin);
  const stores = DB.get('stores');
  const deals = DB.get('deals');
  const orders = DB.get('orders');
  const claims = DB.get('claims');
  const withdrawals = DB.get('withdrawals');
  const totalCashback = orders.filter(o => ['confirmed', 'paid'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + w.amount, 0);
  
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Admin Dashboard</h2><p>Overview of platform activity</p></div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-card-icon">👥</div><h4>Total Users</h4><div class="value">${users.length}</div></div>
      <div class="stat-card orange"><div class="stat-card-icon">🏪</div><h4>Stores</h4><div class="value">${stores.length}</div></div>
      <div class="stat-card blue"><div class="stat-card-icon">🎁</div><h4>Active Deals</h4><div class="value">${deals.length}</div></div>
      <div class="stat-card purple"><div class="stat-card-icon">📦</div><h4>Orders Tracked</h4><div class="value">${orders.length}</div></div>
      <div class="stat-card pink"><div class="stat-card-icon">💰</div><h4>Cashback Paid</h4><div class="value">₹${totalCashback}</div></div>
      <div class="stat-card red"><div class="stat-card-icon">💸</div><h4>Pending Withdrawals</h4><div class="value">₹${pendingWithdrawals}</div></div>
    </div>
    <div class="chart-container">
      <div class="chart-title">Orders by Status</div>
      <div class="bar-chart">
        ${['pending', 'tracking', 'verified', 'confirmed', 'paid'].map(status => {
          const count = orders.filter(o => o.status === status).length;
          const height = Math.max(10, count * 15);
          return `<div class="bar" style="height: ${height}%;"><div class="bar-value">${count}</div><div class="bar-label">${status}</div></div>`;
        }).join('')}
      </div>
    </div>
    <div class="grid-2">
      <div class="chart-container">
        <div class="chart-title">Recent Orders</div>
        <table><thead><tr><th>Order</th><th>User</th><th>Status</th></tr></thead>
        <tbody>${orders.slice(-5).reverse().map(o => {
          const u = DB.get('users').find(x => x.id === o.userId);
          return `<tr><td style="font-size: 12px;">${o.orderNumber}</td><td>${u ? u.name : 'User'}</td><td><span class="status-badge status-${o.status}">${o.status}</span></td></tr>`;
        }).join('')}</tbody></table>
      </div>
      <div class="chart-container">
        <div class="chart-title">Pending Claims</div>
        <table><thead><tr><th>User</th><th>Store</th><th>Status</th></tr></thead>
        <tbody>${claims.slice(-5).map(c => {
          const u = DB.get('users').find(x => x.id === c.userId);
          const s = DB.get('stores').find(x => x.id === c.storeId);
          return `<tr><td>${u ? u.name : 'User'}</td><td>${s ? s.name : 'Store'}</td><td><span class="status-badge status-${c.status === 'investigating' ? 'processing' : c.status}">${c.status}</span></td></tr>`;
        }).join('')}</tbody></table>
      </div>
    </div>
  `;
}

function renderAdminUsers(content) {
  const users = DB.get('users').filter(u => !u.isAdmin);
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Users Management</h2></div><div style="color: var(--gray);">Total: ${users.length}</div></div>
    <div class="table-container"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Wallet</th><th>Orders</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>${users.map(u => {
        const orderCount = DB.get('orders').filter(o => o.userId === u.id).length;
        return `<tr><td><strong>${u.name}</strong></td><td>${u.email}</td><td>${u.phone}</td><td><strong style="color: var(--primary);">₹${u.wallet}</strong></td><td>${orderCount}</td><td>${u.joined}</td>
          <td><button class="action-btn view" onclick="viewUser('${u.id}')">View</button><button class="action-btn delete" onclick="deleteUser('${u.id}')">Delete</button></td></tr>`;
      }).join('')}</tbody>
    </table></div>
  `;
}

function viewUser(id) {
  const user = DB.get('users').find(u => u.id === id);
  if (!user) return;
  const orders = DB.get('orders').filter(o => o.userId === id);
  const totalEarned = orders.filter(o => ['confirmed', 'paid'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  document.getElementById('dealModalContent').innerHTML = `
    <h2>${user.name}</h2><p>${user.email} • ${user.phone}</p>
    <div class="stats-grid" style="margin: 20px 0;">
      <div class="stat-card"><h4>Wallet</h4><div class="value">₹${user.wallet}</div></div>
      <div class="stat-card orange"><h4>Earned</h4><div class="value">₹${totalEarned}</div></div>
      <div class="stat-card blue"><h4>Orders</h4><div class="value">${orders.length}</div></div>
    </div>
    <div style="background: var(--light-gray); padding: 16px; border-radius: 12px;">
      <p><strong>Member Since:</strong> ${user.joined}</p>
      <p><strong>Referral Code:</strong> ${user.referralCode}</p>
      <p><strong>Referrals:</strong> ${user.referrals}</p>
    </div>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function deleteUser(id) {
  if (!confirm('Delete this user?')) return;
  DB.set('users', DB.get('users').filter(u => u.id !== id));
  showToast('User deleted', 'success');
  renderAdminContent();
}

function renderAdminStores(content) {
  const stores = DB.get('stores');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Stores Management</h2></div><button class="btn btn-primary" onclick="openAddStoreModal()">+ Add Store</button></div>
    <div class="table-container"><table>
      <thead><tr><th>Store</th><th>Category</th><th>Cashback</th><th>Deals</th><th>Rating</th><th>Actions</th></tr></thead>
      <tbody>${stores.map(s => `<tr>
        <td><div style="display: flex; align-items: center; gap: 10px;"><div style="width: 36px; height: 36px; background: ${s.color}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700;">${s.initial}</div><strong>${s.name}</strong></div></td>
        <td style="text-transform: capitalize;">${s.category}</td>
        <td><strong style="color: var(--primary);">${s.cashback}</strong></td>
        <td>${s.dealsCount}</td>
        <td>⭐ ${s.rating}</td>
        <td><button class="action-btn edit" onclick="editStore('${s.id}')">Edit</button><button class="action-btn delete" onclick="deleteStore('${s.id}')">Delete</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  `;
}

function openAddStoreModal() {
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Add New Store</h2>
    <div class="form-group"><label>Store Name</label><input type="text" id="newStoreName"></div>
    <div class="form-group"><label>Category</label><select id="newStoreCategory"><option value="shopping">Shopping</option><option value="fashion">Fashion</option><option value="electronics">Electronics</option><option value="food">Food</option><option value="travel">Travel</option><option value="recharge">Recharge</option><option value="grocery">Grocery</option><option value="health">Health</option><option value="beauty">Beauty</option></select></div>
    <div class="form-group"><label>Cashback %</label><input type="text" id="newStoreCashback" placeholder="e.g., 10%"></div>
    <div class="form-group"><label>Color</label><input type="color" id="newStoreColor" value="#2563eb"></div>
    <div class="form-group"><label>Description</label><textarea id="newStoreDesc" rows="3"></textarea></div>
    <button class="submit-btn" onclick="addStore()">Add Store</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function addStore() {
  const name = document.getElementById('newStoreName').value.trim();
  const category = document.getElementById('newStoreCategory').value;
  const cashback = document.getElementById('newStoreCashback').value.trim();
  const color = document.getElementById('newStoreColor').value;
  const desc = document.getElementById('newStoreDesc').value.trim();
  if (!name || !cashback) { showToast('Fill required fields', 'error'); return; }
  const stores = DB.get('stores');
  stores.push({ id: 's' + Date.now(), name, category, cashback, color, initial: name.charAt(0).toUpperCase(), description: desc, dealsCount: 0, url: name.toLowerCase().replace(/\s/g, '') + '.com', rating: 4.0, totalUsers: 0 });
  DB.set('stores', stores);
  closeModal('dealModal');
  showToast('Store added!', 'success');
  renderAdminContent();
}

function editStore(id) {
  const store = DB.get('stores').find(s => s.id === id);
  if (!store) return;
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Edit Store</h2>
    <div class="form-group"><label>Store Name</label><input type="text" id="editStoreName" value="${store.name}"></div>
    <div class="form-group"><label>Cashback %</label><input type="text" id="editStoreCashback" value="${store.cashback}"></div>
    <div class="form-group"><label>Rating</label><input type="number" id="editStoreRating" value="${store.rating}" step="0.1" min="0" max="5"></div>
    <div class="form-group"><label>Description</label><textarea id="editStoreDesc" rows="3">${store.description}</textarea></div>
    <button class="submit-btn" onclick="saveStore('${id}')">Save Changes</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function saveStore(id) {
  const stores = DB.get('stores');
  const s = stores.find(x => x.id === id);
  s.name = document.getElementById('editStoreName').value.trim();
  s.cashback = document.getElementById('editStoreCashback').value.trim();
  s.rating = parseFloat(document.getElementById('editStoreRating').value);
  s.description = document.getElementById('editStoreDesc').value.trim();
  DB.set('stores', stores);
  closeModal('dealModal');
  showToast('Store updated!', 'success');
  renderAdminContent();
}

function deleteStore(id) {
  if (!confirm('Delete this store and all its deals?')) return;
  DB.set('stores', DB.get('stores').filter(s => s.id !== id));
  DB.set('deals', DB.get('deals').filter(d => d.storeId !== id));
  showToast('Store deleted', 'success');
  renderAdminContent();
}

function renderAdminDeals(content) {
  const deals = DB.get('deals');
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Deals Management</h2></div><button class="btn btn-primary" onclick="openAddDealModal()">+ Add Deal</button></div>
    <div class="table-container"><table>
      <thead><tr><th>Title</th><th>Store</th><th>Code</th><th>Cashback</th><th>Uses</th><th>Expiry</th><th>Actions</th></tr></thead>
      <tbody>${deals.map(d => {
        const store = DB.get('stores').find(s => s.id === d.storeId);
        return `<tr><td><strong>${d.title}</strong><br><small style="color: var(--gray);">${d.badge}</small></td><td>${store ? store.name : 'N/A'}</td><td><code style="background: var(--light-gray); padding: 4px 8px; border-radius: 4px;">${d.code}</code></td><td><strong style="color: var(--primary);">${d.cashback}</strong></td><td>${d.uses || 0}</td><td>${d.expiry}</td>
          <td><button class="action-btn edit" onclick="editDeal('${d.id}')">Edit</button><button class="action-btn delete" onclick="deleteDeal('${d.id}')">Delete</button></td></tr>`;
      }).join('')}</tbody>
    </table></div>
  `;
}

function openAddDealModal() {
  const stores = DB.get('stores');
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Add New Deal</h2>
    <div class="form-group"><label>Title</label><input type="text" id="newDealTitle"></div>
    <div class="form-group"><label>Store</label><select id="newDealStore">${stores.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Category</label><select id="newDealCat"><option value="shopping">Shopping</option><option value="fashion">Fashion</option><option value="electronics">Electronics</option><option value="food">Food</option><option value="travel">Travel</option><option value="recharge">Recharge</option><option value="grocery">Grocery</option><option value="health">Health</option><option value="beauty">Beauty</option></select></div>
    <div class="form-group"><label>Coupon Code</label><input type="text" id="newDealCode"></div>
    <div class="form-group"><label>Cashback %</label><input type="text" id="newDealCashback" placeholder="e.g., 10%"></div>
    <div class="form-group"><label>Description</label><textarea id="newDealDesc" rows="3"></textarea></div>
    <div class="form-group"><label>Badge</label><input type="text" id="newDealBadge" placeholder="HOT, NEW"></div>
    <div class="form-group"><label>Expiry</label><input type="text" id="newDealExpiry" placeholder="e.g., 5 days"></div>
    <div class="form-group"><label>Min Order (₹)</label><input type="number" id="newDealMin" value="499"></div>
    <button class="submit-btn" onclick="addDeal()">Add Deal</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function addDeal() {
  const title = document.getElementById('newDealTitle').value.trim();
  const storeId = document.getElementById('newDealStore').value;
  const cat = document.getElementById('newDealCat').value;
  const code = document.getElementById('newDealCode').value.trim().toUpperCase();
  const cashback = document.getElementById('newDealCashback').value.trim();
  const desc = document.getElementById('newDealDesc').value.trim();
  const badge = document.getElementById('newDealBadge').value.trim() || 'NEW';
  const expiry = document.getElementById('newDealExpiry').value.trim() || '7 days';
  const minOrder = parseInt(document.getElementById('newDealMin').value) || 499;
  if (!title || !code || !cashback) { showToast('Fill required fields', 'error'); return; }
  const deals = DB.get('deals');
  deals.push({ id: 'd' + Date.now(), storeId, cat, code, cashback, desc, badge, expiry, minOrder, title, type: 'coupon', image: 'https://image.qwenlm.ai/public_source/de16efc1-1c56-46b1-bb76-02fd3509169f/171ff5d1b-118e-48c2-a0cf-9c3414a0c790.png', trending: false, expiring: false, uses: 0 });
  DB.set('deals', deals);
  closeModal('dealModal');
  showToast('Deal added!', 'success');
  renderAdminContent();
}

function editDeal(id) {
  const deal = DB.get('deals').find(d => d.id === id);
  if (!deal) return;
  document.getElementById('dealModalContent').innerHTML = `
    <h2>Edit Deal</h2>
    <div class="form-group"><label>Title</label><input type="text" id="editDealTitle" value="${deal.title}"></div>
    <div class="form-group"><label>Code</label><input type="text" id="editDealCode" value="${deal.code}"></div>
    <div class="form-group"><label>Cashback</label><input type="text" id="editDealCashback" value="${deal.cashback}"></div>
    <div class="form-group"><label>Description</label><textarea id="editDealDesc" rows="3">${deal.desc}</textarea></div>
    <button class="submit-btn" onclick="saveDeal('${id}')">Save Changes</button>
  `;
  document.getElementById('dealModal').classList.add('active');
}

function saveDeal(id) {
  const deals = DB.get('deals');
  const d = deals.find(x => x.id === id);
  d.title = document.getElementById('editDealTitle').value.trim();
  d.code = document.getElementById('editDealCode').value.trim().toUpperCase();
  d.cashback = document.getElementById('editDealCashback').value.trim();
  d.desc = document.getElementById('editDealDesc').value.trim();
  DB.set('deals', deals);
  closeModal('dealModal');
  showToast('Deal updated!', 'success');
  renderAdminContent();
}

function deleteDeal(id) {
  if (!confirm('Delete this deal?')) return;
  DB.set('deals', DB.get('deals').filter(d => d.id !== id));
  showToast('Deal deleted', 'success');
  renderAdminContent();
}

function renderAdminOrders(content) {
  const orders = DB.get('orders').slice().reverse();
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Order Tracking Management</h2><p>Verify and update order tracking status</p></div><div style="color: var(--gray);">Total: ${orders.length} orders</div></div>
    <div class="stats-grid">
      <div class="stat-card"><h4>Pending</h4><div class="value">${orders.filter(o => o.status === 'pending').length}</div></div>
      <div class="stat-card blue"><h4>Tracking</h4><div class="value">${orders.filter(o => o.status === 'tracking').length}</div></div>
      <div class="stat-card purple"><h4>Verified</h4><div class="value">${orders.filter(o => o.status === 'verified').length}</div></div>
      <div class="stat-card orange"><h4>Confirmed</h4><div class="value">${orders.filter(o => o.status === 'confirmed').length}</div></div>
      <div class="stat-card"><h4>Paid</h4><div class="value">${orders.filter(o => o.status === 'paid').length}</div></div>
      <div class="stat-card red"><h4>Disputed</h4><div class="value">${orders.filter(o => o.status === 'disputed').length}</div></div>
    </div>
    <div class="table-container"><table>
      <thead><tr><th>Order ID</th><th>User</th><th>Store</th><th>Amount</th><th>Cashback</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>${orders.map(o => {
        const u = DB.get('users').find(x => x.id === o.userId);
        const s = DB.get('stores').find(x => x.id === o.storeId);
        return `<tr>
          <td style="font-size: 12px;">${o.orderNumber}</td>
          <td>${u ? u.name : 'User'}</td>
          <td>${s ? s.name : 'Store'}</td>
          <td>₹${o.orderAmount.toLocaleString('en-IN')}</td>
          <td><strong style="color: var(--primary);">₹${o.cashbackAmount}</strong></td>
          <td><span class="status-badge status-${o.status}">${o.status}</span></td>
          <td>${o.orderDate}</td>
          <td>
            <button class="action-btn view" onclick="viewOrderDetails('${o.id}')">View</button>
            <button class="action-btn approve" onclick="advanceOrderStatus('${o.id}')">Advance →</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  `;
}

function advanceOrderStatus(orderId) {
  const orders = DB.get('orders');
  const o = orders.find(x => x.id === orderId);
  if (!o) return;
  const flow = ['pending', 'tracking', 'verified', 'confirmed', 'paid'];
  const idx = flow.indexOf(o.status);
  if (idx < flow.length - 1) {
    const newStatus = flow[idx + 1];
    o.status = newStatus;
    const today = new Date().toISOString().split('T')[0];
    if (newStatus === 'tracking') o.trackDate = today;
    if (newStatus === 'verified') o.verifiedDate = today;
    if (newStatus === 'confirmed') {
      o.confirmedDate = today;
      const users = DB.get('users');
      const u = users.find(x => x.id === o.userId);
      if (u) { u.wallet += o.cashbackAmount; u.totalEarned = (u.totalEarned || 0) + o.cashbackAmount; DB.set('users', users); }
    }
    if (newStatus === 'paid') o.paidDate = today;
    DB.set('orders', orders);
    
    const notifs = DB.get('notifications');
    notifs.unshift({
      id: 'n' + Date.now(), userId: o.userId,
      title: `Order ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      message: `Your order ${o.orderNumber} is now ${newStatus}`,
      type: 'tracking', time: 'Just now', read: false, icon: '📦'
    });
    DB.set('notifications', notifs);
    
    showToast(`Order status advanced to: ${newStatus}`, 'success');
    renderAdminContent();
  } else {
    showToast('Order already at final status', 'error');
  }
}

function renderAdminClaims(content) {
  const claims = DB.get('claims').slice().reverse();
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Missing Cashback Claims</h2></div><div style="color: var(--gray);">Total: ${claims.length}</div></div>
    <div class="table-container"><table>
      <thead><tr><th>Claim ID</th><th>User</th><th>Store</th><th>Order</th><th>Amount</th><th>Expected CB</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${claims.map(c => {
        const u = DB.get('users').find(x => x.id === c.userId);
        const s = DB.get('stores').find(x => x.id === c.storeId);
        return `<tr>
          <td>${c.id}</td>
          <td>${u ? u.name : 'User'}</td>
          <td>${s ? s.name : 'Store'}</td>
          <td style="font-size: 12px;">${c.orderNumber}</td>
          <td>₹${c.orderAmount}</td>
          <td><strong style="color: var(--primary);">₹${c.expectedCashback}</strong></td>
          <td><span class="status-badge status-${c.status === 'investigating' ? 'processing' : c.status}">${c.status}</span></td>
          <td>
            ${c.status === 'pending' ? `<button class="action-btn view" onclick="updateClaimStatus('${c.id}', 'investigating')">Investigate</button>` : ''}
            ${c.status === 'investigating' ? `<button class="action-btn approve" onclick="approveClaim('${c.id}')">Approve</button><button class="action-btn reject" onclick="rejectClaim('${c.id}')">Reject</button>` : ''}
            ${['approved', 'rejected'].includes(c.status) ? '<span style="color: var(--gray);">Resolved</span>' : ''}
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  `;
}

function updateClaimStatus(id, status) {
  const claims = DB.get('claims');
  const c = claims.find(x => x.id === id);
  if (c) c.status = status;
  DB.set('claims', claims);
  showToast('Status updated', 'success');
  renderAdminContent();
}

function approveClaim(id) {
  const claims = DB.get('claims');
  const c = claims.find(x => x.id === id);
  if (!c) return;
  c.status = 'approved';
  DB.set('claims', claims);
  const users = DB.get('users');
  const u = users.find(x => x.id === c.userId);
  if (u) { u.wallet += c.expectedCashback; u.totalEarned = (u.totalEarned || 0) + c.expectedCashback; DB.set('users', users); }
  showToast('Claim approved! Cashback credited.', 'success');
  renderAdminContent();
}

function rejectClaim(id) {
  const claims = DB.get('claims');
  const c = claims.find(x => x.id === id);
  if (c) c.status = 'rejected';
  DB.set('claims', claims);
  showToast('Claim rejected', 'success');
  renderAdminContent();
}

function renderAdminWithdrawals(content) {
  const withdrawals = DB.get('withdrawals').slice().reverse();
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Withdrawals Management</h2></div></div>
    <div class="table-container"><table>
      <thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Method</th><th>Details</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>${withdrawals.map(w => {
        const user = DB.get('users').find(u => u.id === w.userId);
        return `<tr>
          <td>${w.date}</td>
          <td><strong>${user ? user.name : 'User'}</strong><br><small style="color: var(--gray);">${user ? user.email : ''}</small></td>
          <td><strong style="color: var(--primary);">₹${w.amount}</strong></td>
          <td>${w.method}</td>
          <td>${w.details}</td>
          <td><span class="status-badge status-${w.status}">${w.status}</span></td>
          <td>${w.status === 'pending' ? `<button class="action-btn approve" onclick="approveWithdrawal('${w.id}')">Approve</button><button class="action-btn reject" onclick="rejectWithdrawal('${w.id}')">Reject</button>` : '-'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  `;
}

function approveWithdrawal(id) {
  const withdrawals = DB.get('withdrawals');
  const w = withdrawals.find(x => x.id === id);
  w.status = 'approved';
  DB.set('withdrawals', withdrawals);
  showToast('Withdrawal approved!', 'success');
  renderAdminContent();
}

function rejectWithdrawal(id) {
  const withdrawals = DB.get('withdrawals');
  const w = withdrawals.find(x => x.id === id);
  w.status = 'rejected';
  DB.set('withdrawals', withdrawals);
  const users = DB.get('users');
  const u = users.find(x => x.id === w.userId);
  if (u) { u.wallet += w.amount; DB.set('users', users); }
  showToast('Withdrawal rejected. Amount refunded.', 'success');
  renderAdminContent();
}

function renderAdminReports(content) {
  const orders = DB.get('orders');
  const users = DB.get('users').filter(u => !u.isAdmin);
  const byStore = {};
  orders.forEach(o => {
    const store = DB.get('stores').find(s => s.id === o.storeId);
    if (store) byStore[store.name] = (byStore[store.name] || 0) + o.cashbackAmount;
  });
  const topStores = Object.entries(byStore).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxAmount = topStores[0] ? topStores[0][1] : 1;
  const totalCashback = orders.filter(o => ['confirmed', 'paid'].includes(o.status)).reduce((s, o) => s + o.cashbackAmount, 0);
  
  content.innerHTML = `
    <div class="dashboard-header"><div><h2>Reports & Analytics</h2></div></div>
    <div class="stats-grid">
      <div class="stat-card"><h4>Total Users</h4><div class="value">${users.length}</div></div>
      <div class="stat-card orange"><h4>Total Cashback</h4><div class="value">₹${totalCashback}</div></div>
      <div class="stat-card blue"><h4>Avg per User</h4><div class="value">₹${users.length ? Math.round(totalCashback / users.length) : 0}</div></div>
      <div class="stat-card purple"><h4>Total Orders</h4><div class="value">${orders.length}</div></div>
    </div>
    <div class="chart-container">
      <div class="chart-title">Top Stores by Cashback Paid</div>
      ${topStores.length === 0 ? '<p style="text-align: center; color: var(--gray); padding: 20px;">No data yet</p>' : `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          ${topStores.map(([name, amount]) => `<div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;"><strong>${name}</strong><span style="color: var(--primary); font-weight: 700;">₹${amount}</span></div>
            <div style="background: var(--light-gray); height: 10px; border-radius: 5px; overflow: hidden;"><div style="background: linear-gradient(90deg, var(--primary), #60a5fa); height: 100%; width: ${(amount/maxAmount)*100}%;"></div></div>
          </div>`).join('')}
        </div>
      `}
    </div>
    <div class="grid-2">
      <div class="chart-container">
        <div class="chart-title">Order Status Distribution</div>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${['pending', 'tracking', 'verified', 'confirmed', 'paid', 'disputed'].map(s => `
            <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--light-gray); border-radius: 10px;">
              <span style="text-transform: capitalize;">${s}</span>
              <strong>${orders.filter(o => o.status === s).length}</strong>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="chart-container">
        <div class="chart-title">Category Distribution</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${['shopping', 'fashion', 'electronics', 'food', 'travel', 'health', 'beauty', 'grocery', 'recharge'].map(cat => {
            const count = DB.get('deals').filter(d => d.cat === cat).length;
            return `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--light-gray);"><span style="text-transform: capitalize;">${cat}</span><strong>${count} deals</strong></div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// Main app - navigation, auth, init, content pages
let currentAuthMode = 'login';

// Initialize — hydrate caches from the backend, then render.
DB.init();
initCarousel();
startFlashTimer();
(async () => {
  try {
    await IOApi.hydrate();
  } catch (err) {
    console.error('[Init] API hydration failed (rendering cached data):', err.message);
  }
  renderHome();
  renderBlog();
  renderHelp();
  renderContentPages();
  updateAuthUI();
  if (typeof initSEORouting === 'function') initSEORouting();
})();

document.getElementById('searchInput').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  if (q.length > 0) { navigate('deals'); renderAllDeals(q); }
});

// Navigation
function navigate(view, pushState) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  const authRequired = ['dashboard', 'cashbacks', 'wallet', 'favorites', 'referrals', 'profile', 'tracking', 'missing-cashback'];
  if (authRequired.includes(view) && !requireAuth()) return;
  
  if (view === 'dashboard') renderDashboard();
  if (view === 'cashbacks') renderCashbacks();
  if (view === 'wallet') renderWallet();
  if (view === 'favorites') renderFavorites();
  if (view === 'referrals') renderReferrals();
  if (view === 'profile') renderProfile();
  if (view === 'tracking') renderTracking();
  if (view === 'missing-cashback') renderMissingCashback();
  if (view === 'top-earners') renderTopEarners();
  if (view === 'admin' && !requireAdmin()) return;
  if (view === 'admin') renderAdmin();
  if (view === 'stores') renderStores();
  if (view === 'deals') renderAllDeals();
  if (view === 'auth') renderAuthForm();
  
  if (authRequired.includes(view)) updateSidebar();
  
  const dd = document.getElementById('userDropdown');
  if (dd) dd.classList.remove('active');
  const np = document.getElementById('notifPanel');
  if (np) np.classList.remove('active');

  // SEO: update <title>, meta description, canonical and push URL into history
  if (typeof updateSEOForView === 'function') updateSEOForView(view);
  if (pushState !== false && window.history && window.history.pushState) {
    const path = view === 'home' ? '/' : '/' + view;
    if (location.pathname !== path) window.history.pushState({ view }, '', path);
  }
}

function requireAuth() {
  if (!DB.getCurrentUser()) { showToast('Please login to continue', 'error'); navigate('auth'); return false; }
  return true;
}
function requireAdmin() {
  const user = DB.getCurrentUser();
  if (!user) { navigate('auth'); return false; }
  if (!user.isAdmin) { showToast('Admin access required', 'error'); navigate('dashboard'); return false; }
  return true;
}

// Auth
function openAuth(mode) { currentAuthMode = mode; navigate('auth'); }

function switchAuthTab(mode, e) {
  currentAuthMode = mode;
  document.querySelectorAll('#view-auth .auth-tab').forEach(t => t.classList.remove('active'));
  if (e && e.target) e.target.classList.add('active');
  renderAuthForm();
}

function renderAuthForm() {
  const title = document.getElementById('authTitle');
  const subtitle = document.getElementById('authSubtitle');
  const form = document.getElementById('authForm');
  
  if (currentAuthMode === 'login') {
    title.textContent = 'Welcome Back!';
    subtitle.textContent = 'Login to access your cashback wallet';
    form.innerHTML = `
      <div class="form-group"><label>Email or Phone</label><input type="text" id="loginEmail" placeholder="Enter email or phone"></div>
      <div class="form-group"><label>Password</label><input type="password" id="loginPassword" placeholder="Enter password"></div>
      <button class="submit-btn" onclick="handleLogin()">Login</button>
      <p style="text-align: center; margin-top: 16px; font-size: 13px;"><a style="color: var(--primary);" onclick="showToast('Password reset link sent!')">Forgot Password?</a></p>
    `;
    document.querySelectorAll('#view-auth .auth-tab')[0].classList.add('active');
    document.querySelectorAll('#view-auth .auth-tab')[1].classList.remove('active');
  } else {
    title.textContent = 'Create Account';
    subtitle.textContent = 'Join and start earning cashback today!';
    form.innerHTML = `
      <div class="form-group"><label>Full Name</label><input type="text" id="signupName" placeholder="Enter your name"></div>
      <div class="form-group"><label>Email</label><input type="email" id="signupEmail" placeholder="Enter email"></div>
      <div class="form-group"><label>Phone</label><input type="tel" id="signupPhone" placeholder="Enter phone number"></div>
      <div class="form-group"><label>Password</label><input type="password" id="signupPassword" placeholder="Create password (min 6 chars)"></div>
      <div class="form-group"><label>Referral Code (Optional)</label><input type="text" id="signupReferral" placeholder="Enter referral code"></div>
      <button class="submit-btn" onclick="handleSignup()">Create Account</button>
      <p style="text-align: center; margin-top: 16px; font-size: 12px; color: var(--gray);">By signing up, you agree to our Terms & Privacy Policy</p>
    `;
    document.querySelectorAll('#view-auth .auth-tab')[0].classList.remove('active');
    document.querySelectorAll('#view-auth .auth-tab')[1].classList.add('active');
  }
}

function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if (!email || !password) { showToast('Please fill all fields', 'error'); return; }
  const users = DB.get('users');
  const user = users.find(u => (u.email === email || u.phone === email) && u.password === password);
  if (!user) { showToast('Invalid credentials', 'error'); return; }
  DB.setCurrentUser(user.id);
  updateAuthUI();
  showToast(`Welcome back, ${user.name}!`, 'success');
  setTimeout(() => navigate('dashboard'), 800);
}

function handleSignup() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const referral = document.getElementById('signupReferral').value.trim();
  
  if (!name || !email || !phone || !password) { showToast('Please fill all required fields', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
  
  const users = DB.get('users');
  if (users.find(u => u.email === email)) { showToast('Email already registered', 'error'); return; }
  
  const newUser = {
    id: 'u' + Date.now(), name, email, phone, password,
    wallet: 100, joined: new Date().toISOString().split('T')[0],
    referrals: 0, isAdmin: false, totalEarned: 0,
    referralCode: name.substring(0, 3).toUpperCase() + Math.floor(Math.random() * 9000 + 1000)
  };
  users.push(newUser);
  
  if (referral) {
    const referrer = users.find(u => u.referralCode === referral);
    if (referrer) {
      referrer.wallet += 100; referrer.referrals += 1;
      const referrals = DB.get('referrals');
      referrals.push({ id: 'r' + Date.now(), referrerId: referrer.id, referredId: newUser.id, bonus: 100, date: new Date().toISOString().split('T')[0] });
      DB.set('referrals', referrals);
      newUser.wallet += 100;
    }
  }
  DB.set('users', users);
  DB.setCurrentUser(newUser.id);
  updateAuthUI();
  showToast('🎉 Account created! ₹100 welcome bonus added.', 'success');
  setTimeout(() => navigate('dashboard'), 800);
}

function logout() {
  DB.setCurrentUser(null);
  updateAuthUI();
  showToast('Logged out successfully');
  navigate('home');
}

function updateAuthUI() {
  const user = DB.getCurrentUser();
  const authBtns = document.getElementById('authButtons');
  const userArea = document.getElementById('userArea');
  if (user) {
    authBtns.style.display = 'none';
    userArea.style.display = 'flex';
    document.getElementById('walletBalance').textContent = user.wallet;
    document.getElementById('userAvatar').textContent = user.name.charAt(0).toUpperCase();
    document.getElementById('dropdownName').textContent = user.name;
    document.getElementById('dropdownEmail').textContent = user.email;
    document.getElementById('adminLink').style.display = user.isAdmin ? 'flex' : 'none';
    updateNotifCount();
  } else {
    authBtns.style.display = 'flex';
    userArea.style.display = 'none';
  }
}

function toggleUserMenu(e) {
  e.stopPropagation();
  document.getElementById('userDropdown').classList.toggle('active');
  document.getElementById('notifPanel').classList.remove('active');
}

function toggleNotifPanel(e) {
  e.stopPropagation();
  renderNotifications();
  document.getElementById('notifPanel').classList.toggle('active');
  document.getElementById('userDropdown').classList.remove('active');
}

function updateNotifCount() {
  const user = DB.getCurrentUser();
  if (!user) return;
  const unread = DB.get('notifications').filter(n => n.userId === user.id && !n.read).length;
  document.getElementById('notifCount').textContent = unread;
  document.getElementById('notifCount').style.display = unread > 0 ? 'block' : 'none';
}

function renderNotifications() {
  const user = DB.getCurrentUser();
  if (!user) return;
  const notifs = DB.get('notifications').filter(n => n.userId === user.id);
  const panel = document.getElementById('notifPanel');
  panel.innerHTML = `
    <div class="notif-header">
      <h4>Notifications</h4>
      <a style="color: var(--primary); font-size: 12px;" onclick="markAllRead(event)">Mark all read</a>
    </div>
    ${notifs.length === 0 ? '<div style="padding: 40px; text-align: center; color: var(--gray);">No notifications</div>' :
    notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
        <div class="notif-icon">${n.icon}</div>
        <div class="notif-content">
          <h5>${n.title}</h5>
          <p>${n.message}</p>
          <div class="notif-time">${n.time}</div>
        </div>
      </div>
    `).join('')}
  `;
}

function markNotifRead(id) {
  const notifs = DB.get('notifications');
  const n = notifs.find(x => x.id === id);
  if (n) n.read = true;
  DB.set('notifications', notifs);
  updateNotifCount();
  renderNotifications();
}

function markAllRead(e) {
  e.stopPropagation();
  const user = DB.getCurrentUser();
  const notifs = DB.get('notifications');
  notifs.forEach(n => { if (n.userId === user.id) n.read = true; });
  DB.set('notifications', notifs);
  updateNotifCount();
  renderNotifications();
}

// Sidebar
function buildSidebar(active) {
  const user = DB.getCurrentUser();
  if (!user) return '';
  const items = [
    { id: 'dashboard', icon: '📊', label: 'Overview' },
    { id: 'tracking', icon: '📦', label: 'Track Orders' },
    { id: 'cashbacks', icon: '🎁', label: 'Cashback History' },
    { id: 'wallet', icon: '💰', label: 'My Wallet' },
    { id: 'favorites', icon: '❤️', label: 'Favorites' },
    { id: 'referrals', icon: '👥', label: 'Refer & Earn' },
    { id: 'missing-cashback', icon: '🔍', label: 'Missing Cashback' },
    { id: 'profile', icon: '👤', label: 'Profile' },
  ];
  return `
    <div class="sidebar-user">
      <div class="sidebar-avatar">${user.name.charAt(0).toUpperCase()}</div>
      <h3>${user.name}</h3><p>${user.email}</p>
    </div>
    <nav class="sidebar-nav">
      ${items.map(i => `<a class="${active === i.id ? 'active' : ''}" onclick="navigate('${i.id}')"><span class="icon">${i.icon}</span> ${i.label}</a>`).join('')}
      <a onclick="logout()"><span class="icon">🚪</span> Logout</a>
    </nav>
  `;
}

function updateSidebar() {
  const user = DB.getCurrentUser();
  if (!user) return;
  ['Dashboard', 'Cashbacks', 'Wallet', 'Favorites', 'Referrals', 'Profile'].forEach(name => {
    const sb = document.getElementById('sidebar' + name);
    if (sb) sb.innerHTML = buildSidebar(name.toLowerCase());
  });
}

// Blog
function renderBlog() {
  const blogs = DB.get('blogs');
  document.getElementById('blogGrid').innerHTML = blogs.map(b => `
    <div class="blog-card" onclick="openBlog('${b.id}')">
      <div class="blog-image" style="background-image: url('${b.image}')"></div>
      <div class="blog-body">
        <div class="blog-meta"><span>📁 ${b.category}</span><span>📅 ${b.date}</span><span>⏱️ ${b.readTime}</span></div>
        <h3>${b.title}</h3><p>${b.excerpt}</p>
      </div>
    </div>
  `).join('');
}

function openBlog(id) {
  const blog = DB.get('blogs').find(b => b.id === id);
  if (!blog) return;
  document.getElementById('dealModalContent').innerHTML = `
    <div style="margin-bottom: 16px;"><span class="status-badge status-processing">${blog.category}</span><span style="color: var(--gray); font-size: 12px; margin-left: 8px;">📅 ${blog.date} • ⏱️ ${blog.readTime} read</span></div>
    <h2 style="margin-bottom: 16px;">${blog.title}</h2>
    <div style="height: 250px; background-image: url('${blog.image}'); background-size: cover; background-position: center; border-radius: 12px; margin-bottom: 20px;"></div>
    <p style="line-height: 1.8; color: #374151; margin-bottom: 16px;">${blog.excerpt}</p>
    <p style="line-height: 1.8; color: #374151; margin-bottom: 16px;">Online shopping has become an integral part of our lives. With so many options available, it's important to shop smart and save money wherever possible.</p>
    <p style="line-height: 1.8; color: #374151;">Start saving today by browsing our latest deals and coupons!</p>
  `;
  document.getElementById('dealModal').classList.add('active');
}

// Help
function renderHelp() {
  const faqs = DB.get('faqs');
  document.getElementById('faqList').innerHTML = faqs.map((f, i) => `
    <div class="faq-item" onclick="toggleFaq(${i})">
      <div class="faq-question"><span>${f.q}</span><span class="faq-toggle">+</span></div>
      <div class="faq-answer">${f.a}</div>
    </div>
  `).join('');
}

// Content Pages
function renderContentPages() {
  document.getElementById('aboutContent').innerHTML = `
    <h1>About IndiaOffers.in</h1>
    <p>India's leading cashback and coupons platform, helping millions save money since 2024.</p>
    <h2>Our Mission</h2>
    <p>To make online shopping more affordable for every Indian by sharing store commissions directly with our users as cashback.</p>
    <h2>What We Offer</h2>
    <ul>
      <li>Cashback from 2000+ top stores</li>
      <li>Real-time order tracking with 5-stage verification</li>
      <li>Exclusive coupons and deals</li>
      <li>Easy withdrawals to bank, UPI, or Paytm</li>
      <li>Refer & Earn program</li>
      <li>Browser extension for automatic coupons</li>
    </ul>
    <h2>Our Numbers</h2>
    <div class="stats-grid" style="margin: 20px 0;">
      <div class="stat-card"><h4>Happy Users</h4><div class="value">50L+</div></div>
      <div class="stat-card orange"><h4>Cashback Paid</h4><div class="value">₹100Cr+</div></div>
      <div class="stat-card blue"><h4>Partner Stores</h4><div class="value">2000+</div></div>
      <div class="stat-card purple"><h4>Years of Trust</h4><div class="value">2+</div></div>
    </div>
  `;
  
  document.getElementById('careersContent').innerHTML = `
    <h1>Careers at IndiaOffers</h1>
    <p>Join India's fastest-growing cashback platform!</p>
    <h2>Current Openings</h2>
    <div style="display: grid; gap: 16px; margin: 20px 0;">
      ${[
        { role: 'Senior Frontend Engineer', loc: 'Bangalore', type: 'Full-time' },
        { role: 'Backend Developer (Node.js)', loc: 'Mumbai', type: 'Full-time' },
        { role: 'Product Manager', loc: 'Delhi', type: 'Full-time' },
        { role: 'Digital Marketing Specialist', loc: 'Remote', type: 'Full-time' },
      ].map(j => `<div style="padding: 20px; background: var(--light-gray); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div><h3 style="margin-bottom: 4px;">${j.role}</h3><p style="color: var(--gray); font-size: 14px;">📍 ${j.loc} • 💼 ${j.type}</p></div>
        <button class="btn btn-primary btn-sm" onclick="showToast('Application form coming soon!')">Apply Now</button>
      </div>`).join('')}
    </div>
  `;
  
  document.getElementById('pressContent').innerHTML = `
    <h1>Press & Media</h1>
    <h2>Recent Coverage</h2>
    <div style="display: grid; gap: 16px; margin: 20px 0;">
      ${[
        { src: 'Economic Times', title: 'IndiaOffers crosses 50 lakh users milestone', date: 'June 2026' },
        { src: 'YourStory', title: 'How IndiaOffers is revolutionizing cashback', date: 'May 2026' },
        { src: 'Inc42', title: 'IndiaOffers raises $10M in Series A', date: 'April 2026' },
      ].map(a => `<div style="padding: 20px; background: var(--light-gray); border-radius: 12px;">
        <div style="font-size: 12px; color: var(--primary); font-weight: 700; margin-bottom: 4px;">${a.src} • ${a.date}</div>
        <h3>${a.title}</h3>
      </div>`).join('')}
    </div>
    <p>Media Contact: press@indiaoffers.in</p>
  `;
  
  document.getElementById('partnerContent').innerHTML = `
    <h1>Partner With IndiaOffers</h1>
    <p>Join 2000+ brands driving sales through IndiaOffers</p>
    <h2>Why Partner With Us?</h2>
    <ul>
      <li>Access to 50 lakh+ active shoppers</li>
      <li>Performance-based marketing</li>
      <li>Advanced tracking and analytics</li>
      <li>Dedicated account manager</li>
    </ul>
    <div class="stats-grid" style="margin: 20px 0;">
      <div class="stat-card"><h4>Active Partners</h4><div class="value">2000+</div></div>
      <div class="stat-card orange"><h4>Monthly Orders</h4><div class="value">10L+</div></div>
      <div class="stat-card blue"><h4>Conversion Rate</h4><div class="value">8.5%</div></div>
    </div>
  `;
  
  document.getElementById('termsContent').innerHTML = `
    <h1>Terms of Service</h1>
    <p><em>Last updated: June 29, 2026</em></p>
    <h2>1. Acceptance of Terms</h2>
    <p>By accessing IndiaOffers.in, you agree to be bound by these Terms.</p>
    <h2>2. Eligibility</h2>
    <p>You must be at least 18 years old and a resident of India.</p>
    <h2>3. Cashback Program</h2>
    <ul>
      <li>Cashback is subject to store partner terms</li>
      <li>Cashback is credited after store's return period (30-60 days)</li>
      <li>Minimum withdrawal amount is ₹250</li>
      <li>Fraudulent activity will result in account termination</li>
    </ul>
    <h2>4. Contact</h2>
    <p>legal@indiaoffers.in</p>
  `;
  
  document.getElementById('privacyContent').innerHTML = `
    <h1>Privacy Policy</h1>
    <p><em>Last updated: June 29, 2026</em></p>
    <h2>Information We Collect</h2>
    <p>We collect name, email, phone, bank/UPI details for withdrawals.</p>
    <h2>How We Use Your Information</h2>
    <ul>
      <li>Process cashback and withdrawals</li>
      <li>Track your orders and purchases</li>
      <li>Send notifications about deals</li>
    </ul>
    <h2>Contact</h2>
    <p>privacy@indiaoffers.in</p>
  `;
  
  document.getElementById('cookieContent').innerHTML = `
    <h1>Cookie Policy</h1>
    <p><em>Last updated: June 29, 2026</em></p>
    <h2>Types of Cookies We Use</h2>
    <ul>
      <li><strong>Essential Cookies:</strong> Required for website functionality</li>
      <li><strong>Analytics Cookies:</strong> Help us understand usage</li>
      <li><strong>Tracking Cookies:</strong> Track cashback-eligible purchases</li>
    </ul>
  `;
  
  document.getElementById('refundContent').innerHTML = `
    <h1>Refund & Cancellation Policy</h1>
    <p><em>Last updated: June 29, 2026</em></p>
    <h2>Cashback Refunds</h2>
    <p>Submit missing cashback claim within 7 days of purchase.</p>
    <h2>Processing Times</h2>
    <ul>
      <li>Withdrawals: 24-48 hours after approval</li>
      <li>Missing cashback investigation: 7 business days</li>
      <li>Dispute resolution: 7-14 business days</li>
    </ul>
  `;
  
  document.getElementById('contactContent').innerHTML = `
    <h1>Contact Us</h1>
    <div class="grid-2" style="margin: 30px 0;">
      <div>
        <h2>Get in Touch</h2>
        <div style="background: var(--light-gray); padding: 24px; border-radius: 12px;">
          <div class="form-group"><label>Your Name</label><input type="text" placeholder="Enter your name"></div>
          <div class="form-group"><label>Email</label><input type="email" placeholder="Enter your email"></div>
          <div class="form-group"><label>Message</label><textarea rows="5" placeholder="How can we help?"></textarea></div>
          <button class="btn btn-primary btn-lg" onclick="showToast('Message sent!', 'success')">Send Message</button>
        </div>
      </div>
      <div>
        <h2>Contact Information</h2>
        <div style="display: grid; gap: 16px; margin-top: 20px;">
          <div style="padding: 20px; background: var(--light-gray); border-radius: 12px;">
            <h3>📧 Email</h3><p>support@indiaoffers.in</p>
          </div>
          <div style="padding: 20px; background: var(--light-gray); border-radius: 12px;">
            <h3>📞 Phone</h3><p>1800-123-4567 (Toll Free)</p>
          </div>
          <div style="padding: 20px; background: var(--light-gray); border-radius: 12px;">
            <h3>🏢 Head Office</h3>
            <p>IndiaOffers Technologies Pvt Ltd</p>
            <p>WeWork BKC, Mumbai 400051</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('sitemapContent').innerHTML = `
    <h1>Sitemap</h1>
    <div class="grid-3" style="margin-top: 30px;">
      <div>
        <h2>Main Pages</h2>
        <ul>
          <li><a onclick="navigate('home')">Home</a></li>
          <li><a onclick="navigate('stores')">All Stores</a></li>
          <li><a onclick="navigate('deals')">All Deals</a></li>
          <li><a onclick="navigate('top-earners')">Top Earners</a></li>
          <li><a onclick="navigate('blog')">Blog</a></li>
          <li><a onclick="navigate('help')">Help Center</a></li>
        </ul>
      </div>
      <div>
        <h2>Account</h2>
        <ul>
          <li><a onclick="navigate('dashboard')">Dashboard</a></li>
          <li><a onclick="navigate('tracking')">Track Orders</a></li>
          <li><a onclick="navigate('cashbacks')">Cashback History</a></li>
          <li><a onclick="navigate('wallet')">My Wallet</a></li>
          <li><a onclick="navigate('favorites')">Favorites</a></li>
          <li><a onclick="navigate('referrals')">Refer & Earn</a></li>
          <li><a onclick="navigate('profile')">Profile</a></li>
        </ul>
      </div>
      <div>
        <h2>Company</h2>
        <ul>
          <li><a onclick="navigate('about')">About Us</a></li>
          <li><a onclick="navigate('careers')">Careers</a></li>
          <li><a onclick="navigate('press')">Press & Media</a></li>
          <li><a onclick="navigate('partner')">Partner With Us</a></li>
          <li><a onclick="navigate('contact')">Contact Us</a></li>
        </ul>
        <h2 style="margin-top: 20px;">Legal</h2>
        <ul>
          <li><a onclick="navigate('terms')">Terms of Service</a></li>
          <li><a onclick="navigate('privacy')">Privacy Policy</a></li>
          <li><a onclick="navigate('cookie')">Cookie Policy</a></li>
          <li><a onclick="navigate('refund')">Refund Policy</a></li>
        </ul>
      </div>
    </div>
  `;
}

