// =====================================================
// formActual.js — ใบเดินทางจริงและเคลียร์ค่าใช้จ่าย ๒
//
// trips table schema (jsonb):
//   id, user_id, user_name, start_date, end_date,
//   area, trips (jsonb array), status, created_at, updated_at
//
// trips jsonb item: { date, from, to, shop1, shop2, shop3, note }
//
// actuals table schema:
//   id, user_id, user_name, ref_plan_id,
//   start_date, end_date, zone,
//   rows (jsonb array), grand_total, status,
//   created_at, updated_at
//
// actuals jsonb item:
//   { date, route, allowance, hotel, fuel, other, note }
// =====================================================
"use strict";

const STORAGE_KEY   = "formActualDraft"; // localStorage key
let   currentPlanId = null; // plan_id ที่โหลดมา
let   planData      = null; // raw plan object
let   actualId      = null; // actual record ที่กำลังแก้ไข (ถ้ามี)

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  await loadUserInfo();
  await checkLatestPlan();   // ดึงแผนล่าสุดจาก trips → แสดง banner
  await loadActualDraft();   // โหลด actual draft ที่บันทึกไว้ใน Supabase (ถ้ามี)
  if (document.getElementById("tableBody").rows.length === 0) addRow();
});

// =====================================================
// 👤 LOAD USER INFO
// =====================================================
async function loadUserInfo() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { window.location.href = "login.html"; return; }

    const el = document.getElementById("sidebarEmail");
    if (el) el.textContent = session.user.email;

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("display_name, area")
      .eq("id", session.user.id)
      .single();

    const empEl  = document.getElementById("empName");
    const zoneEl = document.getElementById("empZone");
    if (empEl)  empEl.value  = profile?.display_name || session.user.email;
    if (zoneEl) zoneEl.value = profile?.area || "";

    console.log("✅ loadUserInfo");
  } catch (err) { console.error("❌ loadUserInfo:", err); }
}

// =====================================================
// 📋 CHECK LATEST PLAN (trips table)
// ดึงแผนล่าสุดของ user — trips column เป็น jsonb array
// =====================================================
async function checkLatestPlan() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // ✅ select ตรง column จริง: trips (jsonb), start_date, end_date, area, status
    const { data, error } = await supabaseClient
      .from("trips")
      .select("id, user_name, start_date, end_date, area, trips, status, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) { console.error("❌ checkLatestPlan query:", error.message); return; }
    if (!data || data.length === 0) return;

    planData      = data[0];
    currentPlanId = planData.id;

    // ── แสดง Banner ──
    const banner = document.getElementById("planBanner");
    const banTx  = document.getElementById("planBannerText");
    const refInp = document.getElementById("refPlanId");

    if (refInp) refInp.value = planData.id;
    if (banner) banner.style.display = "flex";

    const fmtD = (d) => d
      ? new Date(d).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"numeric" })
      : "";

    if (banTx) {
      const tripCount = Array.isArray(planData.trips) ? planData.trips.length : 0;
      banTx.textContent =
        `พบแผนการเดินทาง (ฟอร์ม ๑) : ${fmtD(planData.start_date)}` +
        (planData.end_date ? ` – ${fmtD(planData.end_date)}` : "") +
        ` (${tripCount} แถว)`;
    }

    console.log("✅ checkLatestPlan:", planData.id, "trips:", Array.isArray(planData.trips) ? planData.trips.length : 0);
  } catch (err) { console.error("❌ checkLatestPlan:", err); }
}

// =====================================================
// 📥 IMPORT FROM PLAN
// trips jsonb item: { date, from, to, shop1, shop2, shop3, note }
// =====================================================
function importFromPlan() {
  if (!planData) { alert("ไม่พบข้อมูลแผน"); return; }

  const tripRows = planData.trips;
  if (!Array.isArray(tripRows) || tripRows.length === 0) {
    alert("แผนนี้ยังไม่มีข้อมูลแถวเดินทาง (trips array ว่าง)");
    return;
  }

  // ล้างตารางเดิม
  document.getElementById("tableBody").innerHTML = "";

  // สร้างแถวจาก trips jsonb
  // วันที่ + เส้นทาง: from → to → shop1, shop2, shop3
  // ค่าใช้จ่ายปล่อยว่าง ให้กรอกตามจริง
  tripRows.forEach((t) => {
    const parts = [t.from, t.to, t.shop1, t.shop2, t.shop3]
      .filter((v) => v && v.trim() && v !== "-" && v !== "จังหวัด" && v !== "ชื่อร้าน" && v !== "");
    const route = parts.join(" → ");
    addRow(t.date || "", route);
  });

  calcTotal();

  const hint = document.getElementById("importHint");
  if (hint) hint.style.display = "flex";

  dismissBanner();
  alert(`✅ นำข้อมูล ${tripRows.length} แถวจากแผนมาแล้วค่ะ\nกรอกค่าใช้จ่ายจริงในแต่ละแถวได้เลย`);
}

