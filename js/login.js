// ===============================
<<<<<<< HEAD
// SUPABASE CONFIG
// ===============================
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_ANON_KEY";

const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// ===============================
// LOGIN FUNCTION
// ===============================
document.getElementById("loginForm")
.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const message = document.getElementById("message");

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

  if (error) {
    message.innerText = error.message;
    message.style.color = "red";
  } else {
    message.innerText = "Login successful!";
    message.style.color = "green";

    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 1000);
  }
=======
// Supabase Config
// ===============================
const SUPABASE_URL = 'https://vhazgytcfvjhhikiqpwm.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

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

>>>>>>> 4dfac8f (save before pull)
});
