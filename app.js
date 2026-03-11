document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
    (e.ctrlKey && e.key === 'U')
  ) { e.preventDefault(); return false; }
});

const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const errorBox = document.getElementById('errorBox');
const resultCard = document.getElementById('resultCard');
const progressBar = document.getElementById('progressBar');

let currentImages = [];
let currentUsername = 'unknown';
let currentStories = [];
let currentStoryUsername = '';
let currentHighlights = [];
let currentHighlightItems = {};
let deferredPrompt = null;
let activeSessionId = '';

function openSessionModal() {
  const modal = document.getElementById('sessionModal');
  modal.classList.add('open');
  switchModalTab('login');
  document.getElementById('loginStatus').textContent = '';
  document.getElementById('loginStatus').className = 'modal-status';
  setTimeout(() => document.getElementById('igUsername')?.focus(), 100);
}

function switchModalTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabSession').classList.toggle('active', !isLogin);
  document.getElementById('panelLogin').style.display = isLogin ? '' : 'none';
  document.getElementById('panelSession').style.display = isLogin ? 'none' : '';
}

function togglePasswordVisibility() {
  const input = document.getElementById('igPassword');
  const btn = document.getElementById('eyePassBtn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁'; }
}

async function doLogin() {
  const username = document.getElementById('igUsername').value.trim();
  const password = document.getElementById('igPassword').value;
  const statusEl = document.getElementById('loginStatus');
  const btn = document.getElementById('btnDoLogin');
  const btnText = document.getElementById('loginBtnText');

  if (!username || !password) {
    statusEl.textContent = 'Isi username dan password dulu.';
    statusEl.className = 'modal-status err';
    return;
  }

  btn.disabled = true;
  btnText.innerHTML = '<span class="spin"></span> Logging in...';
  statusEl.textContent = '';
  statusEl.className = 'modal-status';

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Login gagal. Coba lagi.');
    }

    activeSessionId = data.sessionid;
    updatePrivateBtn();

    document.getElementById('igUsername').value = '';
    document.getElementById('igPassword').value = '';

    statusEl.textContent = `✓ Login berhasil sebagai @${username}! Session aktif.`;
    statusEl.className = 'modal-status ok';
    setTimeout(() => closeSessionModal(), 1800);

  } catch (err) {
    statusEl.textContent = err.message;
    statusEl.className = 'modal-status err';
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Login & Ambil Session';
  }
}

function closeSessionModal() {
  document.getElementById('sessionModal').classList.remove('open');
}

function closeSessionModalOutside(e) {
  if (e.target.id === 'sessionModal') closeSessionModal();
}

function toggleSessionVisibility() {
  const input = document.getElementById('sessionIdInput');
  const btn = document.getElementById('eyeBtn');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
  else { input.type = 'password'; btn.textContent = '👁'; }
}

function saveSession() {
  const val = document.getElementById('sessionIdInput').value.trim();
  const statusEl = document.getElementById('modalStatus');
  if (!val) {
    statusEl.textContent = 'Please enter a Session ID.';
    statusEl.className = 'modal-status err';
    return;
  }
  activeSessionId = val;
  updatePrivateBtn();
  statusEl.textContent = '✓ Session ID saved! You can now search private accounts.';
  statusEl.className = 'modal-status ok';
  setTimeout(() => closeSessionModal(), 1400);
}

function clearSession() {
  activeSessionId = '';
  document.getElementById('sessionIdInput').value = '';
  document.getElementById('modalStatus').textContent = '';
  updatePrivateBtn();
}

function updatePrivateBtn() {
  const btn = document.getElementById('btnPrivateToggle');
  const dot = document.getElementById('privateStatusDot');
  const label = document.getElementById('btnPrivateLabel');
  const hint = document.getElementById('privateHint');
  if (activeSessionId) {
    btn.classList.add('active');
    dot.classList.add('on');
    label.textContent = 'Private Access: ON';
    hint.textContent = 'Session ID is active. You can search private accounts you follow.';
  } else {
    btn.classList.remove('active');
    dot.classList.remove('on');
    label.textContent = 'Private Account Access';
    hint.textContent = 'Set your Session ID to access private accounts you follow';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSessionModal();
});

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const banner = document.getElementById('pwaBanner');
  if (banner) banner.classList.add('show');
});

function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    dismissPWA();
  });
}