// =====================================================
// 🔎 LOAD PLAN BY ID (กรอก ID เอง)
// =====================================================
async function loadPlanById() {
  const id = document.getElementById("refPlanId")?.value?.trim();
  if (!id) { alert("กรุณากรอก Plan ID ก่อนค่ะ"); return; }

  try {
    const { data, error } = await supabaseClient
      .from("trips")
      .select("id, user_name, start_date, end_date, area, trips, status")
      .eq("id", id)
      .single();

    if (error || !data) { alert("❌ ไม่พบแผน ID: " + id); return; }

    planData      = data;
    currentPlanId = data.id;

    const tripCount = Array.isArray(data.trips) ? data.trips.length : 0;
    const banner = document.getElementById("planBanner");
    const banTx  = document.getElementById("planBannerText");
    if (banner) banner.style.display = "flex";
    if (banTx)  banTx.textContent =
      `พบแผน ID: ${id.substring(0,8)}... (${tripCount} แถว) — กด "นำข้อมูลมาใช้" ได้เลยค่ะ`;

    console.log("✅ loadPlanById:", id, "trips:", tripCount);
    alert(`✅ โหลดแผนสำเร็จ (${tripCount} แถว)\nกด "นำข้อมูลมาใช้" เพื่อนำมาใส่ตาราง`);
  } catch (err) { alert("❌ เกิดข้อผิดพลาด: " + err.message); }
}

// =====================================================
// 🗂️ LOAD ACTUAL DRAFT (จาก Supabase actuals table)
// ถ้ามี draft ที่ยังไม่ complete → โหลดกลับมาต่อ
// =====================================================
async function loadActualDraft() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data, error } = await supabaseClient
      .from("actuals")
      .select("id, ref_plan_id, start_date, end_date, rows, grand_total, status")
      .eq("user_id", session.user.id)
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return;

    const draft = data[0];
    if (!Array.isArray(draft.rows) || draft.rows.length === 0) return;

    // ถาม user ก่อน
    const fmtD = (d) => d
      ? new Date(d).toLocaleDateString("th-TH", { day:"numeric", month:"short", year:"numeric" })
      : "-";

    const confirm = window.confirm(
      `พบ Draft ที่บันทึกไว้\n` +
      `ช่วงวันที่: ${fmtD(draft.start_date)} – ${fmtD(draft.end_date)}\n` +
      `จำนวน: ${draft.rows.length} แถว\n\n` +
      `ต้องการโหลดต่อไหมคะ?`
    );
    if (!confirm) return;

    actualId      = draft.id;
    currentPlanId = draft.ref_plan_id || currentPlanId;

    const refInp = document.getElementById("refPlanId");
    if (refInp && draft.ref_plan_id) refInp.value = draft.ref_plan_id;

    // ล้างตาราง แล้วเติมข้อมูล
    document.getElementById("tableBody").innerHTML = "";
    draft.rows.forEach((r) => {
      addRow(r.date || "", r.route || "");
      const lastRow = document.getElementById("tableBody").lastElementChild;
      const inp     = lastRow.querySelectorAll("input");
      inp[2].value  = r.allowance || 0;
      inp[3].value  = r.hotel     || 0;
      inp[4].value  = r.fuel      || 0;
      inp[5].value  = r.other     || 0;
      inp[6].value  = r.note      || "";
    });
    calcTotal();

    const hint = document.getElementById("importHint");
    if (hint) {
      hint.style.display = "flex";
      hint.querySelector("span:last-child").textContent =
        "โหลด Draft ที่บันทึกไว้แล้ว — แก้ไขต่อได้เลยค่ะ";
    }

    console.log("✅ loadActualDraft:", actualId);
  } catch (err) { console.error("❌ loadActualDraft:", err); }
}

function dismissBanner() {
  const b = document.getElementById("planBanner");
  if (b) b.style.display = "none";
}

