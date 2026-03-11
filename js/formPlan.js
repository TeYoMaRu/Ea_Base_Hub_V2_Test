// =====================================================
// formPlan.js
// ระบบแผนการเดินทางและเบิกจ่าย (Travel Plan & Expense System)
// เวอร์ชัน: 2.2 | ปรับปรุง: 2026
// =====================================================

"use strict";

// =====================================================
// 🌐 GLOBAL STATE
// =====================================================

// ✅ แก้: เดิม trips ถูก comment ออกจนไม่ได้ declare → ทำให้ saveTableData / exportTrips พัง
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
        window.location.href = "login.html";
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
      autoFillUserData({
        display_name: "empName",
        // ✅ แก้: เดิมส่ง area: "zone" แต่ element จริงคือ id="area"
        area: "area",
        readonly: ["empName", "area"],
      });
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
      .select("display_name, area")
      .eq("id", session.user.id)
      .maybeSingle();

    // แสดงอีเมลใน sidebar
    const sidebarEmail = document.getElementById("sidebarEmail");
    if (sidebarEmail) sidebarEmail.textContent = session.user.email;

    const empNameInput = document.getElementById("empName");
    if (empNameInput) {
      empNameInput.value    = profile?.display_name || session.user.email;
      empNameInput.readOnly = true;
    }

    // ✅ แก้: เดิมอ้าง id="zone" แต่ใน HTML ใช้ id="area"
    const areaInput = document.getElementById("area");
    if (areaInput) {
      areaInput.value    = profile?.area || "";
      areaInput.readOnly = true;
    }

    console.log("✅ User info loaded");
  } catch (error) {
    console.error("❌ loadUserInfoBasic error:", error);
  }
}

// =====================================================
// 🏪 SHOP MANAGEMENT
// =====================================================

function updateShopCount() {
  const shopCountEl = document.getElementById("shopCount");
  if (shopCountEl) shopCountEl.textContent = myShops.length;
}

async function loadMyShops() {
  console.log("🔍 loadMyShops: เริ่มต้น...");

  const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
  if (sessionError || !session) {
    console.warn("⚠️ loadMyShops: ไม่มี session");
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("role, area")
    .eq("id", session.user.id)
    .maybeSingle();

  if (profileError) {
    console.error("❌ loadMyShops: โหลด profile ไม่สำเร็จ", profileError);
    return;
  }

  let query = supabaseClient.from("shops").select("*").eq("status", "Active");

  if (profile.role === "sales") {
    query = query.eq("sale_id", session.user.id);
  } else if (profile.role === "manager") {
    query = query.eq("province", profile.area);
  }

  const { data, error } = await query;
  if (error) {
    console.error("❌ loadMyShops: query shops error", error);
    return;
  }

  myShops = data || [];
  updateShopCount();
  console.log(`✅ Loaded ${myShops.length} shops`);
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
}

// =====================================================
// 🎯 EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  document.getElementById("startDate")?.addEventListener("change", updateEndDate);
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

async function loadExistingTrips() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;

    const { data, error } = await supabaseClient
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) {
      console.log("ℹ️ No draft plan found");
      return;
    }

    const plan = data[0];
    currentPlanId = plan.id;

    if (plan.start_date) document.getElementById("startDate").value = plan.start_date;
    if (plan.end_date)   document.getElementById("endDate").value   = plan.end_date;

    // ✅ แก้: เดิมอ้าง id="zone" → แก้เป็น id="area"
    const areaInput = document.getElementById("area");
    if (areaInput && plan.area) areaInput.value = plan.area;

    console.log("✅ Loaded existing plan:", currentPlanId);
  } catch (error) {
    console.error("❌ loadExistingTrips error:", error);
  }
}

// =====================================================
// ➕ TABLE ROW MANAGEMENT
// =====================================================

