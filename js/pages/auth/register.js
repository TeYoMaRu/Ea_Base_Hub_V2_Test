// ===============================
// register.js
// ===============================

async function handleRegister() {
  const email    = document.getElementById("reg-email").value.trim();
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  const fullname = document.getElementById("reg-fullname").value.trim();
  const phone    = document.getElementById("reg-phone").value.trim();
  const dept     = document.getElementById("reg-department").value;

  if (!fullname) {
    showError("กรุณากรอกชื่อ-นามสกุล");
    return;
  }

  const btn = document.getElementById("registerBtn");
  btn.disabled = true;
  btn.classList.add("loading");

  try {
    // 1. Check duplicate username
    const { data: existing } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (existing) throw new Error("Username นี้ถูกใช้งานแล้ว");

    // 2. Sign up with Supabase Auth
    const { data: authData, error: signUpError } =
      await supabaseClient.auth.signUp({ email, password });

    if (signUpError) throw signUpError;

    // 3. Insert profile (status = Pending รอ admin approve)
    const { error: profileError } = await supabaseClient
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email,
        username,
        full_name: fullname,
        phone: phone || null,
        department: dept || null,
        role: "sales",          // default role
        status: "Pending",      // รอ admin อนุมัติ
      });

    if (profileError) throw profileError;

    // 4. Show success overlay → redirect
    const overlay = document.getElementById("register-overlay");
    overlay.classList.add("show");

    setTimeout(() => {
      window.location.href = "/pages/auth/login.html";
    }, 2200);

  } catch (err) {
    let msg = err.message;
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      msg = "อีเมลนี้ถูกใช้สมัครไปแล้ว";
    }
    showError("สมัครสมาชิกไม่สำเร็จ: " + msg);
    btn.disabled = false;
    btn.classList.remove("loading");
  }
}

function showError(msg) {
  document.querySelectorAll(".toast-error").forEach(e => e.remove());
  const toast = document.createElement("div");
  toast.className = "toast-error";
  toast.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
  document.querySelector(".register-card").prepend(toast);
  setTimeout(() => toast.remove(), 3500);
}