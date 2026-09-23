// Thin client for Supabase Auth (GoTrue), PostgREST and Storage over fetch. No SDK: the whole
// app must open instantly on a cheap phone, and every rule lives in the database anyway.
const SESSION_KEY = 'pacelam.session';

export function createSupabaseApi(cfg) {
  const base = String(cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  const anon = cfg.SUPABASE_ANON_KEY;
  const bucket = cfg.PHOTO_BUCKET || 'photos';
  let session = readSession();
  const listeners = new Set();

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
  }
  function writeSession(next) {
    session = next;
    if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next)); else localStorage.removeItem(SESSION_KEY);
    listeners.forEach((fn) => fn(session));
  }
  function apiError(data, status) {
    const msg = data?.message || data?.msg || data?.error_description || data?.error || data?.hint || `HTTP ${status}`;
    const err = new Error(msg);
    err.status = status;
    err.code = data?.code || data?.error_code || null;
    return err;
  }
  async function authRequest(path, body, withToken = false) {
    const res = await fetch(`${base}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json', ...(withToken && session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify(body || {}),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw apiError(data, res.status);
    return data;
  }
  function storeTokens(data) {
    if (!data?.access_token) return null;
    const next = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at ? data.expires_at * 1000 : Date.now() + (data.expires_in || 3600) * 1000,
      user: { id: data.user?.id, email: data.user?.email },
    };
    writeSession(next);
    return next;
  }
  let refreshing = null;
  async function ensureFresh() {
    if (!session) return;
    if (session.expires_at - Date.now() > 60000) return;
    refreshing = refreshing || (async () => {
      try {
        const data = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
        storeTokens(data);
      } catch (e) {
        if (e.status === 400 || e.status === 401) writeSession(null);
        throw e;
      } finally { refreshing = null; }
    })();
    await refreshing;
  }
  async function rest(path, { method = 'GET', body, prefer, headers = {} } = {}) {
    await ensureFresh();
    const res = await fetch(`${base}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: anon,
        Authorization: `Bearer ${session?.access_token || anon}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(prefer ? { Prefer: prefer } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && session) { writeSession(null); }
    if (res.status === 204) return null;
    const data = await res.json().catch(() => null);
    if (!res.ok) throw apiError(data, res.status);
    return data;
  }
  const rpc = (fn, args) => rest(`rpc/${fn}`, { method: 'POST', body: args || {} });
  const one = (rows) => (Array.isArray(rows) ? rows[0] || null : rows);
  const uid = () => session?.user?.id || null;
  const today = () => new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  return {
    mode: 'supabase',
    onAuth: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    getSession: () => session,
    userId: uid,
    photoUrl: (path) => (/^(data:|https?:)/.test(path) ? path : `${base}/storage/v1/object/public/${bucket}/${path}`),

    // ---- auth ----
    async signUp(email, password, lang) {
      const data = await authRequest('signup', { email, password, data: { lang } });
      const s = storeTokens(data);
      return { session: s, needsConfirmation: !s };
    },
    async signIn(email, password) {
      const data = await authRequest('token?grant_type=password', { email, password });
      return storeTokens(data);
    },
    async signOut() {
      try { if (session) await authRequest('logout', {}, true); } catch { /* local sign-out anyway */ }
      writeSession(null);
    },
    resetPassword: (email) => authRequest('recover', { email }),

    // ---- reference ----
    getVehicleTypes: () => rest('vehicle_types?select=*&order=sort'),
    getVehicleGroups: () => rest('vehicle_groups?select=*&order=sort'),
    getCargoTypes: () => rest('cargo_types?select=*&is_active=eq.true&order=sort'),

    // ---- profile ----
    async getMe() {
      const id = uid();
      if (!id) return null;
      const [profile, contacts, vehicles] = await Promise.all([
        rest(`profiles?id=eq.${id}&select=*`).then(one),
        rest(`profile_contacts?profile_id=eq.${id}&select=*`).then(one),
        rest(`vehicles?owner_id=eq.${id}&select=*&order=is_default.desc,created_at`),
      ]);
      return { profile, contacts, vehicles: vehicles || [] };
    },
    saveProfile: (p) => rest('profiles', { method: 'POST', body: { ...p, id: uid() }, prefer: 'resolution=merge-duplicates,return=representation' }).then(one),
    saveContacts: (c) => rest('profile_contacts', { method: 'POST', body: { ...c, profile_id: uid() }, prefer: 'resolution=merge-duplicates,return=representation' }).then(one),
    addVehicle: (v) => rest('vehicles', { method: 'POST', body: { ...v, owner_id: uid() }, prefer: 'return=representation' }).then(one),
    updateVehicle: (id, v) => rest(`vehicles?id=eq.${id}`, { method: 'PATCH', body: v, prefer: 'return=representation' }).then(one),
    deleteVehicle: (id) => rest(`vehicles?id=eq.${id}`, { method: 'DELETE' }),
    setDefaultVehicle: async (id) => {
      await rest(`vehicles?owner_id=eq.${uid()}`, { method: 'PATCH', body: { is_default: false } });
      await rest(`vehicles?id=eq.${id}`, { method: 'PATCH', body: { is_default: true } });
    },
    getContacts: (ownerId) => rest(`profile_contacts?profile_id=eq.${ownerId}&select=*`).then(one),

    // ---- postings ----
    listPostings: () => rest(`postings?select=*,owner:profiles!postings_owner_id_fkey(id,display_name,city_name)&status=in.(open,pending)&date_to=gte.${today()}&order=created_at.desc&limit=150`),
    getPosting: async (id) => {
      const posting = await rest(`postings?id=eq.${id}&select=*,owner:profiles!postings_owner_id_fkey(id,display_name,city_name)`).then(one);
      if (!posting) return null;
      const me = uid();
      const [bids, deal] = me ? await Promise.all([
        rest(`bids?posting_id=eq.${id}&select=*,bidder:profiles!bids_bidder_id_fkey(id,display_name,city_name)&order=amount.asc`),
        rest(`deals?posting_id=eq.${id}&select=*`).then(one),
      ]) : [[], null];
      return { posting, bids: bids || [], deal };
    },
    createPosting: (p) => rest('postings', { method: 'POST', body: { ...p, owner_id: uid() }, prefer: 'return=representation' }).then(one),
    updatePosting: (id, p) => rest(`postings?id=eq.${id}`, { method: 'PATCH', body: p, prefer: 'return=representation' }).then(one),
    myPostings: () => rest(`postings?owner_id=eq.${uid()}&select=*,owner:profiles!postings_owner_id_fkey(id,display_name,city_name)&order=created_at.desc`),
    myBids: () => rest(`bids?bidder_id=eq.${uid()}&select=*,posting:postings!bids_posting_id_fkey(*,owner:profiles!postings_owner_id_fkey(id,display_name,city_name))&order=created_at.desc`),
    myDeals: () => rest(`deals?or=(customer_id.eq.${uid()},carrier_id.eq.${uid()})&select=*,posting:postings!deals_posting_id_fkey(*,owner:profiles!postings_owner_id_fkey(id,display_name,city_name))&order=created_at.desc`),
    closePosting: (id) => rpc('close_posting', { p_posting: id }),

    // ---- bids and deals (database functions) ----
    placeBid: (postingId, amount, note) => rpc('place_bid', { p_posting: postingId, p_amount: amount, p_note: note || null }),
    nudgeTruck: (cargoId, truckId) => rpc('nudge_truck', { p_cargo: cargoId, p_truck: truckId }),
    withdrawBid: (bidId) => rpc('withdraw_bid', { p_bid: bidId }),
    acceptBid: (bidId) => rpc('accept_bid', { p_bid: bidId }),
    takePosting: (postingId) => rpc('take_posting', { p_posting: postingId }),
    confirmDeal: (dealId) => rpc('confirm_deal', { p_deal: dealId }),
    cancelDeal: (dealId) => rpc('cancel_deal', { p_deal: dealId }),

    // ---- saved searches ----
    listSearches: () => rest(`saved_searches?owner_id=eq.${uid()}&select=*&order=created_at.desc`),
    saveSearch: (s) => rest('saved_searches', { method: 'POST', body: { ...s, owner_id: uid() }, prefer: 'return=representation' }).then(one),
    deleteSearch: (id) => rest(`saved_searches?id=eq.${id}`, { method: 'DELETE' }),

    // ---- notifications ----
    listNotifications: () => rest(`notifications?user_id=eq.${uid()}&select=*&order=created_at.desc&limit=50`),
    markRead: (ids) => rpc('mark_notifications_read', { p_ids: ids }),

    // ---- storage ----
    async uploadPhoto(blob, path) {
      await ensureFresh();
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST',
        headers: { apikey: anon, Authorization: `Bearer ${session?.access_token || anon}`, 'Content-Type': blob.type || 'image/jpeg', 'x-upsert': 'true' },
        body: blob,
      });
      if (!res.ok) throw apiError(await res.json().catch(() => null), res.status);
      return path;
    },
  };
}