function addRow() {
  const tbody = document.getElementById("tripTableBody");
  const row   = document.createElement("tr");

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
    <td><select class="shop1"><option value="">ชื่อร้าน</option></select></td>
    <td><select class="shop2"><option value="">ชื่อร้าน</option></select></td>
    <td><select class="shop3"><option value="">ชื่อร้าน</option></select></td>
    <td><input type="text" class="note" placeholder="หมายเหตุ"></td>
  `;

  tbody.appendChild(row);
}

function removeRow() {
  const tbody = document.getElementById("tripTableBody");
  if (tbody.rows.length > 0) tbody.deleteRow(-1);
}

function generateProvinceOptions() {
  const provinces = [...new Set(myShops.map((s) => s.province))].sort();
  let html = `<option value="">จังหวัด</option>`;
  provinces.forEach((p) => {
    html += `<option value="${p}">${p}</option>`;
  });
  return html;
}

function handleProvinceChange(selectElement) {
  const province = selectElement.value;
  const row      = selectElement.closest("tr");
  const shops    = myShops.filter((s) => s.province === province);
  const options  = shops
    .map((s) => `<option value="${s.id}">${s.shop_name}</option>`)
    .join("");

  ["shop1", "shop2", "shop3"].forEach((cls) => {
    row.querySelector(`.${cls}`).innerHTML =
      `<option value="">ชื่อร้าน</option>` + options;
  });
}

// =====================================================
// 💾 SAVE PLAN TO DATABASE
// =====================================================

async function savePlanToDatabase(status = "draft") {
  try {
    const { userId, userName, userZone } = await getCurrentUserInfo();
    if (!userId) {
      console.error("❌ No user ID");
      return;
    }

    // เก็บข้อมูลจากตาราง
    saveTableData(false); // false = ไม่แสดง alert

    const planData = {
      user_id:    userId,
      user_name:  userName,
      start_date: document.getElementById("startDate")?.value,
      end_date:   document.getElementById("endDate")?.value,
      // ✅ แก้: เดิมอ้าง id="zone" → แก้เป็น id="area"
      area:       document.getElementById("area")?.value || userZone,
      trips:      trips,
      status:     status,
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

    if (status === "draft") alert("💾 บันทึก Draft เรียบร้อย");
    if (status === "completed") alert("✅ บันทึกสำเร็จ");

  } catch (error) {
    console.error("❌ savePlanToDatabase error:", error);
    alert("❌ บันทึกไม่สำเร็จ: " + error.message);
  }
}

// =====================================================
// 📦 COLLECT TABLE DATA
// =====================================================

// showAlert = true เมื่อเรียกจากปุ่มโดยตรง, false เมื่อเรียกก่อน save
function saveTableData(showAlert = true) {
  const rows = document.querySelectorAll("#tripTableBody tr");
  trips = [];

  rows.forEach((row) => {
    trips.push({
      date:   row.querySelector(".trip-date")?.value    || "",
      from:   row.querySelector(".from-province")?.value || "",
      to:     row.querySelector(".to-province")?.value   || "",
      shop1:  row.querySelector(".shop1")?.selectedOptions?.[0]?.text || "",
      shop2:  row.querySelector(".shop2")?.selectedOptions?.[0]?.text || "",
      shop3:  row.querySelector(".shop3")?.selectedOptions?.[0]?.text || "",
      shop1Id: row.querySelector(".shop1")?.value || "",
      shop2Id: row.querySelector(".shop2")?.value || "",
      shop3Id: row.querySelector(".shop3")?.value || "",
      note:   row.querySelector(".note")?.value || "",
    });
  });

  console.log("📦 ข้อมูลที่บันทึก:", trips);
  if (showAlert) alert("✅ บันทึกข้อมูลเรียบร้อย");
}

// =====================================================
// 📊 SUMMARY CALCULATION
// =====================================================

// ✅ แก้: เดิม calculateSummary() ถูก declare 2 ครั้ง → รวมเป็นครั้งเดียว
function calculateSummary() {
  const allowanceRate  = parseFloat(document.getElementById("allowanceRate")?.value)  || 0;
  const allowanceDays  = parseFloat(document.getElementById("allowanceDays")?.value)  || 0;
  const hotelRate      = parseFloat(document.getElementById("hotelRate")?.value)       || 0;
  const hotelNights    = parseFloat(document.getElementById("hotelNights")?.value)     || 0;
  const otherCost      = parseFloat(document.getElementById("otherCost")?.value)       || 0;

  const grandTotal = (allowanceRate * allowanceDays) + (hotelRate * hotelNights) + otherCost;
  document.getElementById("grandTotal").value = grandTotal.toLocaleString("th-TH");
}

function setupSummaryCalculation() {
  ["allowanceRate", "allowanceDays", "hotelRate", "hotelNights", "otherCost"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", calculateSummary);
  });
}

// =====================================================
// 🔍 PREVIEW MODAL
// =====================================================

function openPreview() {
  saveTableData(false); // sync trips ก่อน render

  let tableRows = "";
  trips.forEach((t) => {
    tableRows += `
      <tr>
        <td>${t.date || "-"}</td>
        <td>${t.from || "-"}</td>
        <td>${t.to   || "-"}</td>
        <td>${t.shop1 || "-"}</td>
        <td>${t.shop2 || "-"}</td>
        <td>${t.shop3 || "-"}</td>
        <td>${t.note  || "-"}</td>
      </tr>
    `;
  });

  const allowanceRate  = parseFloat(document.getElementById("allowanceRate")?.value) || 0;
  const allowanceDays  = parseFloat(document.getElementById("allowanceDays")?.value) || 0;
  const hotelRate      = parseFloat(document.getElementById("hotelRate")?.value)      || 0;
  const hotelNights    = parseFloat(document.getElementById("hotelNights")?.value)    || 0;
  const otherCost      = parseFloat(document.getElementById("otherCost")?.value)      || 0;
  const grandTotalRaw  = (allowanceRate * allowanceDays) + (hotelRate * hotelNights) + otherCost;

  const empName = document.getElementById("empName")?.value || "-";
  const area    = document.getElementById("area")?.value    || "-";
  const start   = document.getElementById("startDate")?.value || "-";
  const end     = document.getElementById("endDate")?.value   || "-";

  document.getElementById("previewContent").innerHTML = `
    <div class="doc-header">
      <h2>บริษัท เอิร์นนี่ แอดวานซ์</h2>
      <h3>แผนการเดินทางและเบิกทดลองจ่าย ๑</h3>
    </div>

    <div class="doc-info">
      <div>
        <div>พนักงานขาย: ${empName}</div>
        <div>เขตการขาย: ${area}</div>
      </div>
      <div>
        <div>ระหว่างวันที่: ${start}</div>
        <div>ถึงวันที่: ${end}</div>
      </div>
    </div>

    <table class="doc-table">
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
        ${tableRows || '<tr><td colspan="7" style="text-align:center">ไม่มีข้อมูล</td></tr>'}
      </tbody>
    </table>

    <br>
    <h3>สรุปค่าใช้จ่าย</h3>

    <table class="doc-table cost-table">
      <tr>
        <td>เบี้ยเลี้ยง</td>
        <td>${allowanceRate.toLocaleString()} × ${allowanceDays} วัน</td>
        <td>${(allowanceRate * allowanceDays).toLocaleString()} บาท</td>
      </tr>
      <tr>
        <td>ค่าที่พัก</td>
        <td>${hotelRate.toLocaleString()} × ${hotelNights} คืน</td>
        <td>${(hotelRate * hotelNights).toLocaleString()} บาท</td>
      </tr>
      <tr>
        <td>ค่าใช้จ่ายอื่นๆ</td>
        <td>-</td>
        <td>${otherCost.toLocaleString()} บาท</td>
      </tr>
      <tr>
        <th colspan="2" style="text-align:right;">รวมเบิกทั้งหมด</th>
        <th>${grandTotalRaw.toLocaleString()} บาท</th>
      </tr>
    </table>

    <div class="signature-section">
      <div>(${empName})<br>พนักงานขาย</div>
      <div>(................................)<br>ผู้จัดการฝ่ายขาย</div>
      <div>(................................)<br>ฝ่ายบัญชี</div>
      <div>(................................)<br>ผู้อนุมัติ</div>
    </div>
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
  window.print();
}

