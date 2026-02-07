// ==============================
// อ่านข้อมูลจาก localStorage
// ถ้าไม่มีข้อมูลเลย ให้เป็น array ว่าง
// ==============================
const trips = JSON.parse(localStorage.getItem("trips")) || [];
const claims = JSON.parse(localStorage.getItem("claims")) || [];

// ==============================
// หา element ที่จะแสดงผล
// ==============================
const tripCountEl = document.getElementById("tripCount");
const claimCountEl = document.getElementById("claimCount");
const totalCostEl = document.getElementById("totalCost");

// ==============================
// คำนวณยอดค่าใช้จ่ายรวม
// ==============================
let totalCost = 0;

// วนข้อมูล Trip ทีละรายการ
trips.forEach(trip => {
  totalCost += Number(trip.cost);
});

// ==============================
// แสดงผลบนหน้า Home
// ==============================
tripCountEl.textContent = "จำนวน Trip: " + trips.length;
claimCountEl.textContent = "จำนวน Claim: " + claims.length;
totalCostEl.textContent = "ยอดค่าใช้จ่ายรวม: " + totalCost;

// ==============================
// ล้างข้อมูลทั้งหมดที่เราใช้ในระบบ
// ==============================
function resetData() {

  // ถามผู้ใช้ก่อนลบ เพื่อป้องกันกดพลาด
  const confirmReset = confirm(
    "คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด?\nข้อมูล Trip และ Claim จะหายถาวร"
  );

  // ถ้ากด Cancel ให้หยุดการทำงานทันที
  if (!confirmReset) return;

  // ลบข้อมูลเฉพาะ key ที่เราใช้
  localStorage.removeItem("trips");
  localStorage.removeItem("claims");

  // รีเฟรชหน้า เพื่อให้ข้อมูลบนจออัปเดต
  location.reload();
}
