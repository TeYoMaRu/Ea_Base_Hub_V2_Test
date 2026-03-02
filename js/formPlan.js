// =====================================================
// formPlan.js
// ระบบแผนการเดินทางและเบิกจ่าย (Travel Plan & Expense System)
// เวอร์ชัน: 2.1 | ปรับปรุง: 2025
// =====================================================

"use strict";

// =====================================================
// 🌐 GLOBAL STATE
// =====================================================

/** @type {Array<Object>} รายการทริปทั้งหมดในแผนปัจจุบัน */
let trips = [];



/** @type {string|null} ID ของแผนการเดินทางในฐานข้อมูล */
let currentPlanId = null;

/** @type {Array<Object>} รายการร้านค้าทั้งหมดที่ User มีสิทธิ์ดู */
let myShops = [];


// =====================================================
// 🚀 INITIALIZE PAGE
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 FormPlan page loaded");

  if (typeof supabaseClient === "undefined") {
    console.error("❌ Supabase client not found!");
    alert("❌ ระบบยังไม่พร้อม กรุณาตรวจสอบการเชื่อมต่อ");
    return;
  }

  const isAuthorized = await checkAuthorization();
  if (!isAuthorized) return;

  await initUserInfo();
  await initializePageData();
  await loadMyShops();

  setDefaultDates();
  setupEventListeners();

  setupSummaryCalculation();
});


// =====================================================
// 🔐 AUTHORIZATION
// =====================================================

async function checkAuthorization() {
  try {
    if (typeof protectPage === "function") {
      await protectPage(["admin", "sales", "manager", "user"]);
    } else {
      const { data: { session } } = await supabaseClient.auth.getSession();
      if (!session) {
        alert("❌ กรุณา Login ก่อนใช้งาน");
        window.location.href = "/login.html";
        return false;
      }
    }
    console.log("✅ Auth check passed");
    return true;
  } catch (error) {
    console.error("❌ Auth error:", error);
    return false;
  }
}


// =====================================================
// 👤 USER INFO
// =====================================================

async function initUserInfo() {
  if (typeof initUserService === "function") {
    await initUserService();
    if (typeof autoFillUserData === "function") {
      autoFillUserData({ full_name: "empName", zone: "zone", readonly: ["empName"] });
    }
  } else {
    await loadUserInfoBasic();
  }
}

async function loadUserInfoBasic() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    const userNameEl = document.querySelector(".user-name");
    if (userNameEl) {
      userNameEl.textContent = profile?.display_name || profile?.full_name || session.user.email;
    }

    const empNameInput = document.getElementById("empName");
    if (empNameInput) {
      empNameInput.value = profile?.full_name || profile?.display_name || session.user.email;
      empNameInput.readOnly = true;
    }

    const zoneInput = document.getElementById("zone");
    if (zoneInput && profile?.area) zoneInput.value = profile.area;

    console.log("✅ User info loaded");
  } catch (error) {
    console.error("❌ loadUserInfoBasic error:", error);
  }
}


// =====================================================
// 🏪 SHOP MANAGEMENT
// โหลดร้านค้า → สร้าง dropdown จังหวัดและร้านค้า
// =====================================================
function updateShopCount() {
  const shopCountEl = document.getElementById("shopCount");
  if (shopCountEl) {
    shopCountEl.textContent = myShops.length;
  }
}
/**
 * โหลดร้านค้าตาม role:
 * - admin   → ทุกร้าน
 * - manager → ร้านในจังหวัดของตน
 * - sales   → ร้านที่ตนรับผิดชอบ
 */
async function loadMyShops() {
  console.log("🔍 loadMyShops: เริ่มต้น...");

  // ── ตรวจสอบ session ──
  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

  if (sessionError) {
    console.error("❌ loadMyShops: getSession error", sessionError);
    return;
  }
  if (!session) {
    console.warn("⚠️ loadMyShops: ไม่มี session (ยังไม่ได้ login?)");
    return;
  }
  console.log("✅ session user id:", session.user.id);

  // ── โหลด profile ──
  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, area")
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    console.error("❌ loadMyShops: โหลด profile ไม่สำเร็จ", profileError);
    return;
  }
  console.log("✅ profile:", profile);

  // ── Query shops ตาม role ──
  let query = supabaseClient.from("shops").select("*").eq("status", "Active");

  if (profile.role === "sales") {
    console.log("🔍 filter by sale_id:", session.user.id);
    query = query.eq("sale_id", session.user.id);
  } else if (profile.role === "manager") {
    console.log("🔍 filter by province:", profile.area);
    query = query.eq("province", profile.area);
  } else {
    console.log("🔍 role:", profile.role, "→ โหลดทุกร้าน");
  }

  const { data, error } = await query;

  if (error) {
    console.error("❌ loadMyShops: query shops error", error);
    return;
  }

  console.log(`✅ shops จากฐานข้อมูล: ${data?.length ?? 0} ร้าน`, data);

  myShops = data || [];

  
  updateShopCount();
  // สร้าง dropdown จังหวัดทั้งสองฝั่ง (ต้นทาง/ปลายทาง)
  renderProvinceDropdowns();

  console.log(`✅ Loaded ${myShops.length} shops`);
}

