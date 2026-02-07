/*************************************************
 * HOME.JS
 * ใช้สำหรับหน้า Home (Dashboard)
 * - อ่านข้อมูลจาก localStorage
 * - แสดง "รายงานของฉัน"
 * - แสดงตัวนับ Trip / Claim
 * - แสดงสถานะการเขียนรายงานรายสัปดาห์
 * - ควบคุม Hamburger menu
 *************************************************/


/* =================================================
   Safe LocalStorage Reader
   -------------------------------------------------
   ใช้แทน JSON.parse ตรง ๆ
   - กัน error
   - ถ้าไม่ใช่ array → คืน []
================================================= */
function getStorageArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn("อ่าน localStorage ไม่ได้:", key);
    return [];
  }
}


/* =================================================
   อ่านข้อมูลหลักจาก localStorage
   -------------------------------------------------
   ⚠️ ประกาศแค่ครั้งเดียว ห้ามซ้ำ
================================================= */
const reports = getStorageArray("reports"); // ใบรายงาน
const trips   = getStorageArray("trips");   // ฟอร์ม trip
const claims  = getStorageArray("claims");  // เคลม


/* =================================================
   Render : "รายงานของฉัน"
   -------------------------------------------------
   - รวม report + trip
   - เรียงจากใหม่ → เก่า
   - คลิกชื่อเพื่อแก้ไข
================================================= */
const listEl = document.getElementById("myReportList");

if (listEl) {
  listEl.innerHTML = "";

  // รวมข้อมูลหลายประเภทให้เป็นรูปแบบเดียว
  const items = [
    ...reports.map(r => ({
      type: "report",
      title: r.title || "รายงาน (ยังไม่ตั้งชื่อ)",
      date: r.date,
      link: `report.html?id=${r.id}`,
      id: r.id
    })),
    ...trips.map(t => ({
      type: "trip",
      title: `Trip : ${t.place || "-"}`,
      date: t.date,
      link: `trip.html?id=${t.id}`,
      id: t.id
    }))
  ];

  // ถ้าไม่มีข้อมูล
  if (items.length === 0) {
    listEl.innerHTML =
      `<p style="color:#999">ยังไม่มีรายงานหรือฟอร์มที่บันทึกไว้</p>`;
  } else {
    // เรียงใหม่ → เก่า
    items
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach(item => {
        const div = document.createElement("div");
        div.className = "report-item";

        div.innerHTML = `
          <div class="report-left">
            📄
            <a href="${item.link}">
              ${item.title}
            </a>
          </div>

          <div class="report-actions">
            <button title="แก้ไข" onclick="location.href='${item.link}'">✏️</button>
            <button title="ลบ" onclick="deleteItem('${item.type}', '${item.id}')">🗑️</button>
          </div>
        `;

        listEl.appendChild(div);
      });
  }
}


/* =================================================
   Delete Item (Report / Trip)
   -------------------------------------------------
   ลบข้อมูลออกจาก localStorage
================================================= */
function deleteItem(type, id) {
  if (!confirm("ต้องการลบรายการนี้ใช่หรือไม่?")) return;

  const key = type === "report" ? "reports" : "trips";
  const data = getStorageArray(key);

  const newData = data.filter(item => item.id !== id);
  localStorage.setItem(key, JSON.stringify(newData));

  // รีเฟรชหน้าเพื่อ render ใหม่
  location.reload();
}


/* =================================================
   Card Summary (ตัวเลขด้านบน)
================================================= */
const tripCountEl  = document.getElementById("tripCount");
const claimCountEl = document.getElementById("claimCount");

if (tripCountEl)  tripCountEl.textContent  = trips.length;
if (claimCountEl) claimCountEl.textContent = claims.length;


/* =================================================
   Reset Data (Admin / Debug)
================================================= */
function resetData() {
  if (!confirm("ล้างข้อมูลทั้งหมด?")) return;

  localStorage.removeItem("reports");
  localStorage.removeItem("trips");
  localStorage.removeItem("claims");

  location.reload();
}


/* =================================================
   Hamburger Menu (Mobile)
================================================= */
function toggleMenu() {
  const menu = document.querySelector(".menu");
  if (menu) menu.classList.toggle("show");
}


/* =================================================
   Report Progress (Weekly)
   -------------------------------------------------
   - ส่งรายงานสัปดาห์ละ 1 ครั้ง
   - แสดงจำนวนวันที่ผ่านไป
================================================= */

// วันที่เขียนรายงานล่าสุด (mock ก่อน)
let lastReportDate = localStorage.getItem("lastReportDate");

// ถ้าไม่เคยมี → ใช้วันนี้
if (!lastReportDate) {
  lastReportDate = new Date().toISOString();
  localStorage.setItem("lastReportDate", lastReportDate);
}

// คำนวณจำนวนวัน
const now  = new Date();
const last = new Date(lastReportDate);
const diffDays = Math.floor(
  (now - last) / (1000 * 60 * 60 * 24)
);

// แสดงจำนวนวัน
const reportDaysEl = document.getElementById("reportDays");
if (reportDaysEl) {
  reportDaysEl.textContent = diffDays;
}

// คำนวณ progress (7 วัน = 100%)
const progressPercent = Math.min((diffDays / 7) * 100, 100);
const progressFill = document.getElementById("reportProgress");

if (progressFill) {
  progressFill.style.width = progressPercent + "%";
}


// Debug
console.log("home.js loaded ✅");
