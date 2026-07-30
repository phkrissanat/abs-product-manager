// ═══════════════════════════════════════════════════════════════════════════
// ใส่ค่า config ของคุณตรงนี้ที่เดียว ไม่ต้องแก้ไฟล์อื่นเลย
// ═══════════════════════════════════════════════════════════════════════════

// 1) Firebase config — คัดลอกจาก Firebase Console:
//    Project settings > General > Your apps > SDK setup and configuration
window.FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 2) เข้าสู่ระบบ: ไม่ต้องใส่อีเมล/รหัสผ่านในไฟล์นี้ — ปลอดภัยกว่าเวลา push
//    ขึ้น GitHub แบบ public repo เพราะไม่มีรหัสผ่านติดไปกับโค้ด
//    เปิดแอปครั้งแรกในแต่ละเครื่อง จะมีหน้าให้กรอกอีเมล/รหัสผ่านเอง
//    (ตั้งอีเมล/รหัสผ่านอะไรก็ได้ที่จำได้ — ใช้ตัวเดียวกันทุกเครื่องเพื่อ sync กัน
//    เครื่องแรกที่ล็อกอินจะสร้างบัญชีนี้ให้อัตโนมัติใน Firebase Authentication)

// 3) Google OAuth Client ID สำหรับสำรองไฟล์ขึ้น Google Drive
//    สร้างที่ Google Cloud Console > APIs & Services > Credentials
//    > Create Credentials > OAuth client ID > Web application
//    ต้องเพิ่ม URL ที่จะใช้เปิดแอป (เช่น https://yourname.github.io) ใน
//    "Authorized JavaScript origins"
window.GOOGLE_DRIVE_CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";
