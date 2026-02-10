// ===============================
// Supabase Client
// ===============================
const SUPABASE_URL = 'https://vhazgytcfvjhhikiqpwm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoYXpneXRjZnZqaGhpa2lxcHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NjA1MjgsImV4cCI6MjA4NjIzNjUyOH0.wHHUPop0xMrUgX6X8Jkk-fahVfIMW-iYx4NT0zg5lxM';

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ===============================
// Helper
// ===============================
const $ = id => document.getElementById(id);

// ===============================
// Alert
// ===============================
function showAlert(message, type = 'error') {
  const alert = $('alert');
  alert.textContent = message;
  alert.style.display = 'block';
  alert.style.color = type === 'error' ? '#c62828' : '#2e7d32';
}

// ===============================
// Login
// ===============================
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  const email = $('email').value.trim();
  const password = $('password').value;
  const btn = $('loginBtn');

  btn.disabled = true;
  btn.textContent = 'กำลังเข้าสู่ระบบ...';

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    showAlert(error.message);
    btn.disabled = false;
    btn.textContent = 'เข้าสู่ระบบ';
    return;
  }

  // ===============================
  // ดึง profile (role / username)
  // ===============================
  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  // ===============================
  // Redirect
  // ===============================
  if (profile?.role === 'admin') {
    window.location.href = 'admin.html';
  } else {
    window.location.href = 'index.html';
  }
});

// ===============================
// Auto Redirect if Logged In
// ===============================
// (async () => {
//   const { data } = await supabaseClient.auth.getUser();
//   if (data?.user) {
//     window.location.href = 'index.html';
//   }
// })();