// =====================================================
// ➕ ADD ROW
// =====================================================
function addRow(date, route) {
  const today = date || new Date().toISOString().split("T")[0];
  const tr    = document.createElement("tr");
  const safeRoute = (route || "").replace(/"/g, "&quot;");

  tr.innerHTML =
    `<td><input type="date" value="${today}"></td>` +
    `<td><input type="text" value="${safeRoute}" placeholder="เส้นทาง / ร้านค้า"></td>` +
    `<td><input type="number" value="0" min="0" oninput="calcTotal()"></td>` +
    `<td><input type="number" value="0" min="0" oninput="calcTotal()"></td>` +
    `<td><input type="number" value="0" min="0" oninput="calcTotal()"></td>` +
    `<td><input type="number" value="0" min="0" oninput="calcTotal()"></td>` +
    `<td><input type="text" placeholder="หมายเหตุ"></td>`;

  document.getElementById("tableBody").appendChild(tr);
  calcTotal();
}

// =====================================================
// ➖ DELETE ROW
// =====================================================
function deleteRow() {
  const tbody = document.getElementById("tableBody");
  if (tbody.rows.length > 0) { tbody.deleteRow(-1); calcTotal(); }
}

// =====================================================
// 🧮 CALC TOTAL
// =====================================================
function calcTotal() {
  let total = 0;
  const rows = document.querySelectorAll("#tableBody tr");
  rows.forEach((row) => {
    row.querySelectorAll("input[type='number']").forEach((inp) => {
      total += Number(inp.value || 0);
    });
  });
  document.getElementById("days").textContent  = rows.length;
  document.getElementById("total").textContent =
    total.toLocaleString("th-TH", { minimumFractionDigits: 2 });
}

// =====================================================
// 📦 COLLECT FORM DATA
// =====================================================
function collectFormData() {
  const emp  = document.getElementById("empName")?.value?.trim() || "";
  const zone = document.getElementById("empZone")?.value?.trim() || "";

  if (!emp) { alert("ไม่พบข้อมูลพนักงาน กรุณา Login ก่อนค่ะ"); return null; }

  const rows     = [];
  let firstDate  = "";
  let lastDate   = "";
  let grandTotal = 0;

  document.querySelectorAll("#tableBody tr").forEach((tr, i) => {
    const inp        = tr.querySelectorAll("input");
    const date       = inp[0].value;
    const allowance  = Number(inp[2].value || 0);
    const hotel      = Number(inp[3].value || 0);
    const fuel       = Number(inp[4].value || 0);
    const other      = Number(inp[5].value || 0);

    if (i === 0) firstDate = date;
    lastDate = date;
    grandTotal += allowance + hotel + fuel + other;

    rows.push({ date, route: inp[1].value, allowance, hotel, fuel, other, note: inp[6].value });
  });

  if (rows.length === 0) { alert("กรุณาเพิ่มข้อมูลอย่างน้อย 1 แถวค่ะ"); return null; }

  return { emp, zone, start: firstDate, end: lastDate, rows, grandTotal,
           refPlanId: currentPlanId || null };
}

// =====================================================
// 💾 SAVE DRAFT — บันทึกลง Supabase actuals + localStorage backup
// =====================================================
async function saveDraft() {
  const d = collectFormData();
  if (!d) return;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) { alert("กรุณา Login ก่อนบันทึกค่ะ"); return; }

    const payload = {
      user_id:     session.user.id,
      user_name:   d.emp,
      ref_plan_id: d.refPlanId,
      zone:        d.zone,
      start_date:  d.start  || null,
      end_date:    d.end    || null,
      rows:        d.rows,           // jsonb array
      grand_total: d.grandTotal,
      status:      "draft",
      updated_at:  new Date().toISOString(),
    };

    let saveError = null;

    if (actualId) {
      // ── UPDATE record เดิม ──
      const { error } = await supabaseClient
        .from("actuals")
        .update(payload)
        .eq("id", actualId);
      saveError = error;
    } else {
      // ── INSERT record ใหม่ ──
      payload.created_at = new Date().toISOString();
      const { data: inserted, error } = await supabaseClient
        .from("actuals")
        .insert([payload])
        .select("id")
        .single();
      saveError = error;
      if (!error && inserted) actualId = inserted.id; // เก็บ id ไว้ update ครั้งต่อไป
    }

    if (saveError) throw saveError;

    // ── localStorage backup ──
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...d, actualId, savedAt: new Date().toISOString() }));

    console.log("✅ saveDraft:", actualId);
    alert("💾 บันทึก Draft เรียบร้อยค่ะ");

  } catch (err) {
    console.error("❌ saveDraft:", err);
    // ถ้า Supabase ล้มเหลว ยังมี localStorage backup
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...d, savedAt: new Date().toISOString() }));
    alert("⚠️ บันทึก Supabase ไม่สำเร็จ\nบันทึก localStorage ไว้แล้ว\n\nError: " + err.message);
  }
}