/**
 * สร้าง dropdown จังหวัดสำหรับ:
 * - #fromProvince (เดินทางจาก)
 * - #toProvince   (ไปจังหวัด) → เมื่อเปลี่ยนจะ filter ร้านค้าทั้ง 3 dropdown
 *
 * ดึง unique provinces จาก myShops และเรียงตามตัวอักษร
 */
function renderProvinceDropdowns() {
  const uniqueProvinces = [...new Set(myShops.map((s) => s.province))].sort();

  const fromSelect = document.getElementById("fromProvince");
  const toSelect   = document.getElementById("toProvince");
  if (!fromSelect || !toSelect) return;

  const optionsHtml = uniqueProvinces
    .map((p) => `<option value="${p}">${p}</option>`)
    .join("");

  fromSelect.innerHTML = `<option value="">-- จังหวัดต้นทาง --</option>` + optionsHtml;
  toSelect.innerHTML   = `<option value="">-- จังหวัดปลายทาง --</option>` + optionsHtml;

  // เมื่อเลือกจังหวัดปลายทาง → filter ร้านค้าทั้ง 3 ช่อง
  toSelect.addEventListener("change", (e) => {
    renderShopDropdowns(e.target.value);
  });
}

/**
 * สร้าง dropdown ร้านค้าทั้ง 3 ช่อง (#shop1, #shop2, #shop3)
 * filter จากจังหวัดปลายทางที่เลือก
 *
 * @param {string} province - จังหวัดที่เลือก (ว่าง = reset)
 */
function renderShopDropdowns(province) {
  const shopIds    = ["shop1", "shop2", "shop3"];
  const placeholders = [
    "-- เลือกร้านค้า --",
    "-- เลือกร้านค้า (ถ้ามี) --",
    "-- เลือกร้านค้า (ถ้ามี) --",
  ];

  const filtered = province
    ? myShops.filter((s) => s.province === province)
    : [];

  const optionsHtml = filtered
    .map((shop) => `<option value="${shop.id}">${shop.shop_name}</option>`)
    .join("");

  shopIds.forEach((id, i) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = `<option value="">${placeholders[i]}</option>` + optionsHtml;
  });
}

/**
 * ดึงชื่อร้านค้าจาก shop ID
 * @param {string} shopId
 * @returns {string} ชื่อร้านค้า หรือ "-" ถ้าไม่พบ
 */
function getShopName(shopId) {
  if (!shopId) return "-";
  const shop = myShops.find((s) => s.id === shopId);
  return shop ? shop.shop_name : "-";
}


// =====================================================
// 📦 PAGE DATA INITIALIZATION
// =====================================================

async function initializePageData() {
  try {
    await loadExistingTrips();
    console.log("✅ All page data loaded");
  } catch (error) {
    console.error("❌ initializePageData error:", error);
  }
}

/**
 * ตั้งค่า default วันที่:
 * - tripDate  → วันนี้
 * - startDate → วันนี้
 * - endDate   → อีก 7 วัน
 */
function setDefaultDates() {
  const today = new Date();

  const startDateInput = document.getElementById("startDate");
  if (startDateInput) startDateInput.valueAsDate = today;

  const endDateInput = document.getElementById("endDate");
  if (endDateInput) {
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    endDateInput.valueAsDate = nextWeek;
  }

  const tripDateInput = document.getElementById("tripDate");
  if (tripDateInput) tripDateInput.valueAsDate = today;
}


// =====================================================
// 🎯 EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  // เปลี่ยน startDate → อัปเดต endDate อัตโนมัติ
  document.getElementById("startDate")?.addEventListener("change", updateEndDate);

  // กด Enter ในช่อง cost → เพิ่มทริป
  // document.getElementById("cost")?.addEventListener("keypress", (e) => {
  //   if (e.key === "Enter") addTrip();
  // });

  setupExpenseCalculation();
}

