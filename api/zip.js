import archiver from 'archiver';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { images, videos, files, username } = req.body;

  // Build unified file list
  let fileList = [];
  if (files && Array.isArray(files)) {
    fileList = files;
  } else {
    const imgs = Array.isArray(images) ? images : [];
    const vids = Array.isArray(videos) ? videos : [];
    const safeUser = (username || 'igsave').replace(/[^a-zA-Z0-9_]/g, '');
    imgs.forEach((url, i) => fileList.push({ url, filename: `${safeUser}_image${i + 1}.jpg` }));
    vids.forEach((url, i) => fileList.push({ url, filename: `${safeUser}_video${i + 1}.mp4` }));
  }

  if (!fileList.length) {
    return res.status(400).json({ error: 'No files provided' });
  }

  // Domain validation
  const allowedDomains = ['cdninstagram.com', 'fbcdn.net', 'instagram.com', 'scontent'];
  const invalidFile = fileList.find(f => f.url && !allowedDomains.some(d => f.url.includes(d)));
  if (invalidFile) {
    console.error('Blocked domain:', invalidFile.url.substring(0, 80));
    return res.status(403).json({ error: 'Domain not allowed' });
  }

  const safeUsername = (username || 'igsave').replace(/[^a-zA-Z0-9_]/g, '');

  try {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${safeUsername}_files.zip"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    for (const file of fileList) {
      if (!file.url) continue;
      try {
        const r = await fetch(file.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://www.instagram.com/',
            'Accept': '*/*',
          },
          redirect: 'follow',
        });
        if (!r.ok) {
          console.error(`Skip ${file.filename}: HTTP ${r.status}`);
          continue;
        }
        const buf = Buffer.from(await r.arrayBuffer());
        archive.append(buf, { name: file.filename });
      } catch (e) {
        console.error(`Error ${file.filename}:`, e.message);
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Zip error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to create zip: ' + err.message });
  }
}