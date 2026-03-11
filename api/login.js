export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const sessionid = await igLogin(username.trim().toLowerCase(), password);
    return res.status(200).json({ success: true, sessionid });
  } catch (e) {
    console.error('Login error:', e.message);
    return res.status(401).json({ error: e.message });
  }
}

async function igLogin(username, password) {
  const IG_BASE = 'https://www.instagram.com';

  const initRes = await fetch(`${IG_BASE}/accounts/login/`, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
  });

  if (!initRes.ok) throw new Error('Tidak bisa terhubung ke Instagram. Coba lagi nanti.');

  const html = await initRes.text();
  const rawCookies = initRes.headers.get('set-cookie') || '';
  const cookieMap = parseCookies(rawCookies);

  let csrftoken = cookieMap['csrftoken'] || '';
  if (!csrftoken) {
    const m = html.match(/"csrf_token":"([^"]+)"/);
    if (m) csrftoken = m[1];
  }
  if (!csrftoken) {
    const m2 = html.match(/csrftoken=([^;,\s"]+)/);
    if (m2) csrftoken = m2[1];
  }

  if (!csrftoken) throw new Error('Gagal mendapatkan token dari Instagram. Instagram mungkin memblokir request ini.');

  const cookieStr = Object.entries(cookieMap).map(([k,v]) => `${k}=${v}`).join('; ');

  const loginRes = await fetch(`${IG_BASE}/api/v1/web/accounts/login/ajax/`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrftoken,
      'X-Instagram-AJAX': '1',
      'X-Requested-With': 'XMLHttpRequest',
      'X-IG-App-ID': '936619743392459',
      'Referer': `${IG_BASE}/accounts/login/`,
      'Origin': IG_BASE,
      'Cookie': cookieStr,
    },
    body: new URLSearchParams({
      username,
      enc_password: `#PWD_INSTAGRAM_BROWSER:0:${Math.floor(Date.now()/1000)}:${password}`,
      queryParams: JSON.stringify({ next: '/' }),
      optIntoOneTap: 'false',
      stopDeletionNonce: '',
      trustedDeviceRecords: '{}',
    }).toString(),
    redirect: 'manual',
  });

  const loginRawCookies = loginRes.headers.get('set-cookie') || '';
  const loginCookieMap = parseCookies(loginRawCookies);
  const allCookies = { ...cookieMap, ...loginCookieMap };

  let data = {};
  try { data = JSON.parse(await loginRes.text()); } catch (e) {}

  console.log('[Login] status:', loginRes.status, 'authenticated:', data.authenticated, 'keys:', Object.keys(data).join(','));

  if (data.two_factor_required) {
    throw new Error('Akun ini menggunakan 2FA (Two-Factor Authentication). Gunakan tab "Paste Session ID" — login manual di browser lalu copy session ID-nya.');
  }
  if (data.checkpoint_url || data.action === 'checkpoint') {
    throw new Error('Instagram meminta verifikasi tambahan. Login manual di browser Instagram kamu, lalu gunakan tab "Paste Session ID" untuk copy session ID-nya.');
  }
  if (data.message === 'feedback_required' || data.spam === true) {
    throw new Error('Instagram memblokir percobaan login ini. Coba login manual di browser dan gunakan "Paste Session ID".');
  }
  if (data.user === false || data.authenticated === false) {
    throw new Error('Username atau password salah. Periksa kembali dan coba lagi.');
  }

  const sessionid = allCookies['sessionid'] || '';
  if (sessionid) return sessionid;

  if (data.authenticated === true) {
    throw new Error('Login berhasil tapi session ID tidak terbaca. Gunakan tab "Paste Session ID" secara manual dari browser.');
  }

  throw new Error('Login gagal. Instagram memblokir request dari server ini. Gunakan tab "Paste Session ID" sebagai alternatif.');
}

function parseCookies(raw) {
  const result = {};
  if (!raw) return result;
  const skip = new Set(['path','domain','expires','max-age','samesite','secure','httponly']);
  for (const part of raw.split(/,(?=[^ ,])|[\r\n]+/)) {
    const first = part.trim().split(';')[0].trim();
    const eq = first.indexOf('=');
    if (eq > 0) {
      const k = first.slice(0, eq).trim();
      const v = first.slice(eq + 1).trim();
      if (k && v && !skip.has(k.toLowerCase())) result[k] = v;
    }
  }
  return result;
}