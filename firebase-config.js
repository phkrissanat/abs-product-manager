// ═══════════════════════════════════════════════════════════════════════════
// ใส่ค่า config ของคุณตรงนี้ที่เดียว ไม่ต้องแก้ไฟล์อื่นเลย
// ═══════════════════════════════════════════════════════════════════════════

// 1) Firebase config — คัดลอกจาก Firebase Console:
//    Project settings > General > Your apps > SDK setup and configuration
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCQd1jABU9OuT_V5ra9h2nM2saJh7TmHiM",
  authDomain: "abs-product-manager.firebaseapp.com",
  projectId: "abs-product-manager",
  storageBucket: "abs-product-manager.firebasestorage.app",
  messagingSenderId: "494340429257",
  appId: "1:494340429257:web:b2e4a3cad585bb46f28418"
};

// 2) เข้าสู่ระบบ: ไม่ต้องใส่อีเมล/รหัสผ่านในไฟล์นี้ — ปลอดภัยกว่าเวลา push
//    ขึ้น GitHub แบบ public repo เพราะไม่มีรหัสผ่านติดไปกับโค้ด
//    เปิดแอปครั้งแรกในแต่ละเครื่อง จะมีหน้าให้กรอกอีเมล/รหัสผ่านเอง
//    ต้องเป็นอีเมล/รหัสผ่านของบัญชีที่มีอยู่แล้วใน Firebase Authentication
//    เท่านั้น (ระบบไม่สร้างบัญชีใหม่ให้อัตโนมัติอีกต่อไป — ป้องกันไม่ให้
//    คนอื่นกรอกอะไรก็ได้แล้วเข้าระบบได้)

// 3) Google OAuth Client ID สำหรับสำรองไฟล์ขึ้น Google Drive
//    สร้างที่ Google Cloud Console > APIs & Services > Credentials
//    > Create Credentials > OAuth client ID > Web application
//    ต้องเพิ่ม URL ที่จะใช้เปิดแอป (เช่น https://yourname.github.io) ใน
//    "Authorized JavaScript origins"
window.GOOGLE_DRIVE_CLIENT_ID = "494340429257-29n3u6cvllo1lpv7824vu2f9f1q8oh5a.apps.googleusercontent.com";

// 4) Owner UID — สำหรับ readonly.html เท่านั้น (ให้เปิดดูได้โดยไม่ต้อง login)
//    หาได้ที่ Firebase Console > Authentication > Users > คอลัมน์ "User UID"
//    (แถวของอีเมลที่ใช้ login หลัก) คัดลอกมาวางแทนที่ YOUR_UID ด้านล่าง
window.ABS_OWNER_UID = "YOUR_UID"; // ⚠️ TODO ยังไม่ได้ใส่ค่าจริง — ถ้าเป็นแบบนี้ตอน deploy จริง readonly.html จะไม่มีข้อมูลขึ้นเลย