function dismissPWA() {
  const banner = document.getElementById('pwaBanner');
  if (banner) banner.classList.remove('show');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

function switchTab(tab) {
  document.getElementById('tabStory').classList.toggle('active', tab === 'story');
  document.getElementById('tabHighlight').classList.toggle('active', tab === 'highlight');
  document.getElementById('sectionStory').style.display = tab === 'story' ? 'block' : 'none';
  document.getElementById('sectionHighlight').style.display = tab === 'highlight' ? 'block' : 'none';
}

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchMedia(); });
urlInput.addEventListener('input', updatePasteBtn);
document.getElementById('storyUsernameInput').addEventListener('keydown', e => { if (e.key === 'Enter') fetchStory(); });
document.getElementById('highlightUsernameInput').addEventListener('keydown', e => { if (e.key === 'Enter') fetchHighlight(); });

function updatePasteBtn() {
  const btn = document.getElementById('pasteBtn');
  if (urlInput.value.trim()) {
    btn.textContent = 'Clear';
    btn.onclick = clearURL;
  } else {
    btn.textContent = 'Paste';
    btn.onclick = pasteURL;
  }
}

async function pasteURL() {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    updatePasteBtn();
    urlInput.focus();
  } catch (e) { urlInput.focus(); }
}

function clearURL() {
  urlInput.value = '';
  updatePasteBtn();
  resetUI();
  urlInput.focus();
}

function showProgress() { progressBar.className = 'progress-bar loading'; }
function hideProgress() {
  progressBar.className = 'progress-bar done';
  setTimeout(() => { progressBar.className = 'progress-bar'; }, 700);
}

function formatNum(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function resetUI() {
  errorBox.classList.remove('active');
  resultCard.classList.remove('active');
  currentImages = [];
}

function saveBlobAsFile(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
}

function proxyUrl(url, filename) {
  return '/api/proxy?url=' + encodeURIComponent(url) + '&filename=' + encodeURIComponent(filename || 'file');
}

function proxyImg(url, filename) {
  if (!url) return '';
  return proxyUrl(url, filename || 'image.jpg');
}

async function downloadVideo(btn) {
  const url = btn.dataset.url;
  const filename = btn.dataset.filename || 'igsave_video.mp4';
  if (!url) return;
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Downloading...';
  showProgress();
  try {
    const r = await fetch(proxyUrl(url, filename));
    if (!r.ok) throw new Error();
    saveBlobAsFile(await r.blob(), filename);
  } catch { window.open(proxyUrl(url, filename), '_blank'); }
  finally { btn.disabled = false; btn.innerHTML = orig; hideProgress(); }
}

async function downloadAudio(btn) {
  const url = btn.dataset.url;
  const filename = btn.dataset.filename || 'igsave_audio.mp3';
  if (!url) return;
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  showProgress();
  try {
    const r = await fetch(proxyUrl(url, filename));
    if (!r.ok) throw new Error();
    saveBlobAsFile(await r.blob(), filename);
  } catch { window.open(proxyUrl(url, filename), '_blank'); }
  finally { btn.disabled = false; btn.innerHTML = orig; hideProgress(); }
}

async function downloadSingleImage(url, index, isVideo) {
  const video = isVideo === true || isVideo === 'true';
  const ext = video ? 'mp4' : 'jpg';
  const filename = `${currentUsername}_${video ? 'video' : 'image'}${index + 1}.${ext}`;
  showProgress();
  try {
    const r = await fetch(proxyUrl(url, filename));
    saveBlobAsFile(await r.blob(), filename);
  } catch { window.open(proxyUrl(url, filename), '_blank'); }
  finally { hideProgress(); }
}

async function downloadAllImages() {
  if (!currentImages.length) return;
  const btn = document.querySelector('#imagesSection .btn-dl-all');
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Preparing...'; btn.disabled = true; }
  showProgress();

  const files = currentImages.map((entry, i) => {
    const isObj = typeof entry === 'object' && entry !== null;
    const isVideo = isObj && entry.type === 'video';
    const url = isObj ? entry.url : entry;
    const ext = isVideo ? 'mp4' : 'jpg';
    return { url, filename: `${currentUsername}_${isVideo ? 'video' : 'image'}${i + 1}.${ext}` };
  });

  try {
    const r = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, username: currentUsername })
    });
    if (!r.ok) throw new Error();
    saveBlobAsFile(await r.blob(), `${currentUsername}_files.zip`);
  } catch {
    for (let i = 0; i < files.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      try { saveBlobAsFile(await (await fetch(proxyUrl(files[i].url, files[i].filename))).blob(), files[i].filename); }
      catch { window.open(files[i].url, '_blank'); }
    }
  } finally {
    if (btn) { btn.textContent = orig; btn.disabled = false; }
    hideProgress();
  }
}

