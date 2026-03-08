<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>IGSave Debug</title>
  <style>
    body { font-family: monospace; background: #0f0f0f; color: #e0e0e0; padding: 20px; margin: 0; }
    h2 { color: #c13584; margin-bottom: 4px; font-size: 1rem; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    input, textarea { width: 100%; background: #111; border: 1px solid #444; border-radius: 6px; padding: 9px 11px; color: #fff; font-family: monospace; font-size: 13px; box-sizing: border-box; margin-top: 4px; }
    label { font-size: 12px; color: #aaa; }
    button { margin-top: 10px; padding: 10px 20px; background: linear-gradient(90deg,#c13584,#8134af); border: none; border-radius: 6px; color: #fff; font-size: 13px; cursor: pointer; font-family: monospace; }
    button:disabled { opacity: 0.4; cursor: not-allowed; }
    .result { margin-top: 12px; background: #111; border: 1px solid #2a2a2a; border-radius: 6px; padding: 12px; white-space: pre-wrap; word-break: break-all; font-size: 12px; max-height: 400px; overflow-y: auto; display: none; }
    .result.show { display: block; }
    .ok { color: #4caf50; }
    .err { color: #f44336; }
    .label-row { display: flex; justify-content: space-between; align-items: center; }
    .status { font-size: 11px; padding: 2px 8px; border-radius: 10px; }
    .status.ok { background: #1b3a1b; color: #4caf50; }
    .status.err { background: #3a1b1b; color: #f44336; }
    .copy-btn { font-size: 11px; padding: 4px 10px; background: #333; margin-top: 6px; }
  </style>
</head>
<body>

<div class="card">
  <h2>🔍 Test mediaByShortcode</h2>
  <label>Shortcode (dari URL post/reel, contoh: DVQcB50E7qi)</label>
  <input type="text" id="sc_shortcode" placeholder="DVQcB50E7qi"/>
  <button onclick="testEndpoint('mediaByShortcode', {shortcode: document.getElementById('sc_shortcode').value}, 'res_shortcode')">Test</button>
  <div class="label-row"><span></span><span id="stat_shortcode"></span></div>
  <div class="result" id="res_shortcode"></div>
  <button class="copy-btn" onclick="copyResult('res_shortcode')" style="display:none" id="copy_shortcode">📋 Copy hasil</button>
</div>

<div class="card">
  <h2>🔍 Test userInfo</h2>
  <label>Username</label>
  <input type="text" id="ui_username" placeholder="natgeo"/>
  <button onclick="testEndpoint('userInfo', {username: document.getElementById('ui_username').value}, 'res_userinfo')">Test</button>
  <div class="label-row"><span></span><span id="stat_userinfo"></span></div>
  <div class="result" id="res_userinfo"></div>
  <button class="copy-btn" onclick="copyResult('res_userinfo')" style="display:none" id="copy_userinfo">📋 Copy hasil</button>
</div>

<div class="card">
  <h2>🔍 Test stories</h2>
  <label>Username target</label>
  <input type="text" id="st_username" placeholder="kristian_aco"/>
  <label style="margin-top:8px;display:block">Session ID kamu</label>
  <input type="password" id="st_sessionid" placeholder="Paste sessionid..."/>
  <button onclick="testEndpoint('stories', {username: document.getElementById('st_username').value, sessionid: document.getElementById('st_sessionid').value}, 'res_stories')">Test</button>
  <div class="label-row"><span></span><span id="stat_stories"></span></div>
  <div class="result" id="res_stories"></div>
  <button class="copy-btn" onclick="copyResult('res_stories')" style="display:none" id="copy_stories">📋 Copy hasil</button>
</div>

<div class="card">
  <h2>🔍 Test profile</h2>
  <label>Username</label>
  <input type="text" id="pr_username" placeholder="natgeo"/>
  <button onclick="testEndpoint('profile', {username: document.getElementById('pr_username').value}, 'res_profile')">Test</button>
  <div class="label-row"><span></span><span id="stat_profile"></span></div>
  <div class="result" id="res_profile"></div>
  <button class="copy-btn" onclick="copyResult('res_profile')" style="display:none" id="copy_profile">📋 Copy hasil</button>
</div>

<script>
async function testEndpoint(endpoint, body, resultId) {
  const el = document.getElementById(resultId);
  const statId = 'stat_' + resultId.replace('res_','');
  const copyId = 'copy_' + resultId.replace('res_','');
  const statEl = document.getElementById(statId);
  const copyEl = document.getElementById(copyId);

  el.className = 'result show';
  el.textContent = '⏳ Mengirim request...';
  statEl.innerHTML = '';

  try {
    const res = await fetch('/api/debug', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ endpoint, ...body })
    });
    const data = await res.json();
    const pretty = JSON.stringify(data, null, 2);
    el.textContent = pretty;
    const isOk = data.ok || (data.status >= 200 && data.status < 300);
    statEl.innerHTML = `<span class="status ${isOk?'ok':'err'}">${isOk ? '✓ OK '+data.status : '✗ ERROR '+data.status}</span>`;
    copyEl.style.display = 'inline-block';
  } catch(e) {
    el.textContent = '❌ Fetch error: ' + e.message;
    statEl.innerHTML = `<span class="status err">✗ GAGAL</span>`;
  }
}

function copyResult(resultId) {
  const text = document.getElementById(resultId).textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert('✅ Hasil sudah di-copy! Sekarang paste ke chat.');
  }).catch(() => {
    // Fallback: select all text
    const el = document.getElementById(resultId);
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    alert('Teks sudah diselect. Tekan Ctrl+C untuk copy.');
  });
}
</script>
</body>
</html>