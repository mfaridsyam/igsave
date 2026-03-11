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
    const sessionid = await igLogin(username.trim(), password);

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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
  });

  if (!initRes.ok) throw new Error('Failed to reach Instagram. Try again later.');

  const rawCookies = initRes.headers.get('set-cookie') || '';
  const cookieMap = parseCookies(rawCookies);
  const csrftoken = cookieMap['csrftoken'] || '';
  const mid = cookieMap['mid'] || '';

  if (!csrftoken) throw new Error('Could not get CSRF token. Instagram may be blocking the request.');

  const cookieStr = Object.entries(cookieMap)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');

  const loginRes = await fetch(`${IG_BASE}/api/v1/web/accounts/login/ajax/`, {
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-CSRFToken': csrftoken,
      'X-Instagram-AJAX': '1',
      'X-Requested-With': 'XMLHttpRequest',
      'Referer': `${IG_BASE}/accounts/login/`,
      'Origin': IG_BASE,
      'Cookie': cookieStr,
    },
    body: new URLSearchParams({
      username,
      enc_password: `#PWD_INSTAGRAM_BROWSER:0:${Date.now()}:${password}`,
      queryParams: '{}',
      optIntoOneTap: 'false',
      stopDeletionNonce: '',
      trustedDeviceRecords: '{}',
    }).toString(),
    redirect: 'manual',
  });

  const loginCookies = loginRes.headers.get('set-cookie') || '';
  const loginCookieMap = parseCookies(loginCookies);

  let data = {};
  try {
    const text = await loginRes.text();
    data = JSON.parse(text);
  } catch (e) {}

  if (data.two_factor_required) {
    throw new Error('Two-factor authentication is enabled. Please disable 2FA temporarily or use Session ID manually.');
  }

  if (data.checkpoint_url || data.action === 'checkpoint') {
    throw new Error('Instagram requires verification (checkpoint). Please login manually in browser and copy the Session ID instead.');
  }

  if (data.message === 'feedback_required') {
    throw new Error('Instagram blocked this login attempt. Please try logging in via browser and copy Session ID manually.');
  }

  const sessionid = loginCookieMap['sessionid'] || '';

  if (!sessionid && data.authenticated === false) {
    throw new Error('Wrong username or password. Please check and try again.');
  }

  if (!sessionid) {
    const allCookies = { ...cookieMap, ...loginCookieMap };
    const sid = allCookies['sessionid'] || '';
    if (!sid) throw new Error('Login failed. Instagram may have flagged this request. Try again later or use Session ID manually.');
    return sid;
  }

  return sessionid;
}

function parseCookies(rawCookies) {
  const result = {};
  if (!rawCookies) return result;
  const parts = rawCookies.split(/,(?=[^ ])|[\n]/);
  for (const part of parts) {
    const segments = part.trim().split(';');
    const first = segments[0].trim();
    const eqIdx = first.indexOf('=');
    if (eqIdx > 0) {
      const key = first.substring(0, eqIdx).trim();
      const val = first.substring(eqIdx + 1).trim();
      if (key && val && !['path', 'domain', 'expires', 'max-age', 'samesite', 'secure', 'httponly'].includes(key.toLowerCase())) {
        result[key] = val;
      }
    }
  }
  return result;
}