function renderImages(images) {
  const section = document.getElementById('imagesSection');
  const grid = document.getElementById('imagesGrid');
  if (!images || !images.length) { section.style.display = 'none'; return; }
  currentImages = images;
  grid.innerHTML = '';
  images.forEach((entry, i) => {
    const isObj = typeof entry === 'object' && entry !== null;
    const isVideo = isObj && entry.type === 'video';
    const mediaUrl = isObj ? entry.url : entry;
    const thumbUrl = isObj ? (entry.thumb || entry.url) : entry;
    const item = document.createElement('div');
    item.className = 'img-item';
    item.innerHTML = `
      <img src="${proxyImg(thumbUrl, `preview_${i+1}.jpg`)}" alt="${isVideo ? 'Video' : 'Photo'} ${i+1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>
      ${isVideo ? '<span class="thumb-type">VIDEO</span>' : ''}
      <button class="img-overlay" onclick="downloadSingleImage('${mediaUrl}',${i},${isVideo})"><span>Save</span></button>
    `;
    grid.appendChild(item);
  });
  section.style.display = 'block';
}

async function fetchMedia() {
  const url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }
  resetUI();
  downloadBtn.disabled = true;
  document.getElementById('btnText').innerHTML = '<span class="spin"></span>';
  showProgress();
  try {
    const res = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch media.');
    const v = data.media;
    currentUsername = v.authorUsername || 'unknown';
    const ts = Date.now();

    document.getElementById('resCover').src = v.cover ? proxyImg(v.cover, 'cover.jpg') : '';
    document.getElementById('resCover').style.display = v.cover ? '' : 'none';
    document.getElementById('resAvatar').src = v.avatar ? proxyImg(v.avatar, 'avatar.jpg') : '';
    document.getElementById('resAvatar').style.display = v.avatar ? '' : 'none';
    document.getElementById('resAuthor').textContent = v.author || '';
    document.getElementById('resHandle').textContent = v.authorUsername ? `@${v.authorUsername}` : '';
    document.getElementById('resTitle').textContent = v.title || '';
    document.getElementById('resType').textContent = v.type || '';

    const likesEl = document.getElementById('resLikes');
    const commentsEl = document.getElementById('resComments');
    if (v.likes || v.comments) {
      likesEl.textContent = formatNum(v.likes) + ' likes';
      commentsEl.textContent = formatNum(v.comments) + ' comments';
      likesEl.style.display = commentsEl.style.display = '';
    } else {
      likesEl.style.display = commentsEl.style.display = 'none';
    }

    const dlVideo = document.getElementById('dlVideoBtn');
    dlVideo.style.display = v.downloadUrl ? 'flex' : 'none';
    if (v.downloadUrl) { dlVideo.dataset.url = v.downloadUrl; dlVideo.dataset.filename = `${currentUsername}_${ts}.mp4`; }

    const dlMusic = document.getElementById('dlMusicBtn');
    dlMusic.style.display = v.music ? 'flex' : 'none';
    if (v.music) { dlMusic.dataset.url = v.music; dlMusic.dataset.filename = `${currentUsername}_audio_${ts}.mp3`; }

    renderImages(v.images || []);
    resultCard.classList.add('active');
  } catch (err) {
    errorBox.classList.add('active');
    document.getElementById('errorText').textContent = err.message || 'Something went wrong. Try again.';
  } finally {
    downloadBtn.disabled = false;
    document.getElementById('btnText').textContent = 'Download';
    hideProgress();
  }
}

async function fetchStory() {
  const username = document.getElementById('storyUsernameInput').value.trim().replace('@', '');
  const errEl = document.getElementById('storyError');
  const resEl = document.getElementById('storyResult');
  if (!username) { errEl.textContent = 'Enter a username.'; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  resEl.style.display = 'none';
  const btn = document.getElementById('fetchStoryBtn');
  const orig = btn.innerHTML;
  btn.disabled = true;
  document.getElementById('storyBtnText').innerHTML = '<span class="spin"></span>';
  showProgress();
  currentStoryUsername = username;

  try {
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionid: activeSessionId || undefined })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch stories.');
    currentStories = data.stories;
    renderStories(data);
  } catch (err) {
    errEl.textContent = err.message || 'Something went wrong.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    document.getElementById('storyBtnText').textContent = 'Search';
    hideProgress();
  }
}

