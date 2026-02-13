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

      passwordInput.type = isHidden ? "text" : "password";
      togglePassword.textContent = isHidden
        ? "visibility_off"
        : "visibility";

    });
  }

  // ===============================
  // Login Submit
  // ===============================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      loginBtn.disabled = true;
      loginBtn.textContent = "กำลังเข้าสู่ระบบ...";

      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        alert(error.message);
        loginBtn.disabled = false;
        loginBtn.textContent = "เข้าสู่ระบบ";
        return;
      }

      const { data: profile } = await supabaseClient
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profile?.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "index.html";
      }
    });
  }

});


// =======================================
// LOGIN WITH EMAIL OR USERNAME
// =======================================
async function handleLogin(e) {
    e.preventDefault();

    const identifier = document.getElementById("email").value.trim(); 
    // ช่อง input เดิม แต่ตอนนี้รับได้ทั้ง email หรือ username

    const password = document.getElementById("password").value;

    try {

        let emailToUse = identifier;

        // ==========================================
        // ถ้าไม่มี @ → แปลว่าเป็น username
        // ==========================================
        if (!identifier.includes("@")) {

            // ค้นหา email จาก profiles table
            const { data, error } = await supabaseClient
                .from("profiles")
                .select("id")
                .eq("username", identifier)
                .single();

            if (error || !data) {
                throw new Error("ไม่พบ Username นี้");
            }

            // ดึง email จาก auth.users ผ่าน getUserById
            const { data: userData, error: userError } =
                await supabaseClient.auth.admin.getUserById(data.id);

            if (userError || !userData.user) {
                throw new Error("ไม่พบข้อมูลผู้ใช้");
            }

            emailToUse = userData.user.email;
        }

        // ==========================================
        // LOGIN ด้วย email จริง
        // ==========================================
        const { error: loginError } =
            await supabaseClient.auth.signInWithPassword({
                email: emailToUse,
                password: password
            });

        if (loginError) throw loginError;

        // เข้าสู่ระบบสำเร็จ
        window.location.href = "index.html";

    } catch (err) {
        alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
    }
}