function updateEndDate() {
  const startDateValue = document.getElementById("startDate")?.value;
  const endDateInput   = document.getElementById("endDate");
  if (startDateValue && endDateInput) {
    const start = new Date(startDateValue);
    start.setDate(start.getDate() + 7);
    endDateInput.valueAsDate = start;
  }
}


// =====================================================
// 📥 LOAD EXISTING TRIPS
// =====================================================

/**
 * โหลดแผน draft ล่าสุดของ User จากฐานข้อมูล
 * ถ้ามี → กรอกข้อมูลกลับในฟอร์มและตาราง
 */
async function loadExistingTrips() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) { console.error("❌ No user ID"); return; }

    const { data, error } = await supabaseClient
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) { console.log("ℹ️ No draft plan found"); return; }

    const plan = data[0];
    currentPlanId = plan.id;

    if (plan.start_date) document.getElementById("startDate").value = plan.start_date;
    if (plan.end_date)   document.getElementById("endDate").value   = plan.end_date;

    const zoneInput = document.getElementById("zone");
    if (zoneInput && plan.zone) zoneInput.value = plan.zone;

    if (Array.isArray(plan.trips)) {
      trips = plan.trips;
      renderTripsTable();
    }

    console.log("✅ Loaded existing plan:", currentPlanId);
  } catch (error) {
    console.error("❌ loadExistingTrips error:", error);
  }
}


// =====================================================
// ➕ ADD / EDIT TRIP
// =====================================================

/**
 * เพิ่มทริปใหม่หรืออัปเดตทริปที่กำลังแก้ไข
 *
 * ข้อมูลที่เก็บใน tripData:
 * - from / to     → ชื่อจังหวัด (string)
 * - shop1/2/3     → ชื่อร้านค้า (string, สำหรับแสดงในตาราง/export)
 * - shop1Id/2Id/3Id → id ร้านค้า (string, สำหรับ restore dropdown ตอน editTrip)
 */

// =====================================================
// ✏️ EDIT TRIP
// =====================================================

/**
 * โหลดข้อมูลทริปกลับสู่ฟอร์มเพื่อแก้ไข
 * ขั้นตอน:
 * 1. set จังหวัดต้นทาง
 * 2. set จังหวัดปลายทาง → renderShopDropdowns()
 * 3. setTimeout เพื่อรอ render เสร็จ → set ร้านค้า 1, 2, 3
 
// =====================================================
// 🗑️ DELETE TRIP
// =====================================================

function deleteTrip(index) {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบทริปนี้?")) return;

  trips.splice(index, 1);
  renderTripsTable();
  savePlanToDatabase();

  alert("✅ ลบทริปสำเร็จ");
  console.log(`✅ Trip at index ${index} deleted`);
}


// =====================================================
// 🧹 CLEAR TRIP FORM
// =====================================================

/**
 * ล้างฟอร์มกรอกทริปทั้งหมด:
 * - reset dropdown จังหวัด
 * - reset dropdown ร้านค้า (ผ่าน renderShopDropdowns(""))
 * - ล้างช่องค่าใช้จ่าย
 */


// =====================================================
// 🎨 RENDER TRIPS TABLE
// =====================================================


// =====================================================
// 💾 SAVE PLAN TO DATABASE
// =====================================================

async function savePlanToDatabase() {
  try {
    const { userId, userName, userZone } = await getCurrentUserInfo();
    if (!userId) { console.error("❌ No user ID"); return; }

    const planData = {
      user_id:    userId,
      user_name:  userName,
      start_date: document.getElementById("startDate")?.value,
      end_date:   document.getElementById("endDate")?.value,
      zone:       document.getElementById("zone")?.value || userZone,
      trips:      trips,
      status:     "draft",
      updated_at: new Date().toISOString(),
    };

    if (currentPlanId) {
      const { error } = await supabaseClient
        .from("trips")
        .update(planData)
        .eq("id", currentPlanId);
      if (error) throw error;
      console.log("✅ Plan updated:", currentPlanId);
    } else {
      planData.created_at = new Date().toISOString();
      const { data, error } = await supabaseClient
        .from("trips")
        .insert([planData])
        .select();
      if (error) throw error;
      if (data && data.length > 0) {
        currentPlanId = data[0].id;
        console.log("✅ New plan created:", currentPlanId);
      }
    }
  } catch (error) {
    console.error("❌ savePlanToDatabase error:", error);
  }
}


