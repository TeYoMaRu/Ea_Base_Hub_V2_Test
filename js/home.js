/*************************************************
 * HOME.JS (Production Ready)
 * ------------------------------------------------
 * - Protect page (Supabase session)
 * - Load data from localStorage safely
 * - Render Dashboard summary
 * - Render My Reports list
 * - Weekly report progress
 * - Dynamic calendar
 * - UI controls (menu / sidebar)
 *************************************************/


/* =================================================
   1️⃣ Utilities
================================================= */

// Safe JSON parse
function getStorageArray(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn("Storage error:", key);
    return [];
  }
}

// Format Date → YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split("T")[0];
}


/* =================================================
   2️⃣ Global State
================================================= */

let reports = [];
let trips   = [];
let claims  = [];

let currentDate = new Date();


/* =================================================
   3️⃣ Protect Page (Auth Required)
================================================= */

async function protectPage() {
  const { data: { session } } =
    await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
  }
}


/* =================================================
   4️⃣ Load Data
================================================= */

function loadData() {
  reports = getStorageArray("reports");
  trips   = getStorageArray("trips");
  claims  = getStorageArray("claims");
}


/* =================================================
   5️⃣ Render Dashboard Summary
================================================= */

function renderSummary() {
  const tripCountEl  = document.getElementById("tripCount");
  const claimCountEl = document.getElementById("claimCount");

  if (tripCountEl)  tripCountEl.textContent  = trips.length;
  if (claimCountEl) claimCountEl.textContent = claims.length;
}


/* =================================================
   6️⃣ Render My Reports
================================================= */

function renderReportList() {
  const listEl = document.getElementById("myReportList");
  if (!listEl) return;

  listEl.innerHTML = "";

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

  if (!items.length) {
    listEl.innerHTML =
      `<p style="color:#999">ยังไม่มีข้อมูล</p>`;
    return;
  }

  items
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .forEach(item => {
      const div = document.createElement("div");
      div.className = "report-item";

      div.innerHTML = `
        <div class="report-left">
          📄 <a href="${item.link}">${item.title}</a>
        </div>
        <div class="report-actions">
          <button onclick="location.href='${item.link}'">✏️</button>
          <button onclick="deleteItem('${item.type}','${item.id}')">🗑️</button>
        </div>
      `;

      listEl.appendChild(div);
    });
}

function deleteItem(type, id) {
  if (!confirm("ต้องการลบใช่หรือไม่?")) return;

  const key = type === "report" ? "reports" : "trips";
  const data = getStorageArray(key);

  const newData = data.filter(item => item.id !== id);
  localStorage.setItem(key, JSON.stringify(newData));

  init(); // re-render ใหม่แทน reload
}


/* =================================================
   7️⃣ Weekly Report Progress
================================================= */

function renderWeeklyProgress() {
  const reportDaysEl = document.getElementById("reportDays");
  const progressFill = document.getElementById("reportProgress");

  if (!reports.length) {
    if (reportDaysEl) reportDaysEl.textContent = "0";
    if (progressFill) progressFill.style.width = "0%";
    return;
  }

  const latestReport =
    reports.sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  const lastDate = new Date(latestReport.date);
  const now = new Date();

  const diffDays = Math.floor(
    (now - lastDate) / (1000 * 60 * 60 * 24)
  );

  if (reportDaysEl) reportDaysEl.textContent = diffDays;

  const percent = Math.min((diffDays / 7) * 100, 100);

  if (progressFill)
    progressFill.style.width = percent + "%";
}


/* =================================================
   8️⃣ Calendar
================================================= */

function getReportDates() {
  return reports
    .map(r => r.date)
    .filter(Boolean)
    .map(d => d.split("T")[0]);
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("calendarTitle");
  if (!grid || !title) return;

  grid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const monthNames = [
    "มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"
  ];

  title.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth =
    new Date(year, month + 1, 0).getDate();

  const reportDates = getReportDates();

  const dayHeaders = ["อา","จ","อ","พ","พฤ","ศ","ส"];
  dayHeaders.forEach(d => {
    const el = document.createElement("div");
    el.className = "calendar-day-header";
    el.textContent = d;
    grid.appendChild(el);
  });

  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateEl = document.createElement("div");
    dateEl.className = "calendar-day";
    dateEl.textContent = day;

    const dateStr =
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (reportDates.includes(dateStr))
      dateEl.classList.add("has-report");

    if (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    ) {
      dateEl.classList.add("today");
    }

    grid.appendChild(dateEl);
  }
}

function prevMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}


/* =================================================
   9️⃣ UI Controls
================================================= */

function toggleMenu() {
  document.querySelector(".menu")?.classList.toggle("show");
}

function toggleSidebar() {
  document.getElementById("sidebar")
    ?.classList.toggle("collapsed");
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}


/* =================================================
   🔟 INIT
================================================= */

async function init() {
  await protectPage();
  loadData();
  renderSummary();
  renderReportList();
  renderWeeklyProgress();
  renderCalendar();
}

document.addEventListener("DOMContentLoaded", init);

console.log("Home loaded (Production Ready) 🚀");
