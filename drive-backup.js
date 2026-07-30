// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE DRIVE AUTO BACKUP (safety net — silent, JSON snapshot)
// เป็นตัวสำรองอิสระจาก Firestore: ถ้า Firebase project มีปัญหา ยังมีไฟล์
// สำรองล่าสุดอยู่ใน Google Drive ของคุณเสมอ
//
// ครั้งแรกต้องกดปุ่ม "เชื่อมต่อ Google Drive" หนึ่งครั้ง (ข้อจำกัดของ Google
// OAuth ในเบราว์เซอร์ — ต้องมี user gesture ตอนขอสิทธิ์ครั้งแรก) หลังจากนั้น
// แอปจะขอ token ใหม่แบบเงียบๆ เองทุกครั้งที่เปิดแอป ตราบใดที่ยัง login
// Google account เดิมอยู่ในเบราว์เซอร์/มือถือเครื่องนั้น
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const CLIENT_ID = window.GOOGLE_DRIVE_CLIENT_ID;
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FILE_NAME = 'abs_product_manager_backup.json';
  const MIN_INTERVAL = 5 * 60 * 1000; // throttle: at most once every 5 minutes

  let tokenClient = null;
  let accessToken = null;
  let fileId = localStorage.getItem('abs_drive_file_id') || null;
  let lastBackupAt = 0;
  let pendingProducts = null;
  let connected = localStorage.getItem('abs_drive_connected') === '1';

  function badge(text, ok) {
    const el = document.getElementById('absDriveStatus') || (() => {
      const d = document.createElement('div');
      d.id = 'absDriveStatus';
      d.style.cssText = 'position:fixed;bottom:38px;right:10px;z-index:99999;' +
        'font-family:monospace;font-size:11px;padding:5px 10px;border-radius:4px;' +
        'background:rgba(0,20,40,.9);color:#7df4ff;border:1px solid rgba(0,229,255,.4);' +
        'letter-spacing:.5px;cursor:pointer;transition:opacity .3s;opacity:.85';
      document.body.appendChild(d);
      d.addEventListener('click', () => connectDrive()); // always allow manual (re)connect, even if a silent attempt is stuck
      return d;
    })();
    el.textContent = text;
    el.style.color = ok ? '#39ff14' : '#7df4ff';
  }

  function loadGis(cb) {
    if (window.google && window.google.accounts) return cb();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function initTokenClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) {
          badge('Drive: เชื่อมต่อไม่สำเร็จ', false);
          return;
        }
        accessToken = resp.access_token;
        connected = true;
        localStorage.setItem('abs_drive_connected', '1');
        badge('Drive: เชื่อมต่อแล้ว', true);
        if (pendingProducts) doBackup(pendingProducts);
      }
    });
  }

  function connectDrive() {
    if (!CLIENT_ID || CLIENT_ID.indexOf('YOUR_CLIENT_ID') === 0) {
      badge('Drive: ยังไม่ได้ตั้งค่า Client ID', false);
      return;
    }
    loadGis(() => {
      if (!tokenClient) initTokenClient();
      tokenClient.requestAccessToken({ prompt: 'consent' });
    });
  }

  function silentReauth() {
    loadGis(() => {
      if (!tokenClient) initTokenClient();
      const before = accessToken;
      tokenClient.requestAccessToken({ prompt: '' }); // no UI if already granted
      // Google sometimes fails to call back at all if the silent request gets
      // blocked (e.g. third-party cookie restrictions) — don't leave the badge
      // stuck on "connecting" forever; offer a manual retry after a few seconds.
      setTimeout(() => {
        if (accessToken === before) badge('Drive: กดเพื่อเชื่อมต่อใหม่', false);
      }, 6000);
    });
  }

  async function findExistingFile() {
    const res = await fetch(
      "https://www.googleapis.com/drive/v3/files?q=name='" + FILE_NAME +
      "'+and+trashed=false&spaces=drive&fields=files(id,name)",
      { headers: { Authorization: 'Bearer ' + accessToken } }
    );
    const data = await res.json();
    if (data.files && data.files.length) return data.files[0].id;
    return null;
  }

  async function doBackup(products) {
    if (!accessToken) { pendingProducts = products; return; }
    try {
      if (!fileId) fileId = await findExistingFile();
      const metadata = { name: FILE_NAME, mimeType: 'application/json' };
      const boundary = 'absbackup';
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
        JSON.stringify(metadata) + `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
        JSON.stringify({ savedAt: new Date().toISOString(), products }) + `\r\n--${boundary}--`;

      const url = fileId
        ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await fetch(url, {
        method: fileId ? 'PATCH' : 'POST',
        headers: {
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
      });
      if (res.status === 401) { // token expired — refresh silently and retry once
        accessToken = null;
        silentReauth();
        pendingProducts = products;
        return;
      }
      const result = await res.json();
      if (result.id) {
        fileId = result.id;
        localStorage.setItem('abs_drive_file_id', fileId);
      }
      lastBackupAt = Date.now();
      pendingProducts = null;
      badge('Drive: สำรองล่าสุด ' + new Date().toLocaleTimeString('th-TH'), true);
    } catch (e) {
      console.error('[drive-backup] failed', e);
      badge('Drive: สำรองไม่สำเร็จ (จะลองใหม่)', false);
      pendingProducts = products;
    }
  }

  function backup(products) {
    if (!connected) { badge('Drive: กดเพื่อเชื่อมต่อ'); return; }
    if (Date.now() - lastBackupAt < MIN_INTERVAL) { pendingProducts = products; return; }
    if (!accessToken) { pendingProducts = products; silentReauth(); return; }
    doBackup(products);
  }

  // On load, if user connected before, try to silently get a fresh token
  // right away so the first backup this session doesn't need a click.
  if (connected && CLIENT_ID && CLIENT_ID.indexOf('YOUR_CLIENT_ID') !== 0) {
    badge('Drive: กำลังเชื่อมต่อ...');
    silentReauth();
  } else if (CLIENT_ID && CLIENT_ID.indexOf('YOUR_CLIENT_ID') !== 0) {
    badge('Drive: กดเพื่อเชื่อมต่อ');
  }

  window.ABSDriveBackup = { backup, connectDrive };
})();
