// ===============================
// Supabase Config
// ===============================
const SUPABASE_URL = 'https://vhazgytcfvjhhikiqpwm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoYXpneXRjZnZqaGhpa2lxcHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NjA1MjgsImV4cCI6MjA4NjIzNjUyOH0.wHHUPop0xMrUgX6X8Jkk-fahVfIMW-iYx4NT0zg5lxM';

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===============================
// Redirect if already logged in
// ===============================
async function redirectIfLoggedIn() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      window.location.href = "index.html";
    }
  } catch (error) {
    console.error("Error checking session:", error);
  }
}

// เรียกใช้ก่อน DOMContentLoaded
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

        // ถ้าไม่มี @ → แปลว่าเป็น username ต้องแปลงเป็น email ก่อน
        if (!identifier.includes("@")) {
          console.log("กำลังค้นหา email จาก username:", identifier);

          const { data, error } = await supabaseClient
            .from("profiles")
            .select("email")
            .eq("username", identifier)
            .maybeSingle(); // ใช้ maybeSingle แทน single เพื่อไม่ให้ error ถ้าไม่เจอ

          if (error) {
            console.error("Error querying profiles:", error);
            throw new Error("เกิดข้อผิดพลาดในการค้นหา Username");
          }

          if (!data) {
            throw new Error("ไม่พบ Username นี้ในระบบ");
          }

          emailToUse = data.email;
          console.log("พบ email:", emailToUse);
        }

        // ตรวจสอบว่า emailToUse มีค่า
        if (!emailToUse) {
          throw new Error("ไม่พบข้อมูล Email");
        }

        console.log("กำลังเข้าสู่ระบบด้วย email:", emailToUse);

        // Login with email
        const { data: authData, error: loginError } =
          await supabaseClient.auth.signInWithPassword({
            email: emailToUse,
            password: password
          });

        if (loginError) {
          console.error("Login error:", loginError);
          throw loginError;
        }

        console.log("เข้าสู่ระบบสำเร็จ:", authData);

        // เปลี่ยนหน้าเมื่อ login สำเร็จ
        window.location.href = "index.html";

      } catch (err) {
        console.error("Login error:", err);
        
        // แสดง error message ที่เข้าใจง่าย
        let errorMessage = err.message;
        
        if (err.message.includes("Invalid login credentials")) {
          errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
        } else if (err.message.includes("Email not confirmed")) {
          errorMessage = "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
        }
        
        alert("เข้าสู่ระบบไม่สำเร็จ: " + errorMessage);
        
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "เข้าสู่ระบบ";
      }
    });
  }

});