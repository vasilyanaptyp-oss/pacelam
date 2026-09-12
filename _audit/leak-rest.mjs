// Contact-leak test against a REAL Supabase project, bypassing the UI entirely:
// sign in as user B and query user A's contacts through the REST API with B's token.
// Expected: [] from every angle. Requires two existing test accounts.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... USER_A=a@example.com PASS_A=... USER_B=b@example.com PASS_B=... node _audit/leak-rest.mjs
const { SUPABASE_URL, SUPABASE_ANON_KEY, USER_A, PASS_A, USER_B, PASS_B } = process.env;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !USER_A || !USER_B) { console.error('set SUPABASE_URL, SUPABASE_ANON_KEY, USER_A, PASS_A, USER_B, PASS_B'); process.exit(2); }
const base = SUPABASE_URL.replace(/\/+$/, '');
let failures = 0;
const check = (name, ok, detail = '') => { if (!ok) failures++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail && !ok ? ' -- ' + detail : '')); };

async function signIn(email, password) {
  const r = await fetch(`${base}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`sign-in failed for ${email}: ${j.error_description || j.msg || r.status}`);
  return { token: j.access_token, id: j.user.id };
}
async function rest(token, path, init = {}) {
  const r = await fetch(`${base}/rest/v1/${path}`, { ...init, headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json', ...(init.headers || {}) } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

const A = await signIn(USER_A, PASS_A);
const B = await signIn(USER_B, PASS_B);
console.log('A =', A.id, '\nB =', B.id);

// make sure A has contacts to leak
await rest(A.token, 'profile_contacts', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ profile_id: A.id, phone: '+371 29999999', email: USER_A }) });
const own = await rest(A.token, `profile_contacts?profile_id=eq.${A.id}&select=phone`);
check('A can read own contacts', own.status === 200 && own.body.length === 1 && own.body[0].phone === '+371 29999999', JSON.stringify(own));

// B tries every angle
const r1 = await rest(B.token, `profile_contacts?profile_id=eq.${A.id}&select=*`);
check(`B selects A's contacts by id -> ${JSON.stringify(r1.body)}`, r1.status === 200 && Array.isArray(r1.body) && r1.body.length === 0);
const r2 = await rest(B.token, 'profile_contacts?select=*');
check(`B selects the whole contacts table -> ${Array.isArray(r2.body) ? r2.body.length + ' rows' : r2.status}`, r2.status === 200 && r2.body.every((row) => row.profile_id === B.id));
const r3 = await rest(B.token, `profiles?id=eq.${A.id}&select=id,display_name,profile_contacts(phone,email)`);
check(`B embeds contacts through profiles -> ${JSON.stringify(r3.body)}`, r3.status === 200 && (!r3.body[0]?.profile_contacts || r3.body[0].profile_contacts === null || (Array.isArray(r3.body[0].profile_contacts) && r3.body[0].profile_contacts.length === 0)));
const r4 = await rest(B.token, `rpc/has_contact_access`, { method: 'POST', body: JSON.stringify({ p_owner: A.id }) });
check(`B asks has_contact_access(A) -> ${JSON.stringify(r4.body)}`, r4.body === false);
const r5 = await rest(B.token, 'contact_unlocks', { method: 'POST', body: JSON.stringify({ viewer_id: B.id, owner_id: A.id }) });
check(`B inserts an unlock row for himself -> HTTP ${r5.status}`, r5.status >= 400);
const r6 = await rest(B.token, `profile_contacts?profile_id=eq.${A.id}`, { method: 'PATCH', body: JSON.stringify({ phone: '+371 1' }), headers: { Prefer: 'return=representation' } });
check(`B updates A's contacts -> HTTP ${r6.status}, rows ${Array.isArray(r6.body) ? r6.body.length : '-'}`, r6.status >= 400 || (Array.isArray(r6.body) && r6.body.length === 0));
const r7 = await rest(null, 'profile_contacts?select=*');
check(`anonymous reads contacts -> HTTP ${r7.status}, ${Array.isArray(r7.body) ? r7.body.length + ' rows' : ''}`, r7.status >= 400 || (Array.isArray(r7.body) && r7.body.length === 0));
const r8 = await rest(B.token, `vehicles?owner_id=eq.${A.id}&select=*`);
check(`B reads A's vehicles (plates) -> ${Array.isArray(r8.body) ? r8.body.length + ' rows' : r8.status}`, r8.status === 200 && r8.body.length === 0);
const r9 = await rest(B.token, `notifications?user_id=eq.${A.id}&select=*`);
check(`B reads A's notifications -> ${Array.isArray(r9.body) ? r9.body.length + ' rows' : r9.status}`, r9.status === 200 && r9.body.length === 0);

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED — contacts of A are invisible to B and to visitors');
process.exit(failures ? 1 : 0);
