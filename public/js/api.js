/**
 * IndiaOffers.in — API client + cache hydration.
 * Loads BEFORE app-original.js.
 *
 * The SPA renders synchronously from localStorage caches (DB.get/set in
 * app-original.js). This module fills those caches from the real backend:
 *   - IOApi.hydrate()   → /api/bootstrap (stores, deals, leaderboard) + /api/user/me
 *   - IOApi.refreshMe() → re-sync the logged-in user's data after any mutation
 * All writes go through IOApi.get/post/put/del with the JWT from localStorage.
 */

'use strict';

const IOApi = {
  base: (typeof window !== 'undefined' && window.IO_API_BASE) || '',

  get token() { return localStorage.getItem('io_token') || ''; },
  setToken(t) {
    if (t) localStorage.setItem('io_token', t);
    else localStorage.removeItem('io_token');
  },

  async request(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    const res = await fetch(this.base + path, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get(path)        { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body || {}); },
  put(path, body)  { return this.request('PUT', path, body || {}); },
  del(path)        { return this.request('DELETE', path); },

  /** Fill public caches; then user caches if a session token exists. */
  async hydrate() {
    const data = await this.get('/api/bootstrap');
    DB.set('stores', data.stores);
    DB.set('deals', data.deals);
    DB.set('banners', data.banners || []);
    DB.set('users', data.leaderboard);
    if (this.token) {
      try {
        await this.refreshMe();
      } catch (err) {
        if (err.status === 401) { this.setToken(null); DB.setCurrentUser(null); }
        else console.error('[IOApi] refreshMe failed:', err.message);
      }
    }
  },

  /** Re-sync everything belonging to the logged-in user. */
  async refreshMe() {
    const me = await this.get('/api/user/me');
    DB.set('orders', me.orders);
    DB.set('claims', me.claims);
    DB.set('withdrawals', me.withdrawals);
    DB.set('favorites', me.favorites);
    DB.set('referrals', me.referrals);
    DB.set('notifications', me.notifications);
    DB.setCurrentUser(me.user);
    return me;
  },

  /** Admin: pull platform-wide data into the same caches the admin views read. */
  async refreshAdmin() {
    const data = await this.get('/api/admin/overview');
    DB.set('users', data.users);
    DB.set('orders', data.orders);
    DB.set('claims', data.claims);
    DB.set('withdrawals', data.withdrawals);
    if (data.banners) DB.set('banners', data.banners);
    return data;
  }
};
