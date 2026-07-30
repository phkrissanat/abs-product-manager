// ═══════════════════════════════════════════════════════════════════════════
// CLOUD SYNC (Firebase Firestore)
// ทำงานคู่กับ localStorage เดิมของแอป — ไม่ได้แทนที่
// localStorage ยังเป็นตัวเก็บหลักที่ทำงานได้แม้ไม่มีเน็ต
// Firestore ใช้ sync ข้อมูลระหว่างมือถือกับเดสก์ท็อป (คนละเครื่อง)
// ═══════════════════════════════════════════════════════════════════════════
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  if (!cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    console.warn('[cloud-sync] ยังไม่ได้ตั้งค่า Firebase — แก้ไฟล์ firebase-config.js');
    window.ABSCloudSync = { push: () => {}, ready: false };
    return;
  }

  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch(() => {
    /* multiple tabs / unsupported browser — sync still works, just no offline cache */
  });

  const DEVICE_ID = (() => {
    let id = localStorage.getItem('abs_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('abs_device_id', id);
    }
    return id;
  })();

  let docRef = null;
  let pushTimer = null;
  let lastPushedAt = 0;
  let applyingRemote = false; // guard so remote updates don't re-trigger a push loop
  let statusEl = null;

  function ensureStatusBadge() {
    if (statusEl) return statusEl;
    statusEl = document.createElement('div');
    statusEl.id = 'absCloudStatus';
    statusEl.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99999;' +
      'font-family:monospace;font-size:11px;padding:5px 10px;border-radius:4px;' +
      'background:rgba(0,20,40,.9);color:#00e5ff;border:1px solid rgba(0,229,255,.4);' +
      'letter-spacing:.5px;pointer-events:none;transition:opacity .3s;opacity:.85';
    statusEl.textContent = 'เชื่อมต่อ...';
    document.body.appendChild(statusEl);
    return statusEl;
  }

  function setStatus(text, ok) {
    const el = ensureStatusBadge();
    el.textContent = text;
    el.style.borderColor = ok ? 'rgba(57,255,20,.5)' : 'rgba(255,170,0,.5)';
    el.style.color = ok ? '#39ff14' : '#ffaa00';
  }

  // ── Credentials: kept only in this device's localStorage, never in the
  // deployed files, so a public GitHub repo doesn't leak your password ──────
  function getStoredCreds() {
    return {
      email: localStorage.getItem('abs_sync_email') || '',
      password: localStorage.getItem('abs_sync_password') || ''
    };
  }
  function storeCreds(email, password) {
    localStorage.setItem('abs_sync_email', email);
    localStorage.setItem('abs_sync_password', password);
  }
  function clearStoredCreds() {
    localStorage.removeItem('abs_sync_email');
    localStorage.removeItem('abs_sync_password');
  }

  let modalEl = null;
  function removeLoginModal() {
    if (modalEl) { modalEl.remove(); modalEl = null; }
  }

  function showLoginModal(prefillEmail, errorMsg) {
    removeLoginModal();
    modalEl = document.createElement('div');
    modalEl.id = 'absLoginModal';
    modalEl.style.cssText = 'position:fixed;inset:0;z-index:100000;display:flex;' +
      'align-items:center;justify-content:center;background:rgba(0,5,12,.85);' +
      'font-family:"Sarabun",sans-serif;';
    modalEl.innerHTML = `
      <div style="width:min(340px,90vw);background:#030f1e;border:1px solid rgba(0,229,255,.4);
        border-radius:6px;padding:22px;box-shadow:0 0 40px rgba(0,229,255,.15)">
        <div style="font-family:monospace;color:#00e5ff;font-weight:700;letter-spacing:2px;
          font-size:16px;margin-bottom:6px">เข้าสู่ระบบซิงค์ข้อมูล</div>
        <div style="color:rgba(180,240,255,.7);font-size:13px;margin-bottom:16px;line-height:1.5">
          ใช้อีเมล/รหัสผ่านเดียวกันทุกเครื่อง เพื่อให้ข้อมูล sync กัน
          (เครื่องแรกที่ล็อกอินจะสร้างบัญชีนี้ให้อัตโนมัติ)
        </div>
        <input id="absLoginEmail" type="email" placeholder="อีเมล" value="${(prefillEmail || '').replace(/"/g, '&quot;')}"
          style="width:100%;padding:10px;margin-bottom:10px;background:rgba(0,229,255,.05);
          border:1px solid rgba(0,229,255,.3);border-radius:4px;color:#cdf4ff;font-size:14px" />
        <input id="absLoginPassword" type="password" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)"
          style="width:100%;padding:10px;margin-bottom:10px;background:rgba(0,229,255,.05);
          border:1px solid rgba(0,229,255,.3);border-radius:4px;color:#cdf4ff;font-size:14px" />
        ${errorMsg ? `<div style="color:#ff6688;font-size:12px;margin-bottom:10px">${errorMsg}</div>` : ''}
        <button id="absLoginSubmit" style="width:100%;padding:10px;background:linear-gradient(135deg,rgba(0,229,255,.2),rgba(0,100,160,.4));
          border:1px solid #00e5ff;border-radius:4px;color:#fff;font-family:monospace;
          font-weight:700;letter-spacing:1px;cursor:pointer;font-size:14px">เข้าสู่ระบบ</button>
      </div>`;
    document.body.appendChild(modalEl);
    const emailInput = modalEl.querySelector('#absLoginEmail');
    const pwInput = modalEl.querySelector('#absLoginPassword');
    const submit = () => {
      const email = emailInput.value.trim();
      const password = pwInput.value;
      if (!email || password.length < 6) {
        showLoginModal(email, 'กรอกอีเมลและรหัสผ่านอย่างน้อย 6 ตัวอักษร');
        return;
      }
      attemptSignIn(email, password);
    };
    modalEl.querySelector('#absLoginSubmit').addEventListener('click', submit);
    pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  }

  function attemptSignIn(email, password) {
    setStatus('กำลังเข้าสู่ระบบ...', false);
    auth.signInWithEmailAndPassword(email, password)
      .then((cred) => onAuthSuccess(cred, email, password))
      .catch((err) => {
        if (err.code === 'auth/user-not-found') {
          // First device to log in creates the account.
          auth.createUserWithEmailAndPassword(email, password)
            .then((cred) => onAuthSuccess(cred, email, password))
            .catch((err2) => showLoginModal(email, 'สร้างบัญชีไม่สำเร็จ: ' + err2.message));
        } else {
          showLoginModal(email, 'เข้าสู่ระบบไม่สำเร็จ: ' + err.message);
        }
      });
  }

  function onAuthSuccess(cred, email, password) {
    storeCreds(email, password);
    removeLoginModal();
    docRef = db.collection('abs_sync').doc(cred.user.uid);
    attachListener();
    setStatus('ซิงค์แล้ว', true);
  }

  function attachListener() {
    docRef.onSnapshot((snap) => {
      if (!snap.exists) {
        setStatus('ยังไม่มีข้อมูลบนคลาวด์', true);
        return;
      }
      const remote = snap.data();
      if (remote.updatedBy === DEVICE_ID) {
        setStatus('ซิงค์แล้ว', true);
        return; // this is an echo of our own write
      }
      if ((remote.updatedAt || 0) <= lastPushedAt) return; // not newer than what we have
      try {
        const remoteProducts = JSON.parse(remote.productsJson || '[]');
        applyingRemote = true;
        products = remoteProducts; // shared global `let products` from index.html's main script
        lastPushedAt = remote.updatedAt;
        localStorage.setItem('abs_products', remote.productsJson);
        if (typeof window.render === 'function') window.render();
        setStatus('อัปเดตจากอีกเครื่อง', true);
      } catch (e) {
        console.error('[cloud-sync] apply remote failed', e);
      } finally {
        applyingRemote = false;
      }
    }, (err) => {
      console.error('[cloud-sync] listener error', err);
      setStatus('ออฟไลน์ (จะซิงค์เมื่อมีเน็ต)', false);
    });
  }

  function push(products) {
    if (!docRef || applyingRemote) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      const now = Date.now();
      docRef.set({
        productsJson: JSON.stringify(products),
        updatedAt: now,
        updatedBy: DEVICE_ID
      }, { merge: true }).then(() => {
        lastPushedAt = now;
        setStatus('ซิงค์แล้ว', true);
      }).catch((e) => {
        console.error('[cloud-sync] push failed', e);
        setStatus('ซิงค์ไม่สำเร็จ (จะลองใหม่)', false);
      });
    }, 1200); // debounce so rapid edits don't spam writes
  }

  const stored = getStoredCreds();
  if (stored.email && stored.password) {
    setStatus('กำลังเข้าสู่ระบบ...', false);
    attemptSignIn(stored.email, stored.password);
  } else {
    showLoginModal();
  }

  window.ABSCloudSync = {
    push,
    get ready() { return !!docRef; },
    logout: () => { clearStoredCreds(); auth.signOut(); docRef = null; showLoginModal(); }
  };
})();
