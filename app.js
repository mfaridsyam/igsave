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
let currentMediaTimestamp = null;
let currentUsername = 'unknown';
let currentStories = [];
let currentStoryUsername = '';
let currentHighlights = [];
let currentHighlightItems = {};
let deferredPrompt = null;

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

function tsToDate(ts) {
  if (!ts) return null;
  let date;
  if (typeof ts === 'number') {
    date = ts < 1e12 ? new Date(ts * 1000) : new Date(ts);
  } else if (typeof ts === 'string' && /^\d+$/.test(ts)) {
    const n = parseInt(ts);
    date = n < 1e12 ? new Date(n * 1000) : new Date(n);
  } else {
    date = new Date(ts);
  }
  return isNaN(date.getTime()) ? null : date;
}

function formatTimestamp(ts) {
  const date = tsToDate(ts);
  if (!date) return '';
  return date.toLocaleString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatStoryLabel(ts) {
  const date = tsToDate(ts);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatHighlightLabel(ts) {
  const date = tsToDate(ts);
  if (!date) return '';
  const diff = Date.now() - date.getTime();
  if (diff < 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 365 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFileDateTime(ts) {
  const date = tsToDate(ts);
  if (!date) return null;
  const Y = date.getFullYear();
  const M = String(date.getMonth() + 1).padStart(2, '0');
  const D = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${Y}${M}${D}_${h}${m}`;
}

function formatTodayDate() {
  const d = new Date();
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, '0');
  const D = String(d.getDate()).padStart(2, '0');
  return `${Y}${M}${D}`;
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

async function downloadSingleImage(url, index, isVideo, ts) {
  const video = isVideo === true || isVideo === 'true';
  const ext = video ? 'mp4' : 'jpg';
  const dtStr = formatFileDateTime(ts) || formatFileDateTime(currentMediaTimestamp) || formatTodayDate();
  const filename = `${currentUsername}_${dtStr}.${ext}`;
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

  const postDtStr = formatFileDateTime(currentMediaTimestamp) || formatTodayDate();
  const files = currentImages.map((entry, i) => {
    const isObj = typeof entry === 'object' && entry !== null;
    const isVideo = isObj && entry.type === 'video';
    const url = isObj ? entry.url : entry;
    const ext = isVideo ? 'mp4' : 'jpg';
    const suffix = currentImages.length > 1 ? `_${i + 1}` : '';
    return { url, filename: `${currentUsername}_${postDtStr}${suffix}.${ext}` };
  });
  const zipName = `${currentUsername}_${formatTodayDate()}.zip`;

  try {
    const r = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, username: currentUsername })
    });
    if (!r.ok) throw new Error();
    saveBlobAsFile(await r.blob(), zipName);
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
      <button class="img-overlay" onclick="downloadSingleImage('${mediaUrl}',${i},${isVideo},${currentMediaTimestamp})"><span>Save</span></button>
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

    const tsFormatted = formatTimestamp(v.timestamp);
    let resDateEl = document.getElementById('resDate');
    if (!resDateEl) {
      resDateEl = document.createElement('div');
      resDateEl.id = 'resDate';
      resDateEl.className = 'result-date';
      const statsEl = document.querySelector('.result-stats');
      if (statsEl) statsEl.insertAdjacentElement('afterend', resDateEl);
    }
    resDateEl.textContent = tsFormatted || '';
    resDateEl.style.display = tsFormatted ? '' : 'none';

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
    if (v.downloadUrl) { dlVideo.dataset.url = v.downloadUrl; dlVideo.dataset.filename = `${currentUsername}_${formatFileDateTime(v.timestamp) || formatTodayDate()}.mp4`; }

    const dlMusic = document.getElementById('dlMusicBtn');
    dlMusic.style.display = v.music ? 'flex' : 'none';
    if (v.music) { dlMusic.dataset.url = v.music; dlMusic.dataset.filename = `${currentUsername}_audio_${formatFileDateTime(v.timestamp) || formatTodayDate()}.mp3`; }

    currentMediaTimestamp = v.timestamp || null;
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
  btn.disabled = true;
  document.getElementById('storyBtnText').innerHTML = '<span class="spin"></span>';
  showProgress();
  currentStoryUsername = username;

  try {
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch stories.');
    data.stories.sort((a, b) => (b.takenAt || 0) - (a.takenAt || 0));
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
    const timeLabel = formatStoryLabel(story.takenAt);
    item.innerHTML = `
      ${thumb ? `<img src="${thumb}" alt="Story ${i+1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>` : `<div style="width:100%;height:100%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:1.6rem">${story.isVideo?'🎬':'🖼️'}</div>`}
      ${story.isVideo ? '<span class="thumb-type">VIDEO</span>' : ''}
      ${timeLabel ? `<span class="story-time">${timeLabel}</span>` : ''}
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
  const dtStr = formatFileDateTime(story.takenAt) || formatTodayDate();
  const filename = `${currentStoryUsername}_${dtStr}.${ext}`;
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

  const files = currentStories.map((s) => {
    const dtStr = formatFileDateTime(s.takenAt) || formatTodayDate();
    return { url: s.url, filename: `${currentStoryUsername}_${dtStr}.${s.isVideo ? 'mp4' : 'jpg'}` };
  }).filter(f => f.url);
  const zipName = `${currentStoryUsername}_${formatTodayDate()}.zip`;

  try {
    const r = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, username: currentStoryUsername })
    });
    if (r.ok) {
      saveBlobAsFile(await r.blob(), zipName);
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
      body: JSON.stringify({ username })
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
    data.items.sort((a, b) => (b.takenAt || b.timestamp || 0) - (a.takenAt || a.timestamp || 0));
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
    const timeLabel = formatHighlightLabel(item.takenAt || item.timestamp);
    div.innerHTML = `
      ${thumb ? `<img src="${thumb}" alt="Item ${i+1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>` : `<div style="width:100%;height:100%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:1.4rem">${item.isVideo?'🎬':'🖼️'}</div>`}
      ${item.isVideo ? '<span class="thumb-type">VIDEO</span>' : ''}
      ${timeLabel ? `<span class="story-time">${timeLabel}</span>` : ''}
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
  const dtStr = formatFileDateTime(item.takenAt) || formatTodayDate();
  const safeTitle = (hl.title || 'highlight').replace(/[^a-zA-Z0-9_]/g, '_');
  const filename = `${safeTitle}_${dtStr}.${ext}`;
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

  const files = items.map((item) => {
    const dtStr = formatFileDateTime(item.takenAt) || formatTodayDate();
    return { url: item.url, filename: `${safeTitle}_${dtStr}.${item.isVideo ? 'mp4' : 'jpg'}` };
  }).filter(f => f.url);
  const zipName = `${safeTitle}_${formatTodayDate()}.zip`;

  try {
    const r = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files, username: safeTitle })
    });
    if (r.ok) {
      saveBlobAsFile(await r.blob(), zipName);
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