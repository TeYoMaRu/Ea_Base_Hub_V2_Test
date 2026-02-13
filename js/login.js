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
  const togglePassword = document.getElementById("togglePassword");

  // ===============================
  // Toggle Password
  // ===============================
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";

      if (isHidden) {
        passwordInput.type = "text";
        togglePassword.textContent = "visibility_off";
      } else {
        passwordInput.type = "password";
        togglePassword.textContent = "visibility";
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
      const password = passwordInput.value;

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
          const { data, error } = await supabaseClient
            .from("profiles")
            .select("email")
            .eq("username", identifier)
            .single();

          if (error || !data) {
            throw new Error("ไม่พบ Username นี้");
          }

          emailToUse = data.email;
        }

        // Login with email
        const { data: authData, error: loginError } =
          await supabaseClient.auth.signInWithPassword({
            email: emailToUse,
            password: password
          });

        if (loginError) throw loginError;

        // เปลี่ยนหน้าเมื่อ login สำเร็จ
        window.location.href = "index.html";

      } catch (err) {
        console.error("Login error:", err);
        alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
      } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = "เข้าสู่ระบบ";
      }
    });
  }

});