// =====================================================
// 📊 EXPENSE SUMMARY
// =====================================================

/**
 * คำนวณสรุปค่าใช้จ่าย
 *
 * summaryInputs layout (ตามลำดับใน DOM):
 *   [0] ค่าเดินทางเฉลี่ยต่อวัน  → auto คำนวณ
 *   [1] จำนวนวัน                → auto คำนวณ
 *   [2] ค่าที่พักต่อวัน          → user กรอก
 *   [3] ค่าใช้จ่ายอื่นๆ          → user กรอก
 *   [4] รวมทั้งหมด              → auto คำนวณ
 */
function updateSummary() {
  const totalTripCost = trips.reduce((sum, trip) => sum + (trip.cost || 0), 0);

  const startDate = document.getElementById("startDate")?.value;
  const endDate   = document.getElementById("endDate")?.value;
  let numberOfDays = 1;

  if (startDate && endDate) {
    const diffMs = new Date(endDate) - new Date(startDate);
    numberOfDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }

  const summaryInputs = document.querySelectorAll(".section:last-child input[type='number']");
  if (summaryInputs.length < 5) return;

  const avgCostPerDay       = numberOfDays > 0 ? Math.round(totalTripCost / numberOfDays) : 0;
  const accommodationPerDay = parseFloat(summaryInputs[2].value || 0);
  const otherExpenses       = parseFloat(summaryInputs[3].value || 0);
  const totalExpenses       = totalTripCost + accommodationPerDay * numberOfDays + otherExpenses;

  summaryInputs[0].value = avgCostPerDay;
  summaryInputs[1].value = numberOfDays;
  summaryInputs[4].value = Math.round(totalExpenses);
}

/** ผูก listener ให้ช่องที่ user กรอกเอง → คำนวณ total อัตโนมัติ */
function setupExpenseCalculation() {
  const summaryInputs = document.querySelectorAll(".section:last-child input[type='number']");
  if (summaryInputs.length >= 5) {
    summaryInputs[2].addEventListener("input", updateSummary); // ค่าที่พัก
    summaryInputs[3].addEventListener("input", updateSummary); // ค่าอื่นๆ
  }
}


// =====================================================
// 📤 EXPORT TO CSV
// =====================================================

