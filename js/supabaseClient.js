// ===============================
// SUPABASE CLIENT SETUP
// ===============================

// สร้างตัวแปร global สำหรับเรียกใช้ได้ทุกหน้า
const supabaseClient = supabase.createClient(
  "https://vhazgytcfvjhhikiqpwm.supabase.co", // URL โปรเจคของคุณ
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZoYXpneXRjZnZqaGhpa2lxcHdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NjA1MjgsImV4cCI6MjA4NjIzNjUyOH0.wHHUPop0xMrUgX6X8Jkk-fahVfIMW-iYx4NT0zg5lxM" // ใส่ anon key ของคุณตรงนี้
);