// =====================================================
// 📤 EXPORT CSV
// =====================================================

function exportTrips() {
  if (trips.length === 0) {
    alert("❌ ไม่มีข้อมูลทริปให้ Export");
    return;
  }

  const empName = document.getElementById("empName")?.value || "User";
  const area    = document.getElementById("area")?.value    || "";
  const start   = document.getElementById("startDate")?.value || "";

  let csv = "ลำดับ,วันที่,เดินทางจาก,ไปจังหวัด,ร้านค้า 1,ร้านค้า 2,ร้านค้า 3,หมายเหตุ\n";
  trips.forEach((t, i) => {
    csv += [
      i + 1,
      t.date,
      escapeCsv(t.from),
      escapeCsv(t.to),
      escapeCsv(t.shop1),
      escapeCsv(t.shop2),
      escapeCsv(t.shop3),
      escapeCsv(t.note),
    ].join(",") + "\n";
  });

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = `Trip_Plan_${empName}_${area}_${start}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  alert("✅ Export สำเร็จ");
}

// =====================================================
// 🛠️ UTILITY
// =====================================================

async function getCurrentUserId() {
  if (typeof getUserData === "function") return getUserData("id");
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user?.id || null;
}

async function getCurrentUserInfo() {
  if (typeof getUserData === "function") {
    return {
      userId:   getUserData("id"),
      userName: getUserData("display_name"),
      userZone: getUserData("area"),
    };
  }
  const { data: { user } } = await supabaseClient.auth.getUser();
  const { data: profile }  = await supabaseClient
    .from("profiles")
    .select("display_name, area")
    .eq("id", user.id)
    .maybeSingle();
  return {
    userId:   user.id,
    userName: profile?.display_name || user.email,
    userZone: profile?.area || null,
  };
}

function escapeCsv(text) {
  if (!text) return "";
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

console.log("✅ formPlan.js loaded successfully");