function exportTrips() {
  if (trips.length === 0) {
    alert("❌ ไม่มีข้อมูลทริปให้ Export");
    return;
  }

  let userName = document.getElementById("empName")?.value || "User";
  let userZone = document.getElementById("zone")?.value || "";

  if (typeof getUserData === "function") {
    userName = getUserData("full_name") || userName;
    userZone = getUserData("zone") || userZone;
  }

  // Header
  let csvContent = "ลำดับ,วันที่,เดินทางจาก,ไปจังหวัด,ร้านค้า 1,ร้านค้า 2,ร้านค้า 3,ค่าใช้จ่าย\n";

  // Data rows
  trips.forEach((trip, index) => {
    csvContent += [
      index + 1,
      formatDate(trip.date),
      escapeCsv(trip.from),
      escapeCsv(trip.to),
      escapeCsv(trip.shop1),
      escapeCsv(trip.shop2),
      escapeCsv(trip.shop3),
      trip.cost,
    ].join(",") + "\n";
  });

  // Summary
  csvContent += "\nสรุปค่าใช้จ่าย\n";
  const summaryInputs = document.querySelectorAll(".section:last-child input[type='number']");
  if (summaryInputs.length >= 5) {
    csvContent += `ค่าใช้จ่ายเดินทางเฉลี่ยต่อวัน,${summaryInputs[0].value} ฿\n`;
    csvContent += `จำนวนวัน,${summaryInputs[1].value} วัน\n`;
    csvContent += `ค่าที่พักต่อวัน,${summaryInputs[2].value} ฿\n`;
    csvContent += `ค่าใช้จ่ายอื่นๆ,${summaryInputs[3].value} ฿\n`;
    csvContent += `รวมทั้งหมด,${summaryInputs[4].value} ฿\n`;
  }

  // Download — BOM (\uFEFF) ให้ Excel อ่านภาษาไทยได้
  const blob      = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url       = URL.createObjectURL(blob);
  const link      = document.createElement("a");
  const startDate = document.getElementById("startDate")?.value || "";
  const fileName  = `Trip_Plan_${userName}_${userZone}_${startDate}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alert("✅ Export สำเร็จ");
  console.log("✅ CSV exported:", fileName);
}


// =====================================================
// 🛠️ UTILITY FUNCTIONS
// =====================================================

/** ดึง User ID จาก getUserData() หรือ Supabase auth */
async function getCurrentUserId() {
  if (typeof getUserData === "function") return getUserData("id");
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user?.id || null;
}

/** ดึงข้อมูล User ทั้งหมด (id, userName, userZone) */
async function getCurrentUserInfo() {
  if (typeof getUserData === "function") {
    return {
      userId:   getUserData("id"),
      userName: getUserData("full_name"),
      userZone: getUserData("zone"),
    };
  }
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: profile }  = await supabaseClient
    .from("profiles").select("full_name, zone").eq("id", user.id).single();
  return {
    userId:   user.id,
    userName: profile?.full_name || user.email,
    userZone: profile?.zone || null,
  };
}

/** Format วันที่เป็นรูปแบบภาษาไทย เช่น "1 ม.ค. 2568" */
function formatDate(dateString) {
  if (!dateString) return "-";
  try {
    return new Date(dateString).toLocaleDateString("th-TH", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return dateString; }
}

/** Format ตัวเลขมี comma เช่น "1,234.50" */
function formatNumber(num) {
  if (num == null) return "0";
  return num.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Escape HTML ป้องกัน XSS เมื่อใส่ข้อความใน innerHTML */
function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/** Escape ข้อความสำหรับใส่ใน CSV (ครอบด้วย " ถ้ามีอักขระพิเศษ) */
function escapeCsv(text) {
  if (!text) return "";
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

console.log("✅ formPlan.js loaded successfully");



function addRow() {
  const tbody = document.getElementById("tripTableBody");

  const row = document.createElement("tr");

  row.innerHTML = `
    <td><input type="date" class="trip-date"></td>
    <td>
      <select class="from-province">
        ${generateProvinceOptions()}
      </select>
    </td>
    <td>
      <select class="to-province" onchange="handleProvinceChange(this)">
        ${generateProvinceOptions()}
      </select>
    </td>
    <td><select class="shop1"></select></td>
    <td><select class="shop2"></select></td>
    <td><select class="shop3"></select></td>
    <td><input type="text" class="note" placeholder="หมายเหตุ"></td>
  `;

  tbody.appendChild(row);
}


function removeRow() {
  const tbody = document.getElementById("tripTableBody");
  if (tbody.rows.length > 0) {
    tbody.deleteRow(-1);
  }
}



function generateProvinceOptions() {
  const provinces = [...new Set(myShops.map(s => s.province))].sort();

  let html = `<option value="">จังหวัด</option>`;
  provinces.forEach(p => {
    html += `<option value="${p}">${p}</option>`;
  });

  return html;
}


function handleProvinceChange(selectElement) {
  const province = selectElement.value;
  const row = selectElement.closest("tr");

  const shops = myShops.filter(s => s.province === province);

  const options = shops.map(s =>
    `<option value="${s.id}">${s.shop_name}</option>`
  ).join("");

  row.querySelector(".shop1").innerHTML = `<option value="">ชื่อร้าน</option>` + options;
  row.querySelector(".shop2").innerHTML = `<option value="">ชื่อร้าน</option>` + options;
  row.querySelector(".shop3").innerHTML = `<option value="">ชื่อร้าน</option>` + options;
}

function saveTableData() {
  const rows = document.querySelectorAll("#tripTableBody tr");

  trips = [];

  rows.forEach(row => {
    const trip = {
      date: row.querySelector(".trip-date").value,
      from: row.querySelector(".from-province").value,
      to: row.querySelector(".to-province").value,
      cost: 0
    };

    trips.push(trip);
  });

  updateSummary();
  console.log("📦 ข้อมูลที่บันทึก:", trips);
  alert("✅ บันทึกข้อมูลเรียบร้อย");
}


function openPreview() {

  const rows = document.querySelectorAll("#tripTableBody tr");

  let tableRows = "";

  rows.forEach(row => {

    const cells = row.querySelectorAll("input, select");

    const date  = cells[0]?.value || "-";
    const from  = cells[1]?.value || "-";
    const to    = cells[2]?.value || "-";
    const shop1 = cells[3]?.selectedOptions?.[0]?.text || "-";
    const shop2 = cells[4]?.selectedOptions?.[0]?.text || "-";
    const shop3 = cells[5]?.selectedOptions?.[0]?.text || "-";
    const note  = cells[6]?.value || "-";

    tableRows += `
      <tr>
        <td>${date}</td>
        <td>${from}</td>
        <td>${to}</td>
        <td>${shop1}</td>
        <td>${shop2}</td>
        <td>${shop3}</td>
        <td>${note}</td>
      </tr>
    `;
  });

  // ===== สรุปยอด =====
  const allowanceRate  = parseFloat(document.getElementById("allowanceRate").value) || 0;
  const allowanceDays  = parseFloat(document.getElementById("allowanceDays").value) || 0;
  const hotelRate      = parseFloat(document.getElementById("hotelRate").value) || 0;
  const hotelNights    = parseFloat(document.getElementById("hotelNights").value) || 0;
  const otherCost      = parseFloat(document.getElementById("otherCost").value) || 0;
  const grandTotal     = document.getElementById("grandTotal").value || 0;

  document.getElementById("previewContent").innerHTML = `
    <h2 style="text-align:center;">สรุปแผนการเดินทาง</h2>

    <table>
      <thead>
        <tr>
          <th>ว/ด/ป</th>
          <th>จากจังหวัด</th>
          <th>ไปจังหวัด</th>
          <th>ร้านค้า 1</th>
          <th>ร้านค้า 2</th>
          <th>ร้านค้า 3</th>
          <th>หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <br><br>

    <h3>สรุปค่าใช้จ่าย</h3>

    <table>
      <tr>
        <td>เบี้ยเลี้ยง</td>
        <td>${allowanceRate} × ${allowanceDays}</td>
        <td>${(allowanceRate * allowanceDays).toLocaleString()} บาท</td>
      </tr>
      <tr>
        <td>ค่าที่พัก</td>
        <td>${hotelRate} × ${hotelNights}</td>
        <td>${(hotelRate * hotelNights).toLocaleString()} บาท</td>
      </tr>
      <tr>
        <td>ค่าใช้จ่ายอื่นๆ</td>
        <td>-</td>
        <td>${otherCost.toLocaleString()} บาท</td>
      </tr>
      <tr>
        <th colspan="2" style="text-align:right;">รวมเบิกทั้งหมด</th>
        <th>${parseFloat(grandTotal || 0).toLocaleString()} บาท</th>
      </tr>
    </table>
  `;

  document.getElementById("previewModal").style.display = "flex";
}

function closePreview() {
  document.getElementById("previewModal").style.display = "none";
}

function printPreview() {
  window.print();
}

function exportPDF() {
  window.print(); // ใช้ print เป็น Save PDF ได้เลย
}

function saveData() {
  alert("บันทึกเรียบร้อย");
}


function calculateSummary() {

  const allowanceRate = parseFloat(document.getElementById("allowanceRate")?.value) || 0;
  const allowanceDays = parseFloat(document.getElementById("allowanceDays")?.value) || 0;

  const hotelRate = parseFloat(document.getElementById("hotelRate")?.value) || 0;
  const hotelNights = parseFloat(document.getElementById("hotelNights")?.value) || 0;

  const otherCost = parseFloat(document.getElementById("otherCost")?.value) || 0;

  const totalAllowance = allowanceRate * allowanceDays;
  const totalHotel = hotelRate * hotelNights;

  const grandTotal = totalAllowance + totalHotel + otherCost;

  document.getElementById("grandTotal").value = grandTotal.toLocaleString();
}



function setupSummaryCalculation() {

  const inputs = [
    "allowanceRate",
    "allowanceDays",
    "hotelRate",
    "hotelNights",
    "otherCost"
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", calculateSummary);
    }
  });

}



function calculateSummary() {

  const allowanceRate = parseFloat(document.getElementById("allowanceRate")?.value) || 0;
  const allowanceDays = parseFloat(document.getElementById("allowanceDays")?.value) || 0;

  const hotelRate = parseFloat(document.getElementById("hotelRate")?.value) || 0;
  const hotelNights = parseFloat(document.getElementById("hotelNights")?.value) || 0;

  const otherCost = parseFloat(document.getElementById("otherCost")?.value) || 0;

  const totalAllowance = allowanceRate * allowanceDays;
  const totalHotel = hotelRate * hotelNights;

  const grandTotal = totalAllowance + totalHotel + otherCost;

  document.getElementById("grandTotal").value = grandTotal.toLocaleString();
}