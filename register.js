// ===============================
// Supabase Client
// ===============================
const supabaseClient = supabase.createClient(
  "https://vhazgytcfvjhhikiqpwm.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoYXpneXRjZnZqaGhpa2lxcHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NjA1MjgsImV4cCI6MjA4NjIzNjUyOH0.wHHUPop0xMrUgX6X8Jkk-fahVfIMW-iYx4NT0zg5lxM"
);

// ===============================
// Helper
// ===============================
const $ = id => document.getElementById(id);

// ===============================
// Validation State
// ===============================
const validation = {
  email: false,
  username: false,
  displayName: false,
  password: false,
  confirmPassword: false
};

// ===============================
// Validation
// ===============================
function validateEmail() {
  validation.email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('email').value);
}

function validateUsername() {
  validation.username = /^[a-zA-Z0-9_]+$/.test($('username').value);
}

function validateDisplayName() {
  validation.displayName = $('displayName').value.trim().length > 0;
}

function validatePassword() {
  const p = $('password').value;
  validation.password =
    p.length >= 8 &&
    /[A-Z]/.test(p) &&
    /[a-z]/.test(p) &&
    /\d/.test(p);
}

function validateConfirmPassword() {
  validation.confirmPassword =
    $('password').value === $('confirmPassword').value &&
    $('confirmPassword').value !== '';
}

// ===============================
// Update Submit Button
// ===============================
function updateSubmit() {
  $('submitBtn').disabled = !Object.values(validation).every(Boolean);
}

// ===============================
// Event Binding
// ===============================
['email','username','displayName','password','confirmPassword'].forEach(id => {
  $(id).addEventListener('input', () => {
    validateEmail();
    validateUsername();
    validateDisplayName();
    validatePassword();
    validateConfirmPassword();
    updateSubmit();
  });
});

// ===============================
// Register
// ===============================
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();

  const email = $('email').value.trim();
  const password = $('password').value;
  const username = $('username').value.trim();
  const displayName = $('displayName').value.trim();

  // 1. Sign up
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password
  });

  if (error) {
    alert(error.message);
    return;
  }

  // 2. Insert profile
  const { error: profileError } = await supabaseClient
    .from('profiles')
    .insert({
      id: data.user.id,
      email,
      username,
      display_name: displayName
    });

  if (profileError) {
    alert('สมัครสำเร็จ แต่บันทึกข้อมูลผู้ใช้ไม่สำเร็จ');
    return;
  }

  alert('สมัครสมาชิกสำเร็จ 🎉 กรุณายืนยันอีเมล');
  window.location.href = 'login.html';
});
