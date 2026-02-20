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
let areas   = [];
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


async function loadUserEmail() {

  const { data: { user }, error } =
    await supabaseClient.auth.getUser();

  if (error || !user) {
    console.log("ไม่พบ user");
    return;
  }

  const emailEl = document.getElementById("userEmail");
  if (emailEl) {
    emailEl.textContent = user.email;
  }
}


/* =================================================
   4️⃣ Load Data
================================================= */

async function loadData() {

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const userId = user.id;

  // โหลด reports
  const { data: reportData, error: reportError } =
    await supabaseClient
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

  if (reportError) {
    console.error("โหลด reports ไม่ได้:", reportError);
  }

  // โหลด areas
const { data: areaData, error: areaError } =
  await supabaseClient
    .from("areas")
    .select("*");

if (areaError) {
  console.error("โหลด areas ไม่ได้:", areaError);
}

  // โหลด claims
  const { data: claimData, error: claimError } =
    await supabaseClient
      .from("claims")
      .select("*");

  if (claimError) {
    console.error("โหลด claims ไม่ได้:", claimError);
  }

  reports = reportData || [];
  areas   = areaData || [];
  claims  = claimData || [];
}

async function loadUserProfile() {

  const { data: { user } } =
    await supabaseClient.auth.getUser();

  if (!user) return;

  // 🔎 ดึง display_name จาก profiles
  const { data: profile, error } =
    await supabaseClient
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .single();

  if (error) {
    console.error("โหลด profile ไม่ได้:", error);
    return;
  }

  const nameToShow =
    profile.display_name ||
    profile.username ||
    user.email;

  document.getElementById("userName").textContent = nameToShow;
}



/* =================================================
   🌍 Load User Area
   - แสดง Area ที่ Sales รับผิดชอบ
================================================= */
async function loadUserArea() {

  try {

    // 1️⃣ ดึง user ที่ login อยู่
    const { data: { user }, error } =
      await supabaseClient.auth.getUser();

    if (error || !user) return;

    // 2️⃣ ดึงค่า area จาก profiles
    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("area")
        .eq("id", user.id)
        .single();

    if (profileError) {
      console.error("โหลด area ไม่ได้:", profileError);
      return;
    }

    // 3️⃣ แสดงค่าใน Card
    const areaEl = document.getElementById("areaCount");

    if (areaEl) {
      areaEl.textContent =
        profile?.area || "ยังไม่ได้กำหนด";
    }

  } catch (err) {
    console.error("Error loadUserArea:", err.message);
  }
}

/* =================================================
  Load User Data
================================================= */
async function loadUserInfo() {

  const { data: { user }, error } =
    await supabaseClient.auth.getUser();

  if (error || !user) {
    console.log("ไม่พบ user");
    return;
  }

  document.getElementById("userName").textContent =
    user.email;  // ชั่วคราวใช้ email ก่อน
}



/* =================================================
   5️⃣ Render Dashboard Summary
================================================= */

function renderSummary() {
  
  const claimCountEl = document.getElementById("claimCount");

  
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
      date: r.report_date,
      link: `report.html?id=${r.id}`,
      id: r.id
    })),
    // ...trips.map(t => ({
    //   type: "trip",
    //   title: `Trip : ${t.place || "-"}`,
    //   date: t.trip_date,
    //   link: `trip.html?id=${t.id}`,
    //   id: t.id
    // }))
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

async function deleteItem(type, id) {

  if (!confirm("ต้องการลบใช่หรือไม่?")) return;

  const table =
    type === "report" ? "reports" :
    type === "trip"   ? "trips" :
                        "claims";

  const { error } = await supabaseClient
    .from(table)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("ลบไม่สำเร็จ:", error);
  } else {
    await init();
  }
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
  await loadData();   // สำคัญมาก
  await loadUserInfo();   // ต้องมีอันนี้
  await loadUserProfile();
  await loadUserEmail();
  await loadUserRole();
  await loadUserArea();
  await loadStoreCount();
  
  renderSummary();
  renderReportList();
  renderWeeklyProgress();
  renderCalendar();
}


async function loadUserRole() {

  const { data: { user } } =
    await supabaseClient.auth.getUser();

  if (!user) return;

  const { data: profile } =
    await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

  if (profile?.role === "admin") {
    document.body.classList.add("is-admin");
  }
}


document.addEventListener("DOMContentLoaded", init);

console.log("Home loaded (Production Ready) 🚀");



/* =================================================
   🏪 Load Store Count (Dashboard Card)
   - นับจำนวนร้านค้าของ Sales ที่ login อยู่
================================================= */
async function loadStoreCount() {
  try {

    // ดึง user ปัจจุบัน
    const { data: { user }, error: userError } =
      await supabaseClient.auth.getUser();

    if (userError) throw userError;
    if (!user) return;

    // นับจำนวนร้าน (ไม่ดึงข้อมูลจริง ใช้ head:true เพื่อความเร็ว)
    const { count, error } =
      await supabaseClient
        .from("shops")
        .select("*", { count: "exact", head: true })
        .eq("sale_id", user.id);

    if (error) throw error;

    // แสดงผลใน card
    const el = document.getElementById("storeCount");
    if (el) el.textContent = count ?? 0;

  } catch (err) {
    console.error("โหลดจำนวนร้านไม่สำเร็จ:", err.message);
    const el = document.getElementById("storeCount");
    if (el) el.textContent = 0;
  }
}

