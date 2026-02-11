// ===============================
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
});
