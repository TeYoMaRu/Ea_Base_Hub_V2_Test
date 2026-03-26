// ======================================================
// auth.js (FIXED VERSION)
// ไฟล์นี้ใช้สำหรับจัดการระบบ Authentication ของระบบ
// เช่น Login / Register / Protect Page / Logout
// โดยใช้ Supabase Authentication
// ต้องโหลด supabaseClient.js ก่อนไฟล์นี้
// ======================================================

// ตรวจสอบว่ามี supabaseClient หรือยัง
if (typeof supabaseClient === 'undefined') {
  console.error('❌ supabaseClient ไม่พร้อมใช้งาน! ตรวจสอบว่าโหลด supabaseClient.js ก่อนหรือยัง');
}

// ======================================================
// LOGIN SECTION
// ======================================================

// ดึง element form login จากหน้า HTML
// ถ้าไม่มี form นี้ แสดงว่าหน้านั้นไม่ใช่หน้า login
const loginForm = document.getElementById("loginForm");

// ตรวจสอบว่ามี loginForm อยู่ในหน้านี้หรือไม่
// เพื่อป้องกัน error ในหน้าที่ไม่มีฟอร์ม login
if (loginForm) {

  // เมื่อผู้ใช้กด submit form
  loginForm.addEventListener("submit", async (e) => {

    // ป้องกันการ reload หน้าเว็บแบบ default
    e.preventDefault();

    // ดึงค่าที่ผู้ใช้กรอกใน input email
    const email = document.getElementById("email").value;

    // ดึงค่ารหัสผ่านจาก input password
    const password = document.getElementById("password").value;

    // element สำหรับแสดงข้อความแจ้งเตือน
    const msg = document.getElementById("message");

    try {
      // แสดง loading message
      msg.innerText = "กำลังเข้าสู่ระบบ...";
      msg.style.color = "#666";

      // เรียก Supabase API เพื่อทำการ Login
      // signInWithPassword ใช้สำหรับ login ด้วย email/password
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      // ถ้ามี error จาก Supabase
      if (error) {
        // แสดงข้อความ error
        msg.innerText = "เข้าสู่ระบบไม่สำเร็จ: " + error.message;
        // เปลี่ยนสีข้อความเป็นสีแดง
        msg.style.color = "red";
        console.error("❌ Login error:", error);
        return;
      }

      // ถ้า login สำเร็จ
      console.log("✅ Login successful");
      msg.innerText = "เข้าสู่ระบบสำเร็จ!";
      msg.style.color = "green";

      // รอสักครู่เพื่อให้ user เห็นข้อความ
      setTimeout(() => {
        // redirect ไปหน้า index
        window.location.href = "/pages/index.html";
      }, 500);

    } catch (error) {
      console.error("❌ Unexpected login error:", error);
      msg.innerText = "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
      msg.style.color = "red";
    }
  });
}

// ======================================================
// REGISTER SECTION
// ======================================================

// ดึง form register จากหน้า HTML
const registerForm = document.getElementById("registerForm");

// ตรวจสอบว่าหน้านี้มี register form หรือไม่
if (registerForm) {

  // เมื่อผู้ใช้กด submit form
  registerForm.addEventListener("submit", async (e) => {

    // ป้องกันการ reload หน้า
    e.preventDefault();

    // ดึง email จาก input
    const email = document.getElementById("regEmail").value;

    // ดึง password จาก input
    const password = document.getElementById("regPassword").value;

    // ดึง username จาก input
    const username = document.getElementById("username").value;

    // element สำหรับแสดงข้อความ
    const msg = document.getElementById("regMessage");

    try {
      // แสดง loading message
      msg.innerText = "กำลังสมัครสมาชิก...";
      msg.style.color = "#666";

      // เรียก Supabase API เพื่อสมัครสมาชิก
      const { data, error } = await supabaseClient.auth.signUp({
        // email และ password สำหรับ auth
        email,
        password,

        // options สำหรับส่ง metadata เพิ่ม
        options: {
          // data จะถูกเก็บใน user_metadata
          data: { username }
        }
      });

      // ถ้าเกิด error
      if (error) {
        // แสดง error message
        msg.innerText = "สมัครสมาชิกไม่สำเร็จ: " + error.message;
        // เปลี่ยนสีข้อความเป็นแดง
        msg.style.color = "red";
        console.error("❌ Registration error:", error);
        return;
      }

      // สมัครสำเร็จ
      console.log("✅ Registration successful");
      msg.innerText = "สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมล";
      // สีเขียว
      msg.style.color = "green";

    } catch (error) {
      console.error("❌ Unexpected registration error:", error);
      msg.innerText = "เกิดข้อผิดพลาดในการสมัครสมาชิก";
      msg.style.color = "red";
    }
  });
}

// ======================================================
// PROTECT PAGE BY ROLE (🔥 FIXED VERSION)
// ======================================================
// ฟังก์ชันนี้ใช้สำหรับป้องกันหน้าเว็บ
// เช่น dashboard / admin page
// โดยตรวจสอบว่า user login หรือยัง
// และมี role ที่ได้รับอนุญาตหรือไม่
// ======================================================

