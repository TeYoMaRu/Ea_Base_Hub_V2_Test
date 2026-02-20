// ===============================
// auth.js
// ใช้ supabaseClient จาก supabaseClient.js
// ===============================

// ===============================
// LOGIN
// ===============================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    const msg = document.getElementById("message");

    if (error) {
      msg.innerText = error.message;
      msg.style.color = "red";
    } else {
      msg.innerText = "Login successful!";
      msg.style.color = "green";
      window.location.href = "index.html";
    }
  });
}

// ===============================
// REGISTER
// ===============================
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("regEmail").value;
    const password = document.getElementById("regPassword").value;
    const username = document.getElementById("username").value;

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    const msg = document.getElementById("regMessage");

    if (error) {
      msg.innerText = error.message;
      msg.style.color = "red";
    } else {
      msg.innerText = "Registration successful! Please check email.";
      msg.style.color = "green";
    }
  });
}

// ===============================
// Protect Page by Role
// ===============================
async function protectPage(allowedRoles = []) {

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("role, status")
    .eq("id", session.user.id)
    .single();

  if (error || !profile) {
    window.location.href = "login.html";
    return;
  }

  if (profile.status !== "Active") {
    await supabaseClient.auth.signOut();
    window.location.href = "login.html";
    return;
  }

  // ถ้า role ไม่อยู่ใน allowedRoles
  if (!allowedRoles.includes(profile.role)) {
    window.location.href = "login.html";
  }
}

// ===============================
// LOGOUT
// ===============================
async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}
