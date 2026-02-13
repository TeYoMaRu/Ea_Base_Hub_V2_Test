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
  if (togglePassword) {
  togglePassword.addEventListener("click", () => {

    const isHidden = passwordInput.type === "password";

    if (isHidden) {
      passwordInput.type = "text";
      togglePassword.innerText = "visibility_off";
    } else {
      passwordInput.type = "password";
      togglePassword.innerText = "visibility";
    }

  });
}

  // ===============================
  // Login Submit (รองรับ username / email)
  // ===============================
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    let identifier = emailInput.value.trim();
    const password = passwordInput.value;

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

      const { error: loginError } =
        await supabaseClient.auth.signInWithPassword({
          email: emailToUse,
          password
        });

      if (loginError) throw loginError;

      window.location.href = "index.html";

    } catch (err) {
      alert("เข้าสู่ระบบไม่สำเร็จ: " + err.message);
      loginBtn.disabled = false;
      loginBtn.textContent = "เข้าสู่ระบบ";
    }

  });

});

// ===============================
// Redirect if already logged in
// ===============================
async function redirectIfLoggedIn() {
  const { data: { session } } =
    await supabaseClient.auth.getSession();

  if (session) {
    window.location.href = "index.html";
  }
}

redirectIfLoggedIn();
