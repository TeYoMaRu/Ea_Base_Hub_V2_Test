
// ===============================
// Redirect if already logged in
// ===============================
async function redirectIfLoggedIn() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile && profile.role === "admin") {
        window.location.href = "admin-dashboard.html";
      } else {
        await supabaseClient.auth.signOut();
      }
    }
  } catch (error) {
    console.error("Error checking session:", error);
  }
}


redirectIfLoggedIn();

// ===============================
// DOM Ready
// ===============================
document.addEventListener("DOMContentLoaded", () => {

  const loginForm = document.getElementById("loginForm");
  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");
  const togglePasswordBtn = document.getElementById("togglePassword");

  // ===============================
  // Toggle Password
  // ===============================
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      const iconSpan = togglePasswordBtn.querySelector('.material-symbols-outlined');

      if (isHidden) {
        passwordInput.type = "text";
        if (iconSpan) iconSpan.textContent = "visibility_off";
      } else {
        passwordInput.type = "password";
        if (iconSpan) iconSpan.textContent = "visibility";
      }
    });
  }

  // ===============================
  // Login Submit (รองรับ username / email)
  // ===============================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const identifier = emailInput.value.trim();
      const password = passwordInput.value.trim();

      // ตรวจสอบว่ากรอกข้อมูลครบหรือไม่
      if (!identifier || !password) {
        alert("กรุณากรอก Username/Email และรหัสผ่าน");
        return;
      }

      loginBtn.disabled = true;
      loginBtn.textContent = "กำลังเข้าสู่ระบบ...";

      try {
        let emailToUse = identifier;

        // ถ้าไม่มี @ → แปลว่าเป็น username
        if (!identifier.includes("@")) {
          console.log("🔍 ค้นหา email จาก username:", identifier);

          // ตรวจสอบว่ามีตาราง profiles หรือไม่
          const { data: profiles, error: profileError } = await supabaseClient
            .from("profiles")
            .select("*")
            .limit(1);

          if (profileError) {
            console.error("❌ Error accessing profiles table:", profileError);
            throw new Error("ไม่สามารถเข้าถึงตาราง profiles ได้ กรุณาติดต่อผู้ดูแลระบบ");
          }

          console.log("✅ สามารถเข้าถึงตาราง profiles ได้");

          // ค้นหา email จาก username
          const { data: userData, error: queryError } = await supabaseClient
            .from("profiles")
            .select("email, username")
            .eq("username", identifier)
            .maybeSingle();

          console.log("📊 ผลการค้นหา username:", { userData, queryError });

          if (queryError) {
            console.error("❌ Query error:", queryError);
            throw new Error("เกิดข้อผิดพลาดในการค้นหา Username");
          }

          if (!userData) {
            console.warn("⚠️ ไม่พบ username:", identifier);
            
            // ลองค้นหาว่ามี username อะไรบ้างในระบบ (สำหรับ debug)
            const { data: allUsers } = await supabaseClient
              .from("profiles")
              .select("username")
              .limit(5);
            
            console.log("📋 Username ที่มีในระบบ (5 รายการแรก):", allUsers);
            
            throw new Error("ไม่พบ Username นี้ในระบบ กรุณาตรวจสอบอีกครั้ง");
          }

          if (!userData.email) {
            console.error("❌ ไม่มีข้อมูล email ในโปรไฟล์:", userData);
            throw new Error("ข้อมูล Email ไม่ครบถ้วน กรุณาติดต่อผู้ดูแลระบบ");
          }

          emailToUse = userData.email;
          console.log("✅ พบ email:", emailToUse);
        } else {
          console.log("📧 ใช้ email โดยตรง:", identifier);
        }

        // ตรวจสอบอีกครั้งว่ามี email
        if (!emailToUse || emailToUse.trim() === "") {
          throw new Error("ไม่พบข้อมูล Email");
        }

        console.log("🔐 กำลังเข้าสู่ระบบด้วย email:", emailToUse);

        // Login with email
        const { data: authData, error: loginError } =
          await supabaseClient.auth.signInWithPassword({
            email: emailToUse,
            password: password
          });

        if (loginError) {
          console.error("❌ Login error:", loginError);
          throw loginError;
        }

        console.log("✅ เข้าสู่ระบบสำเร็จ!");

        // เปลี่ยนหน้าเมื่อ login สำเร็จ
        // ===============================
// เช็ค role หลัง login
// ===============================
const { data: profile, error: roleError } = await supabaseClient
  .from("profiles")
  .select("role")
  .eq("id", authData.user.id)
  .single();

if (roleError || !profile) {
  throw new Error("ไม่สามารถตรวจสอบสิทธิ์ได้");
}

if (profile.role === "admin") {
  window.location.href = "admintor.html";
} else {
  await supabaseClient.auth.signOut();
  throw new Error("คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้");
}


      } catch (err) {
        console.error("💥 Error:", err);
        
        let errorMessage = err.message;
        
        // แปลง error message เป็นภาษาไทย
        if (err.message.includes("Invalid login credentials")) {
          errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        } else if (err.message.includes("Email not confirmed")) {
          errorMessage = "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
        } else if (err.message.includes("missing email or phone")) {
          errorMessage = "ข้อมูล Email ไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง";
        }
        
        alert("เข้าสู่ระบบไม่สำเร็จ: " + errorMessage);
        
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "เข้าสู่ระบบ";
      }
    });
  }

});