const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const errorBox = document.getElementById('errorBox');
const resultCard = document.getElementById('resultCard');
const progressBar = document.getElementById('progressBar');

let currentImages = [];
let currentUsername = 'unknown';
let currentStories = [];
let currentStoryUsername = '';

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchMedia(); });
urlInput.addEventListener('input', updatePasteBtn);

function updatePasteBtn() {
  const btn = document.getElementById('pasteBtn');
  if (urlInput.value.trim()) {
    btn.textContent = 'Hapus';
    btn.onclick = clearURL;
  } else {
    btn.textContent = 'Tempel';
    btn.onclick = pasteURL;
  }
}

async function pasteURL() {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    updatePasteBtn();
    urlInput.focus();
  } catch (e) {
    urlInput.focus();
  }
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
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Mengunduh...';
  showProgress();
  try {
    const response = await fetch(proxyUrl(url, filename));
    if (!response.ok) throw new Error('Gagal mengunduh video.');
    const blob = await response.blob();
    saveBlobAsFile(blob, filename);
  } catch (e) {
    window.open(proxyUrl(url, filename), '_blank');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    hideProgress();
  }
}

async function downloadAudio(btn) {
  const url = btn.dataset.url;
  const filename = btn.dataset.filename || 'igsave_audio.mp3';
  if (!url) return;
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';
  showProgress();
  try {
    const response = await fetch(proxyUrl(url, filename));
    if (!response.ok) throw new Error('Gagal mengunduh audio.');
    const blob = await response.blob();
    saveBlobAsFile(blob, filename);
  } catch (e) {
    window.open(proxyUrl(url, filename), '_blank');
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    hideProgress();
  }
}

async function downloadSingleImage(url, index) {
  const filename = `${currentUsername}_image${index + 1}.jpg`;
  showProgress();
  try {
    const response = await fetch(proxyUrl(url, filename));
    const blob = await response.blob();
    saveBlobAsFile(blob, filename);
  } catch (e) {
    window.open(proxyUrl(url, filename), '_blank');
  } finally {
    hideProgress();
  }
}

async function downloadAllImages() {
  if (!currentImages.length) return;
  const btn = document.querySelector('.btn-dl-all');
  const origText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Menyiapkan...'; btn.disabled = true; }
  showProgress();
  try {
    const response = await fetch('/api/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: currentImages, username: currentUsername })
    });
    if (!response.ok) throw new Error('Gagal membuat ZIP');
    const blob = await response.blob();
    saveBlobAsFile(blob, `${currentUsername}_images.zip`);
  } catch (e) {
    for (let i = 0; i < currentImages.length; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const filename = `${currentUsername}_image${i + 1}.jpg`;
        const r = await fetch(proxyUrl(currentImages[i], filename));
        const bl = await r.blob();
        saveBlobAsFile(bl, filename);
      } catch {
        window.open(currentImages[i], '_blank');
      }
    }
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
    hideProgress();
  }
}

