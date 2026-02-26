// ===============================
// Redirect if already logged in
// ===============================
// async function redirectIfLoggedIn() {
//   try {
//     const { data: { session } } = await supabaseClient.auth.getSession();
//     if (!session) return;

//     const { data: profile } = await supabaseClient
//       .from("profiles")
//       .select("role, status")
//       .eq("id", session.user.id)
//       .single();

//     if (!profile) return;

//     if (profile.status !== "Active") {
//       await supabaseClient.auth.signOut();
//       return;
//     }

//     if (profile.role === "admin") {
//       window.location.href = "admintor.html";
//     }
//     else if (profile.role === "sales") {
//       window.location.href = "index.html";
//     }

//   } catch (error) {
//     console.error("Error checking session:", error);
//   }
// }

// redirectIfLoggedIn();

// ===============================
// Redirect if already logged in
// ===============================
async function redirectIfLoggedIn() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role, status")
      .eq("id", session.user.id)
      .single();

    if (!profile) return;

    if (profile.status !== "Active") {
      await supabaseClient.auth.signOut();
      return;
    }

    // 🔥 Redirect ตาม Role
    if (profile.role === "admin") {
      window.location.href = "admintor.html";
    } else if (profile.role === "sales") {
      window.location.href = "index.html";
    } else if (profile.role === "manager") {
      window.location.href = "manager-dashboard.html";
    } else if (profile.role === "executive") {
      window.location.href = "executive-dashboard.html";
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

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const identifier = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!identifier || !password) {
      alert("กรุณากรอก Username/Email และรหัสผ่าน");
      return;
    }

    loginBtn.disabled = true;
    loginBtn.classList.add("loading");

    try {
      let emailToUse = identifier;

      // ถ้าไม่มี @ → แปลว่าเป็น username
      if (!identifier.includes("@")) {
        const { data: userData, error } = await supabaseClient
          .from("profiles")
          .select("email")
          .eq("username", identifier)
          .maybeSingle();

        if (error || !userData) {
          throw new Error("ไม่พบ Username นี้ในระบบ");
        }

        emailToUse = userData.email;
      }

      const { data: authData, error: loginError } =
        await supabaseClient.auth.signInWithPassword({
          email: emailToUse,
          password: password,
        });

      if (loginError) throw loginError;

      // ===============================
      // เช็ค role หลัง login
      // ===============================
      const { data: profile, error: roleError } = await supabaseClient
        .from("profiles")
        .select("role, status")
        .eq("id", authData.user.id)
        .single();

      if (roleError || !profile) {
        throw new Error("ไม่สามารถตรวจสอบสิทธิ์ได้");
      }

      if (profile.status !== "Active") {
        await supabaseClient.auth.signOut();
        throw new Error("บัญชีของคุณถูกระงับ");
      }

      // 🔥 Redirect ตาม Role
      if (profile.role === "admin") {
        window.location.href = "admintor.html";
      } else if (profile.role === "sales") {
        window.location.href = "index.html";
      } else if (profile.role === "manager") {
        window.location.href = "manager-dashboard.html";
      } else if (profile.role === "executive") {
        window.location.href = "executive-dashboard.html";
      } else {
        await supabaseClient.auth.signOut();
        throw new Error("คุณไม่มีสิทธิ์เข้าใช้งานระบบนี้");
      }
    } catch (err) {
      let errorMessage = err.message;

      if (err.message.includes("Invalid login credentials")) {
        errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      }

      alert("เข้าสู่ระบบไม่สำเร็จ: " + errorMessage);
    } finally {
      loginBtn.disabled = false;
      loginBtn.classList.remove("loading");
    }
  });
});
