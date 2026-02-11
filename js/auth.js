// ===============================
// SUPABASE CONFIG
// ===============================
const supabaseUrl = "YOUR_SUPABASE_URL";
const supabaseKey = "YOUR_ANON_KEY";

const { createClient } = supabase;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

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
      window.location.href = "dashboard.html";
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
        data: {
          username: username
        }
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