function renderImages(images) {
  const section = document.getElementById('imagesSection');
  const grid = document.getElementById('imagesGrid');
  if (!images || images.length === 0) { section.style.display = 'none'; return; }
  currentImages = images;
  grid.innerHTML = '';
  images.forEach((imgUrl, i) => {
    const item = document.createElement('div');
    item.className = 'img-item';
    const proxiedSrc = proxyImg(imgUrl, `preview_${i + 1}.jpg`);
    item.innerHTML = `
      <img src="${proxiedSrc}" alt="Foto ${i + 1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>
      <button class="img-overlay" onclick="downloadSingleImage('${imgUrl}', ${i})"><span>Unduh</span></button>
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
    if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil media.');

    const v = data.media;
    currentUsername = v.authorUsername || 'unknown';
    const ts = Date.now();

    const coverEl = document.getElementById('resCover');
    const avatarEl = document.getElementById('resAvatar');

    if (v.cover) {
      coverEl.src = proxyImg(v.cover, 'cover.jpg');
      coverEl.style.display = '';
    } else {
      coverEl.style.display = 'none';
    }

    if (v.avatar) {
      avatarEl.src = proxyImg(v.avatar, 'avatar.jpg');
      avatarEl.style.display = '';
    } else {
      avatarEl.style.display = 'none';
    }

    document.getElementById('resAuthor').textContent = v.author || '';
    document.getElementById('resHandle').textContent = v.authorUsername ? `@${v.authorUsername}` : '';
    document.getElementById('resTitle').textContent = v.title || '';
    document.getElementById('resType').textContent = v.type || '';

    const likesEl = document.getElementById('resLikes');
    const commentsEl = document.getElementById('resComments');
    if (v.likes || v.comments) {
      likesEl.textContent = formatNum(v.likes) + ' suka';
      commentsEl.textContent = formatNum(v.comments) + ' komentar';
      likesEl.style.display = '';
      commentsEl.style.display = '';
    } else {
      likesEl.style.display = 'none';
      commentsEl.style.display = 'none';
    }

    const dlVideo = document.getElementById('dlVideoBtn');
    if (v.downloadUrl) {
      dlVideo.dataset.url = v.downloadUrl;
      dlVideo.dataset.filename = `${currentUsername}_${ts}.mp4`;
      dlVideo.style.display = 'flex';
    } else {
      dlVideo.style.display = 'none';
    }

    const dlMusic = document.getElementById('dlMusicBtn');
    if (v.music) {
      dlMusic.dataset.url = v.music;
      dlMusic.dataset.filename = `${currentUsername}_audio_${ts}.mp3`;
      dlMusic.textContent = 'Audio';
      dlMusic.style.display = 'flex';
    } else {
      dlMusic.style.display = 'none';
    }

    renderImages(v.images || []);
    resultCard.classList.add('active');

  } catch (err) {
    errorBox.classList.add('active');
    document.getElementById('errorText').textContent = err.message || 'Terjadi kesalahan. Coba lagi.';
  } finally {
    downloadBtn.disabled = false;
    document.getElementById('btnText').textContent = 'Unduh';
    hideProgress();
  }
}

function openStoryModal() {
  const modal = document.getElementById('storyModal');
  modal.classList.add('active');
  const saved = localStorage.getItem('ig_sessionid');
  if (saved) document.getElementById('sessionidInput').value = saved;
  document.getElementById('storyUsernameInput').focus();
}

function closeStoryModal() {
  document.getElementById('storyModal').classList.remove('active');
  document.getElementById('storyResult').style.display = 'none';
  document.getElementById('storyError').style.display = 'none';
  document.getElementById('storyUsernameInput').value = '';
}

function toggleSessionHelp() {
  const help = document.getElementById('sessionHelp');
  help.style.display = help.style.display === 'none' ? 'block' : 'none';
}

async function fetchStory() {
  const username = document.getElementById('storyUsernameInput').value.trim().replace('@', '');
  const sessionid = document.getElementById('sessionidInput').value.trim();
  const storyError = document.getElementById('storyError');
  const storyResult = document.getElementById('storyResult');

  if (!username) {
    storyError.textContent = 'Masukkan username Instagram.';
    storyError.style.display = 'block';
    return;
  }
  if (!sessionid) {
    storyError.textContent = 'Session ID diperlukan untuk mengakses story.';
    storyError.style.display = 'block';
    return;
  }

  storyError.style.display = 'none';
  storyResult.style.display = 'none';

  const btn = document.getElementById('fetchStoryBtn');
  const origText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span> Mencari...';
  showProgress();

  localStorage.setItem('ig_sessionid', sessionid);
  currentStoryUsername = username;

  try {
    const res = await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, sessionid })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengambil story.');

    currentStories = data.stories;
    renderStories(data);

  } catch (err) {
    storyError.textContent = err.message || 'Terjadi kesalahan.';
    storyError.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = origText;
    hideProgress();
  }
}

function renderStories(data) {
  const storyResult = document.getElementById('storyResult');
  const storyGrid = document.getElementById('storyGrid');
  const storyAuthorName = document.getElementById('storyAuthorName');
  const storyAuthorHandle = document.getElementById('storyAuthorHandle');
  const storyAvatar = document.getElementById('storyAvatar');

  storyAuthorName.textContent = data.author || data.username;
  storyAuthorHandle.textContent = `@${data.username}`;
  if (data.avatar) {
    storyAvatar.src = proxyImg(data.avatar, 'story_avatar.jpg');
    storyAvatar.style.display = '';
  } else {
    storyAvatar.style.display = 'none';
  }

  storyGrid.innerHTML = '';
  data.stories.forEach((story, i) => {
    const item = document.createElement('div');
    item.className = 'img-item';
    const thumbSrc = story.thumb ? proxyImg(story.thumb, `story_thumb_${i}.jpg`) : '';
    const badgeHtml = story.isVideo
      ? `<span class="thumb-type">VIDEO</span>`
      : '';
    item.innerHTML = `
      ${thumbSrc ? `<img src="${thumbSrc}" alt="Story ${i + 1}" loading="lazy" onerror="this.parentElement.style.background='#f0e8f5'"/>` : `<div style="width:100%;height:100%;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">${story.isVideo ? '🎬' : '🖼️'}</div>`}
      ${badgeHtml}
      <button class="img-overlay" onclick="downloadStory(${i})"><span>Unduh</span></button>
    `;
    storyGrid.appendChild(item);
  });

  storyResult.style.display = 'block';
}

async function downloadStory(index) {
  const story = currentStories[index];
  if (!story || !story.url) return;
  const ext = story.isVideo ? 'mp4' : 'jpg';
  const filename = `${currentStoryUsername}_story${index + 1}.${ext}`;
  showProgress();
  try {
    const response = await fetch(proxyUrl(story.url, filename));
    const blob = await response.blob();
    saveBlobAsFile(blob, filename);
  } catch (e) {
    window.open(proxyUrl(story.url, filename), '_blank');
  } finally {
    hideProgress();
  }
}

async function downloadAllStories() {
  if (!currentStories.length) return;
  const btn = document.getElementById('dlAllStoriesBtn');
  const origText = btn.textContent;
  btn.textContent = 'Menyiapkan...';
  btn.disabled = true;
  showProgress();

  const imageUrls = currentStories
    .filter(s => !s.isVideo)
    .map(s => s.url)
    .filter(Boolean);

  try {
    if (imageUrls.length > 0) {
      const response = await fetch('/api/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: imageUrls, username: currentStoryUsername })
      });
      if (response.ok) {
        const blob = await response.blob();
        saveBlobAsFile(blob, `${currentStoryUsername}_stories.zip`);
      }
    }
    for (let i = 0; i < currentStories.length; i++) {
      const story = currentStories[i];
      if (story.isVideo && story.url) {
        await new Promise(r => setTimeout(r, 400));
        const filename = `${currentStoryUsername}_story${i + 1}.mp4`;
        try {
          const r = await fetch(proxyUrl(story.url, filename));
          const bl = await r.blob();
          saveBlobAsFile(bl, filename);
        } catch {
          window.open(proxyUrl(story.url, filename), '_blank');
        }
      }
    }
  } catch (e) {
    for (let i = 0; i < currentStories.length; i++) {
      await downloadStory(i);
      await new Promise(r => setTimeout(r, 400));
    }
  } finally {
    btn.textContent = origText;
    btn.disabled = false;
    hideProgress();
  }
}

document.addEventListener('click', e => {
  const modal = document.getElementById('storyModal');
  if (e.target === modal) closeStoryModal();
});