// =====================================================
// ✅ SAVE COMPLETED — เปลี่ยน status เป็น completed
// =====================================================
async function saveCompleted() {
  const d = collectFormData();
  if (!d) return;

  if (!actualId) {
    // ยังไม่มี record → save draft ก่อนแล้วค่อย complete
    await saveDraft();
    if (!actualId) return;
  }

  try {
    const { error } = await supabaseClient
      .from("actuals")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", actualId);

    if (error) throw error;

    localStorage.removeItem(STORAGE_KEY); // ลบ draft backup
    console.log("✅ saveCompleted:", actualId);
    alert("✅ บันทึกเอกสารเสร็จสมบูรณ์แล้วค่ะ");
  } catch (err) {
    console.error("❌ saveCompleted:", err);
    alert("❌ บันทึกไม่สำเร็จ: " + err.message);
  }
}

// =====================================================
// 🔍 OPEN PREVIEW
// =====================================================
function openPreview() {
  const d = collectFormData();
  if (!d) return;

  const fmtDate = (s) => {
    if (!s) return "-";
    const [y, m, day] = s.split("-");
    return `${day}/${m}/${y}`;
  };
  const fmt = (n) => Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2 });

  let tRows = "";
  let sAl = 0, sHo = 0, sFu = 0, sOt = 0;

  d.rows.forEach((r, i) => {
    const bg = i % 2 === 1 ? ' style="background:#f7f9fb"' : "";
    tRows +=
      `<tr${bg}>` +
      `<td style="white-space:nowrap">${fmtDate(r.date)}</td>` +
      `<td style="text-align:left;padding-left:8px">${r.route || "-"}</td>` +
      `<td>${r.allowance ? fmt(r.allowance) : "-"}</td>` +
      `<td>${r.hotel     ? fmt(r.hotel)     : "-"}</td>` +
      `<td>${r.fuel      ? fmt(r.fuel)      : "-"}</td>` +
      `<td>${r.other     ? fmt(r.other)     : "-"}</td>` +
      `<td style="text-align:left;padding-left:6px">${r.note || ""}</td>` +
      `</tr>`;
    sAl += r.allowance; sHo += r.hotel; sFu += r.fuel; sOt += r.other;
  });

  const grand   = sAl + sHo + sFu + sOt;
  const today   = new Date().toLocaleDateString("th-TH",
    { year:"numeric", month:"long", day:"numeric" });
  const planRef = d.refPlanId
    ? `<div><span class="dm-label">อ้างอิงแผน :</span>${d.refPlanId.substring(0,8)}...</div>` : "";

  document.getElementById("previewContent").innerHTML = `
<style>
.dw{font-family:'Kanit',sans-serif;font-size:13px;color:#1a1a1a}
.dc{text-align:center;margin-bottom:4px}
.co{font-size:16px;font-weight:700}
.dt{font-size:14px;font-weight:600;margin-top:2px}
hr.dd{border:none;border-top:2px solid #1a1a1a;margin:8px 0 12px}
.dpd{text-align:right;font-size:11px;color:#777;margin-bottom:8px}
.dm{display:grid;grid-template-columns:1fr 1fr;border:1px solid #bbb;border-radius:4px;margin-bottom:14px;overflow:hidden}
.dmc{padding:7px 12px;font-size:12.5px;line-height:1.9}
.dmc:first-child{border-right:1px solid #bbb}
.dm-label{font-weight:700;color:#444;margin-right:4px}
.dmt{width:100%;border-collapse:collapse;margin-bottom:18px;font-size:12px}
.dmt th{background:#1a6b64;color:#fff;padding:8px 7px;text-align:center;border:1px solid #1a6b64;font-size:12px}
.dmt td{padding:7px 6px;border:1px solid #ccc;text-align:center;vertical-align:middle}
.dmt tfoot td{background:#f0f4f8;font-weight:700;border:1px solid #ccc}
.dst{font-size:13px;font-weight:700;margin-bottom:6px;padding-bottom:4px;border-bottom:1.5px solid #1a6b64;display:flex;align-items:center;gap:6px}
.dst::before{content:'';display:inline-block;width:3px;height:14px;background:#3FB7AE;border-radius:2px}
.dct{width:60%;margin-left:auto;margin-bottom:20px;border-collapse:collapse;font-size:12.5px}
.dct td,.dct th{border:1px solid #ccc;padding:6px 10px}
.dct td:first-child{font-weight:600;color:#333}
.dct td:last-child{text-align:right;font-variant-numeric:tabular-nums}
.dct .tr th{background:#1a6b64;color:#fff;text-align:right;padding:7px 10px;font-size:13px}
.ds{margin-top:60px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;text-align:center}
.dsb{font-size:12px;line-height:1.8}
.dsl{border-top:1px solid #555;padding-top:6px;margin-top:36px}
.dsn{font-weight:600}.dsr{color:#555}
</style>
<div class="dw">
  <div class="dpd">วันที่พิมพ์: ${today}</div>
  <div class="dc">
    <div class="co">บริษัท เอิร์นนี่ แอดวานซ์ จำกัด</div>
    <div class="dt">ใบเดินทางจริงและเคลียร์ค่าใช้จ่าย ๒</div>
  </div>
  <hr class="dd">
  <div class="dm">
    <div class="dmc">
      <div><span class="dm-label">พนักงานขาย :</span>${d.emp}</div>
      <div><span class="dm-label">เขตการขาย :</span>${d.zone || "-"}</div>
      ${planRef}
    </div>
    <div class="dmc">
      <div><span class="dm-label">ระหว่างวันที่ :</span>${fmtDate(d.start)}</div>
      <div><span class="dm-label">ถึงวันที่ :</span>${fmtDate(d.end)}</div>
      <div><span class="dm-label">จำนวน :</span>${d.rows.length} วัน</div>
    </div>
  </div>
  <table class="dmt">
    <thead><tr>
      <th style="width:90px">ว/ด/ป</th>
      <th>เส้นทางจริง</th>
      <th style="width:75px">เบี้ยเลี้ยง</th>
      <th style="width:75px">โรงแรม</th>
      <th style="width:70px">น้ำมัน</th>
      <th style="width:70px">อื่นๆ</th>
      <th style="width:85px">หมายเหตุ</th>
    </tr></thead>
    <tbody>${tRows || '<tr><td colspan="7" style="text-align:center;color:#999;padding:16px">ไม่มีข้อมูล</td></tr>'}</tbody>
    <tfoot><tr>
      <td colspan="2" style="text-align:right;padding-right:10px">รวม</td>
      <td>${fmt(sAl)}</td>
      <td>${fmt(sHo)}</td>
      <td>${fmt(sFu)}</td>
      <td>${fmt(sOt)}</td>
      <td></td>
    </tr></tfoot>
  </table>
  <div class="dst">สรุปค่าใช้จ่ายรวม</div>
  <table class="dct">
    <tr><td>เบี้ยเลี้ยง</td><td>${fmt(sAl)} บาท</td></tr>
    <tr><td>ค่าที่พัก / โรงแรม</td><td>${fmt(sHo)} บาท</td></tr>
    <tr><td>ค่าน้ำมัน</td><td>${fmt(sFu)} บาท</td></tr>
    <tr><td>ค่าใช้จ่ายอื่นๆ</td><td>${fmt(sOt)} บาท</td></tr>
    <tr class="tr">
      <th>รวมเคลียร์ค่าใช้จ่ายทั้งหมด</th>
      <th style="font-size:14px">${fmt(grand)} บาท</th>
    </tr>
  </table>
  <div class="ds">
    <div class="dsb"><div class="dsl"><div class="dsn">(${d.emp})</div><div class="dsr">พนักงานขาย</div></div></div>
    <div class="dsb"><div class="dsl"><div class="dsn">(.......................)</div><div class="dsr">ผู้จัดการฝ่ายขาย</div></div></div>
    <div class="dsb"><div class="dsl"><div class="dsn">(.......................)</div><div class="dsr">ฝ่ายบัญชี</div></div></div>
    <div class="dsb"><div class="dsl"><div class="dsn">(.......................)</div><div class="dsr">ผู้อนุมัติ</div></div></div>
  </div>
</div>`;

  document.getElementById("previewModal").style.display = "flex";
}

// ── Modal Controls ──
function closePreview() { document.getElementById("previewModal").style.display = "none"; }
function printPreview() { window.print(); }
function exportPDF()    { window.print(); }

async function saveAndClose() {
  await saveDraft();
  closePreview();
}

// =====================================================
// 📤 EXPORT CSV
// =====================================================
function exportCSV() {
  const d = collectFormData();
  if (!d) return;

  let csv = "วันที่,เส้นทาง,เบี้ยเลี้ยง,โรงแรม,น้ำมัน,อื่นๆ,หมายเหตุ\n";
  d.rows.forEach((r) => {
    csv += [
      r.date,
      `"${r.route}"`,
      r.allowance, r.hotel, r.fuel, r.other,
      `"${r.note}"`
    ].join(",") + "\n";
  });
  csv += `\n,,,,,,\nรวมทั้งหมด,,,,,${d.grandTotal},\n`;

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `Actual_${d.emp}_${d.start || "nodate"}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}