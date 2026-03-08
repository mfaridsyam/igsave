const urlInput = document.getElementById('urlInput');
const downloadBtn = document.getElementById('downloadBtn');
const errorBox = document.getElementById('errorBox');
const resultCard = document.getElementById('resultCard');
const progressBar = document.getElementById('progressBar');

let currentImages = [];
let currentUsername = 'unknown';

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
  return '/api/proxy?url=' + encodeURIComponent(url) + '&filename=' + encodeURIComponent(filename);
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
    item.innerHTML = `
      <img src="${imgUrl}" alt="Foto ${i + 1}" loading="lazy" onerror="this.style.display='none'"/>
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

    document.getElementById('resCover').src = v.cover || '';
    document.getElementById('resAvatar').src = v.avatar || '';
    document.getElementById('resAuthor').textContent = v.author || '';
    document.getElementById('resHandle').textContent = v.authorUsername ? `@${v.authorUsername}` : '';
    document.getElementById('resTitle').textContent = v.title || '';
    document.getElementById('resType').textContent = v.type || '';
    document.getElementById('resLikes').textContent = formatNum(v.likes) + ' suka';
    document.getElementById('resComments').textContent = formatNum(v.comments) + ' komentar';

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