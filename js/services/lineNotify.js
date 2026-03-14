// /js/services/lineNotify.js
// =====================================================
// เรียก Supabase Edge Function เพื่อส่ง LINE notify
// =====================================================

export async function sendLineNotify(data) {
  try {
    const res = await fetch(
      "https://vhazgytcfvjhihkiqpwm.supabase.co/functions/v1/send-line-notify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }
    );

    const result = await res.json();
    console.log("✅ LINE Notify response:", result);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(result)}`);
    }

    return result;
  } catch (err) {
    // log แต่ไม่ throw ออกไป — ไม่ block UI ถ้า notify ล้มเหลว
    console.error("❌ sendLineNotify failed:", err.message);
    throw err; // ให้ caller จัดการเอง (formClaim.js ใช้ .catch() อยู่แล้ว)
  }
}