function renderStories(data) {
  const resEl = document.getElementById('storyResult');
  const grid = document.getElementById('storyGrid');
  document.getElementById('storyAuthorName').textContent = data.author || data.username;
  document.getElementById('storyAuthorHandle').textContent = `@${data.username}`;
  const av = document.getElementById('storyAvatar');
  av.src = data.avatar ? proxyImg(data.avatar, 'story_avatar.jpg') : '';
  av.style.display = data.avatar ? '' : 'none';
  grid.innerHTML = '';
  data.stories.forEach((story, i) => {
    const item = document.createElement('div');
    item.className = 'img-item';
    const thumb = story.thumb ? proxyImg(story.thumb, `story_thumb_${i}.jpg`) : '';
    item.innerHTML = `
      ${thumb ? `<img src="${thumb}" alt="Story ${i+1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>` : `<div style="width:100%;height:100%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:1.6rem">${story.isVideo?'🎬':'🖼️'}</div>`}
      ${story.isVideo ? '<span class="thumb-type">VIDEO</span>' : ''}
      <button class="img-overlay" onclick="downloadStory(${i})"><span>Save</span></button>
    `;
    grid.appendChild(item);
  });
  resEl.style.display = 'block';
}

async function downloadStory(index) {
  const story = currentStories[index];
  if (!story?.url) return;
  const ext = story.isVideo ? 'mp4' : 'jpg';
  const filename = `${currentStoryUsername}_story${index + 1}.${ext}`;
  showProgress();
  try { saveBlobAsFile(await (await fetch(proxyUrl(story.url, filename))).blob(), filename); }
  catch { window.open(proxyUrl(story.url, filename), '_blank'); }
  finally { hideProgress(); }
}

async function downloadAllStories() {
  if (!currentStories.length) return;
  const btn = document.getElementById('dlAllStoriesBtn');
  const orig = btn.textContent;
  btn.textContent = 'Preparing...'; btn.disabled = true;
  showProgress();

  const files = currentStories.map((s, i) => ({
    url: s.url,
    filename: `${currentStoryUsername}_story${i + 1}.${s.isVideo ? 'mp4' : 'jpg'}`
  })).filter(f => f.url);

  try {
    const r = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, username: currentStoryUsername })
    });
    if (r.ok) {
      saveBlobAsFile(await r.blob(), `${currentStoryUsername}_stories.zip`);
    } else {
      throw new Error('ZIP failed');
    }
  } catch {
    for (let i = 0; i < currentStories.length; i++) {
      await downloadStory(i);
      await new Promise(r => setTimeout(r, 400));
    }
  } finally {
    btn.textContent = orig; btn.disabled = false; hideProgress();
  }
}

async function fetchHighlight() {
  const username = document.getElementById('highlightUsernameInput').value.trim().replace('@','');
  const errEl = document.getElementById('highlightError');
  const resEl = document.getElementById('highlightResult');
  if (!username) { errEl.textContent = 'Enter a username.'; errEl.style.display = 'block'; return; }

  errEl.style.display = 'none';
  resEl.style.display = 'none';
  const btn = document.getElementById('fetchHighlightBtn');
  btn.disabled = true;
  document.getElementById('highlightBtnText').innerHTML = '<span class="spin"></span>';
  showProgress();

  try {
    const res = await fetch('/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionid: activeSessionId || undefined })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch highlights.');
    currentHighlights = data.highlights;
    renderHighlights(data);
  } catch (err) {
    errEl.textContent = err.message || 'Something went wrong.';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    document.getElementById('highlightBtnText').textContent = 'Search';
    hideProgress();
  }
}

function renderHighlights(data) {
  const resEl = document.getElementById('highlightResult');
  const list = document.getElementById('highlightList');
  document.getElementById('highlightAuthorName').textContent = data.author || data.username;
  document.getElementById('highlightAuthorHandle').textContent = `@${data.username}`;
  const av = document.getElementById('highlightAvatar');
  av.src = data.avatar ? proxyImg(data.avatar, 'hl_avatar.jpg') : '';
  av.style.display = data.avatar ? '' : 'none';

  list.innerHTML = '';
  data.highlights.forEach((hl, i) => {
    const div = document.createElement('div');
    div.className = 'highlight-item';
    div.id = `hl_${i}`;
    const thumb = hl.cover ? proxyImg(hl.cover, `hl_cover_${i}.jpg`) : '';
    div.innerHTML = `
      <div class="highlight-header" onclick="toggleHighlight(${i})">
        ${thumb ? `<img class="highlight-thumb" src="${thumb}" onerror="this.style.display='none'"/>` : `<div class="highlight-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem">⭕</div>`}
        <div class="highlight-info">
          <div class="highlight-title">${hl.title || 'Highlight'}</div>
          <div class="highlight-count">${hl.mediaCount ? hl.mediaCount + ' items' : 'Tap to load'}</div>
        </div>
        <span class="highlight-arrow">▶</span>
      </div>
      <div class="highlight-body" id="hlBody_${i}">
        <div class="highlight-dl-row">
          <button class="btn-dl-all" onclick="downloadAllHighlightItems(${i})">Download All</button>
        </div>
        <div class="images-grid" id="hlGrid_${i}"></div>
      </div>
    `;
    list.appendChild(div);
  });
  resEl.style.display = 'block';
}

async function toggleHighlight(index) {
  const item = document.getElementById(`hl_${index}`);
  const wasOpen = item.classList.contains('open');
  item.classList.toggle('open', !wasOpen);
  if (wasOpen) return;

  const hl = currentHighlights[index];
  const grid = document.getElementById(`hlGrid_${index}`);

  if (currentHighlightItems[index]) {
    renderHighlightGrid(index, currentHighlightItems[index]);
    return;
  }

  grid.innerHTML = '<div style="padding:10px;font-size:0.75rem;color:var(--text-muted)">Loading...</div>';
  showProgress();

  try {
    const res = await fetch('/api/highlight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlightId: hl.id })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load highlight.');
    currentHighlightItems[index] = data.items;
    renderHighlightGrid(index, data.items);
  } catch (err) {
    grid.innerHTML = `<div style="padding:10px;font-size:0.75rem;color:var(--error-text)">${err.message}</div>`;
  } finally { hideProgress(); }
}

function renderHighlightGrid(index, items) {
  const grid = document.getElementById(`hlGrid_${index}`);
  const hl = currentHighlights[index];
  grid.innerHTML = '';
  items.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'img-item';
    const thumb = item.thumb ? proxyImg(item.thumb, `hl_${index}_${i}.jpg`) : '';
    div.innerHTML = `
      ${thumb ? `<img src="${thumb}" alt="Item ${i+1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>` : `<div style="width:100%;height:100%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">${item.isVideo?'🎬':'🖼️'}</div>`}
      ${item.isVideo ? '<span class="thumb-type">VIDEO</span>' : ''}
      <button class="img-overlay" onclick="downloadHighlightItem(${index},${i})"><span>Save</span></button>
    `;
    grid.appendChild(div);
  });
}

async function downloadHighlightItem(hlIndex, itemIndex) {
  const item = currentHighlightItems[hlIndex]?.[itemIndex];
  if (!item?.url) return;
  const hl = currentHighlights[hlIndex];
  const ext = item.isVideo ? 'mp4' : 'jpg';
  const filename = `${hl.title || 'highlight'}_${itemIndex + 1}.${ext}`;
  showProgress();
  try { saveBlobAsFile(await (await fetch(proxyUrl(item.url, filename))).blob(), filename); }
  catch { window.open(proxyUrl(item.url, filename), '_blank'); }
  finally { hideProgress(); }
}

async function downloadAllHighlightItems(hlIndex) {
  const items = currentHighlightItems[hlIndex];
  if (!items?.length) return;
  const hl = currentHighlights[hlIndex];
  const btn = document.querySelector(`#hl_${hlIndex} .btn-dl-all`);
  const orig = btn?.textContent;
  if (btn) { btn.textContent = 'Preparing...'; btn.disabled = true; }
  showProgress();

  const safeTitle = (hl.title || 'highlight').replace(/[^a-zA-Z0-9_]/g, '_');

  const files = items.map((item, i) => ({
    url: item.url,
    filename: `${safeTitle}_${i + 1}.${item.isVideo ? 'mp4' : 'jpg'}`
  })).filter(f => f.url);

  try {
    const r = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, username: safeTitle })
    });
    if (r.ok) {
      saveBlobAsFile(await r.blob(), `${safeTitle}.zip`);
    } else {
      throw new Error('ZIP failed');
    }
  } catch {
    for (let i = 0; i < items.length; i++) {
      await downloadHighlightItem(hlIndex, i);
      await new Promise(r => setTimeout(r, 400));
    }
  } finally {
    if (btn) { btn.textContent = orig; btn.disabled = false; }
    hideProgress();
  }
}