async function protectPage(allowedRoles = []) {
  try {
    console.log("🔒 Checking page protection...");

    // ดึง session ของ user ที่ login อยู่
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    // ตรวจสอบ session error
    if (sessionError) {
      console.error("❌ Session error:", sessionError);
      window.location.href = "/pages/auth/login.html";
      return;
    }

    // ถ้าไม่มี session แปลว่ายังไม่ได้ login
    if (!session) {
      console.warn("⚠️ No active session");
      window.location.href = "/pages/auth/login.html";
      return;
    }

    console.log("✅ Session found for user:", session.user.email);

    // ดึงข้อมูล profile จาก table profiles
    // โดยใช้ user id จาก session
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*") // 🔥 FIX: ดึงทุก column เพื่อเก็บใน window.currentUser
      .eq("id", session.user.id)
      .single();

    // ถ้า query error หรือไม่พบ profile
    if (profileError) {
      console.error("❌ Profile error:", profileError);
      window.location.href = "/pages/auth/login.html";
      return;
    }

    if (!profile) {
      console.error("❌ Profile not found");
      window.location.href = "/pages/auth/login.html";
      return;
    }

    console.log("✅ Profile found:", profile);

    // 🔥 FIX: Set window.currentUser ก่อน!
    window.currentUser = {
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name || null,
      display_name: profile?.display_name || profile?.full_name || session.user.email,
      area: profile?.area || null,
      position: profile?.position || null,
      department: profile?.department || null,
      phone: profile?.phone || null,
      role: profile?.role || "user",
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null,
      address: profile?.address || null,
      manager_id: profile?.manager_id || null,
      status: profile?.status || "active"
    };

    console.log("✅ window.currentUser set:", window.currentUser);

    // ตรวจสอบสถานะ user
    // ถ้า user ไม่ใช่ Active (ตรวจสอบทั้ง "Active" และ "active")
    if (profile.status && profile.status.toLowerCase() !== "active") {
      console.warn("⚠️ User status is not active:", profile.status);
      
      // logout user
      await supabaseClient.auth.signOut();

      // แสดง alert
      alert("บัญชีของคุณถูกระงับการใช้งาน");

      // redirect ไป login
      window.location.href = "/pages/auth/login.html";
      return;
    }

    // ตรวจสอบ role
    // allowedRoles คือ array เช่น ["admin","manager"]
    if (allowedRoles.length > 0) {
      // ถ้า role ของ user ไม่อยู่ใน allowedRoles
      if (!allowedRoles.map(r => r.toLowerCase()).includes((profile.role || '').toLowerCase())) {
        console.warn("⚠️ User role not allowed:", profile.role);
        
        // แสดง alert
        alert("คุณไม่มีสิทธิ์เข้าถึงหน้านี้");

        // redirect ไปหน้า index หรือ login
        window.location.href = "/pages/auth/login.html";
        return;
      }
    }

    console.log("✅ Page protection passed");

    // 🔥 FIX: เรียก userService functions แยกกัน แทนที่จะเรียก initUserService
    if (typeof updateUserNameDisplay === 'function') {
      updateUserNameDisplay();
    }

    if (typeof applyPermissionBasedUI === 'function') {
      applyPermissionBasedUI();
    }

    if (typeof autoFillUserAttributes === 'function') {
      autoFillUserAttributes();
    }

  } catch (error) {
    console.error("❌ protectPage error:", error);
    window.location.href = "/pages/auth/login.html";
  }
}

// ======================================================
// LOGOUT
// ======================================================
// ฟังก์ชัน logout ใช้สำหรับออกจากระบบ
// ======================================================

async function logout() {
  try {
    console.log("🚪 Logging out...");

    // เรียก Supabase เพื่อ sign out
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("❌ Logout error:", error);
    }

    // ล้าง user data
    if (typeof window.currentUser !== 'undefined') {
      window.currentUser = {
        id: null,
        email: null,
        full_name: null,
        display_name: null,
        area: null,
        position: null,
        department: null,
        phone: null,
        role: null,
        created_at: null,
        updated_at: null
      };
    }

    console.log("✅ Logged out successfully");

    // redirect กลับหน้า login
    window.location.href = "/pages/auth/login.html";

  } catch (error) {
    console.error("❌ Unexpected logout error:", error);
    // ถึงแม้จะเกิด error ก็ redirect ไป login
    window.location.href = "/pages/auth/login.html";
  }
}

// ======================================================
// 🔍 CHECK AUTH STATUS
// ======================================================
// ตรวจสอบสถานะ authentication ปัจจุบัน
// ======================================================

async function checkAuthStatus() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      console.log("✅ User is authenticated:", session.user.email);
      return true;
    } else {
      console.log("ℹ️ User is not authenticated");
      return false;
    }
  } catch (error) {
    console.error("❌ checkAuthStatus error:", error);
    return false;
  }
}

// ======================================================
// 📦 EXPORT (ถ้าใช้ ES6 modules)
// ======================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    protectPage,
    logout,
    checkAuthStatus
  };
}

console.log("✅ auth.js loaded");