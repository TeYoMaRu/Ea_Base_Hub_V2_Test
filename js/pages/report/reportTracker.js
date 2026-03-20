// =====================================================
// reportTracker.js  — Report Tracker Page
// อิงจาก dashboard.js v2 เดิม:
//   - admin   : เห็นทุกคน
//   - manager : เห็นเฉพาะทีมตัวเอง (team_id match)
// Schema: reports, profiles, shops, products, report_comments
// =====================================================

let allReports    = [];
let filtered      = [];
let shopsMap      = {};
let productsMap   = {};
let profilesMap   = {};   // uid → { display_name, role, team_id }
let currentUser   = null;
let currentModalId = null;

const PAGE_SIZE = 20;
let currentPage = 1;
let weekOffset  = 0;

let activeTeamFilter = null; // sale_id ที่กรองจาก team grid

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  try { await protectPage(["admin", "manager"]); } catch (e) { return; }

  currentUser = await loadCurrentUser();
  if (!currentUser) return;

  await Promise.all([loadProfiles(), loadShops(), loadProducts()]);
  await loadReports();
  setupModal();
  setupLogout();

  document.getElementById("filterSearch")?.addEventListener("keydown", e => {
    if (e.key === "Enter") applyFilter();
  });
});

// =====================================================
// 👤 CURRENT USER  (เหมือนเดิม)
// =====================================================
async function loadCurrentUser() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const { data: p } = await supabaseClient
      .from("profiles")
      .select("id, display_name, role, team_id")
      .eq("id", session.user.id)
      .single();

    const name = p?.display_name || session.user.email;
    setEl("userName",   name);
    setEl("userRole",   p?.role || "");
    setEl("userAvatar", name.charAt(0).toUpperCase());

    return { id: session.user.id, role: p?.role, team_id: p?.team_id, name };
  } catch (e) { console.error(e); return null; }
}

// =====================================================
// 👥 PROFILES  (เหมือนเดิม)
// =====================================================
async function loadProfiles() {
  try {
    let query = supabaseClient
      .from("profiles")
      .select("id, display_name, role, team_id")
      .in("role", ["sales", "user"]);

    if (currentUser.role === "manager" && currentUser.team_id) {
      query = query.eq("team_id", currentUser.team_id);
    }

    const { data } = await query;
    profilesMap = Object.fromEntries((data || []).map(p => [p.id, p]));

    // Populate filter dropdown
    const sel = document.getElementById("filterSales");
    if (sel) {
      sel.innerHTML = `<option value="">— ทั้งหมด —</option>`;
      (data || []).forEach(p => {
        const o = document.createElement("option");
        o.value = p.id; o.textContent = p.display_name;
        sel.appendChild(o);
      });
    }
  } catch (e) { console.error("loadProfiles", e); }
}

// =====================================================
// 🏪 SHOPS / PRODUCTS  (เหมือนเดิม)
// =====================================================
async function loadShops() {
  try {
    const { data } = await supabaseClient.from("shops").select("id, shop_name").order("shop_name");
    shopsMap = Object.fromEntries((data || []).map(s => [s.id, s.shop_name]));
    const sel = document.getElementById("filterShop");
    if (sel) {
      sel.innerHTML = `<option value="">— ทั้งหมด —</option>`;
      (data || []).forEach(s => {
        const o = document.createElement("option");
        o.value = s.id; o.textContent = s.shop_name;
        sel.appendChild(o);
      });
    }
  } catch (e) {}
}

async function loadProducts() {
  try {
    const { data } = await supabaseClient.from("products").select("id, name");
    if (data) data.forEach(p => { productsMap[p.id] = p.name; });
  } catch (e) {}
}

// =====================================================
// 📊 LOAD REPORTS  (อิง loadReports เดิม)
// =====================================================
async function loadReports() {
  const tbody = document.getElementById("reportBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="td-empty">กำลังโหลด...</td></tr>`;

  try {
    const { start, end } = getWeekRange(weekOffset);
    updateWeekLabel(start, end);

    let query = supabaseClient
      .from("reports")
      .select("*")
      .eq("status", "submitted")
      .gte("submitted_at", start.toISOString())
      .lte("submitted_at", end.toISOString())
      .order("submitted_at", { ascending: false });

    // manager กรองเฉพาะทีม
    if (currentUser.role === "manager" && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) query = query.in("sale_id", ids);
    }

    const { data, error } = await query;
    if (error) throw error;

    allReports   = data || [];
    activeTeamFilter = null;
    filtered     = [...allReports];

    updateStatusStrip();
    updateSalesGrid();
    currentPage = 1;
    renderTable();

  } catch (e) {
    console.error("loadReports", e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="td-empty">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
  }
}

// =====================================================
// 📅 WEEK HELPERS  (เหมือนเดิม)
// =====================================================
function getWeekRange(offset = 0) {
  const now  = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const mon  = new Date(now);
  mon.setDate(now.getDate() + diff + offset * 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

function updateWeekLabel(start, end) {
  const fmt = d => d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
  setEl("weekLabel", `${fmt(start)} – ${fmt(end)}`);
  const wkEl = document.getElementById("weekOffsetLabel");
  if (wkEl) {
    if      (weekOffset ===  0) wkEl.textContent = "สัปดาห์นี้";
    else if (weekOffset === -1) wkEl.textContent = "สัปดาห์ที่แล้ว";
    else                        wkEl.textContent = `${Math.abs(weekOffset)} สัปดาห์ก่อน`;
  }
}

async function changeWeek(dir) {
  weekOffset += dir;
  await loadReports();
}

// =====================================================
// 📈 STATUS STRIP
// =====================================================
function updateStatusStrip() {
  const total    = allReports.length;
  const unread   = allReports.filter(r => !r.manager_acknowledged).length;
  const acked    = allReports.filter(r =>  r.manager_acknowledged).length;
  const withCmt  = allReports.filter(r =>  r.manager_comment).length;
  const salesCnt = new Set(allReports.map(r => r.sale_id).filter(Boolean)).size;

  setEl("stTotal",    total.toString());
  setEl("stUnread",   unread.toString());
  setEl("stAcked",    acked.toString());
  setEl("stComments", withCmt.toString());
  setEl("stSales",    salesCnt.toString());
}

// =====================================================
// 👥 SALES GRID  (อิง updateSalesGrid เดิม)
// =====================================================
function updateSalesGrid() {
  const grid = document.getElementById("salesGrid"); if (!grid) return;

  const sentIds = new Set(allReports.map(r => r.sale_id));
  const entries = Object.entries(profilesMap);

  if (!entries.length) {
    grid.innerHTML = `<div class="loading-text">ไม่มีข้อมูล</div>`;
    return;
  }

  grid.innerHTML = entries.map(([id, p]) => {
    const count    = allReports.filter(r => r.sale_id === id).length;
    const unread   = allReports.filter(r => r.sale_id === id && !r.manager_acknowledged).length;
    const sent     = sentIds.has(id);
    const isActive = activeTeamFilter === id;

    return `
      <div class="sales-card ${sent ? "sent" : "not-sent"} ${isActive ? "filter-active" : ""}"
           onclick="filterBySales('${id}')">
        <div class="sales-avatar">${(p.display_name || "?").charAt(0).toUpperCase()}</div>
        <div class="sales-info">
          <div class="sales-name">${p.display_name}</div>
          <div class="sales-count">${count} รายการ${unread ? ` · <span style="color:var(--accent3)">${unread} ยังไม่อ่าน</span>` : ""}</div>
        </div>
        <div class="sales-status-icon">${sent ? "✅" : "⏳"}</div>
      </div>`;
  }).join("");
}

// คลิกการ์ด → กรอง (toggle)
function filterBySales(saleId) {
  if (activeTeamFilter === saleId) {
    activeTeamFilter = null;
    document.getElementById("filterSales").value = "";
  } else {
    activeTeamFilter = saleId;
    document.getElementById("filterSales").value = saleId;
  }
  updateSalesGrid();
  applyFilter();
}

// =====================================================
// 🔍 FILTER  (อิง applyFilter เดิม + เพิ่ม search)
// =====================================================
function applyFilter() {
  const salesId = document.getElementById("filterSales")?.value;
  const shopId  = document.getElementById("filterShop")?.value;
  const ack     = document.getElementById("filterAck")?.value;
  const search  = document.getElementById("filterSearch")?.value.toLowerCase() || "";

  filtered = allReports.filter(r => {
    if (salesId && r.sale_id !== salesId)        return false;
    if (shopId  && r.shop_id !== shopId)         return false;
    if (ack === "yes" && !r.manager_acknowledged) return false;
    if (ack === "no"  &&  r.manager_acknowledged) return false;
    if (search) {
      const hay = [
        shopsMap[r.shop_id],
        productsMap[r.product_id],
        r.note,
        profilesMap[r.sale_id]?.display_name,
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  currentPage = 1;
  renderTable();
  updateTableCount();
}

function resetFilter() {
  ["filterSales", "filterShop", "filterAck"].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = "";
  });
  const s = document.getElementById("filterSearch"); if (s) s.value = "";
  activeTeamFilter = null;
  updateSalesGrid();
  filtered = [...allReports];
  currentPage = 1;
  renderTable();
  updateTableCount();
}

function updateTableCount() {
  setEl("tableCount", filtered.length !== allReports.length
    ? `(${filtered.length} / ${allReports.length} รายการ)`
    : `(${allReports.length} รายการ)`
  );
}

// =====================================================
// 🎨 RENDER TABLE  (อิง renderTable เดิม)
// =====================================================
function renderTable() {
  const tbody = document.getElementById("reportBody"); if (!tbody) return;
  const start = (currentPage - 1) * PAGE_SIZE;
  const page  = filtered.slice(start, start + PAGE_SIZE);

  tbody.innerHTML = "";

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="td-empty">ไม่มีข้อมูล</td></tr>`;
    renderPagination();
    return;
  }

  page.forEach(r => {
    const p    = profilesMap[r.sale_id];
    const name = p?.display_name || "—";
    const ack  = r.manager_acknowledged
      ? `<span class="badge-ack">✅ รับทราบแล้ว</span>`
      : `<span class="badge-pending">🕐 รอ</span>`;
    const tr = document.createElement("tr");
    if (!r.manager_acknowledged) tr.classList.add("row-unread");

    tr.innerHTML = `
      <td>${formatDate(r.submitted_at || r.report_date)}</td>
      <td><div class="sales-chip"><span class="chip-av">${name.charAt(0)}</span>${name}</div></td>
      <td>${shopsMap[r.shop_id] || "—"}</td>
      <td><span class="badge-submitted">✅ ส่งแล้ว</span></td>
      <td>${productsMap[r.product_id] || "—"}</td>
      <td style="text-align:right">${(r.quantity || 0).toLocaleString("th-TH")}</td>
      <td>${ack}</td>
      <td><button class="btn-view-detail" onclick="event.stopPropagation();openReportModal('${r.id}')">🔍 ดู / Comment</button></td>
    `;
    tr.addEventListener("click", () => openReportModal(r.id));
    tbody.appendChild(tr);
  });

  renderPagination();
  updateTableCount();
}

function renderPagination() {
  const el    = document.getElementById("pagination"); if (!el) return;
  const total = Math.ceil(filtered.length / PAGE_SIZE);
  if (total <= 1) { el.innerHTML = ""; return; }

  let html = `<span style="font-size:12px;color:var(--text-muted)">หน้า ${currentPage}/${total}</span> `;
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn${i === currentPage ? " active" : ""}" onclick="goPage(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

function goPage(n) { currentPage = n; renderTable(); window.scrollTo(0, 0); }

// =====================================================
// 📋 MODAL  (อิง openReportModal เดิม)
// =====================================================
async function openReportModal(id) {
  const r = allReports.find(x => x.id === id); if (!r) return;
  currentModalId = id;

  const salesName = profilesMap[r.sale_id]?.display_name || "—";
  setEl("modalTitle", `รายงาน — ${salesName}`);

  const set = (eid, v) => setEl(eid, v || "—");
  set("m-date",    formatDate(r.submitted_at || r.report_date));
  set("m-sales",   salesName);
  set("m-store",   shopsMap[r.shop_id] || "—");
  set("m-product", productsMap[r.product_id] || "—");
  set("m-source",  r.source || "—");
  set("m-qty",     (r.quantity || 0).toLocaleString("th-TH"));
  set("m-followup", formatDate(r.followup_date));

  const statusEl = document.getElementById("m-status");
  if (statusEl) statusEl.innerHTML = r.manager_acknowledged
    ? `✅ ส่งแล้ว &nbsp;<span class="badge-ack">✅ รับทราบแล้ว</span>`
    : `✅ ส่งแล้ว &nbsp;<span class="badge-pending">🕐 รอผู้บริหารอ่าน</span>`;

  const attrEl = document.getElementById("m-attributes");
  if (attrEl) attrEl.innerHTML = await formatAttributes(r.attributes);

  const noteEl = document.getElementById("m-note-text");
  if (noteEl) noteEl.textContent = r.note || "—";

  const cmtInput = document.getElementById("managerComment");
  if (cmtInput) cmtInput.value = "";

  await loadComments(id);
  openModal();
}

async function loadComments(reportId) {
  const container = document.getElementById("existingComments"); if (!container) return;
  try {
    const { data } = await supabaseClient
      .from("report_comments")
      .select("comment, created_at, profiles(display_name)")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });

    if (!data?.length) {
      container.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:4px 0">ยังไม่มี comment</div>`;
      return;
    }
    container.innerHTML = data.map(c => `
      <div class="comment-item">
        <div class="comment-meta">
          <strong>${c.profiles?.display_name || "ผู้บริหาร"}</strong>
          <span>${formatDate(c.created_at)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.comment)}</div>
      </div>
    `).join("");
  } catch (e) { container.innerHTML = ""; }
}

// =====================================================
// ✅ ACKNOWLEDGE  (เหมือนเดิม)
// =====================================================
async function acknowledgeReport() {
  if (!currentModalId) return;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    // บันทึก comment ก่อนถ้ามี
    const text = document.getElementById("managerComment")?.value.trim();
    if (text) await saveComment();

    const { error } = await supabaseClient
      .from("reports")
      .update({
        manager_acknowledged: true,
        acknowledged_by:      session.user.id,
        acknowledged_at:      new Date().toISOString()
      })
      .eq("id", currentModalId);
    if (error) throw error;

    // อัปเดต local state
    const idx = allReports.findIndex(r => r.id === currentModalId);
    if (idx !== -1) allReports[idx].manager_acknowledged = true;
    filtered = filtered.map(r => r.id === currentModalId ? { ...r, manager_acknowledged: true } : r);

    showToast("✅ รับทราบรายงานแล้ว");
    updateStatusStrip();
    updateSalesGrid();
    renderTable();
    closeModal();
  } catch (e) { alert("❌ เกิดข้อผิดพลาด: " + e.message); }
}

// =====================================================
// 💬 SAVE COMMENT  (เหมือนเดิม)
// =====================================================
async function saveComment() {
  if (!currentModalId) return;
  const text = document.getElementById("managerComment")?.value.trim();
  if (!text) { showToast("⚠️ กรุณาพิมพ์ comment", false); return; }

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const { error } = await supabaseClient.from("report_comments").insert([{
      report_id:  currentModalId,
      manager_id: session.user.id,
      comment:    text,
      created_at: new Date().toISOString()
    }]);
    if (error) throw error;

    // อัปเดต local flag
    const r = allReports.find(x => x.id === currentModalId);
    if (r) r.manager_comment = text;

    document.getElementById("managerComment").value = "";
    await loadComments(currentModalId);
    showToast("💬 บันทึก Comment แล้ว");
  } catch (e) { alert("❌ บันทึกไม่สำเร็จ: " + e.message); }
}

// =====================================================
// 📤 EXPORT CSV  (เหมือนเดิม)
// =====================================================
function exportData(type) {
  if (type !== "csv") { alert("🚧 กำลังพัฒนา"); return; }
  if (!filtered.length) { alert("ไม่มีข้อมูล"); return; }

  const headers = ["วันที่ส่ง", "เซลล์", "ร้านค้า", "สินค้า", "ยอด", "หมายเหตุ", "รับทราบแล้ว"];
  const rows = filtered.map(r => [
    formatDate(r.submitted_at || r.report_date),
    profilesMap[r.sale_id]?.display_name || "—",
    shopsMap[r.shop_id]    || "—",
    productsMap[r.product_id] || "—",
    r.quantity || 0,
    (r.note || "—").replace(/,/g, " "),
    r.manager_acknowledged ? "ใช่" : "ยังไม่"
  ]);

  const csv  = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a    = document.createElement("a");
  a.href     = URL.createObjectURL(blob);
  a.download = `team_reports_week${weekOffset}_${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  showToast("📄 Export สำเร็จ");
}

// =====================================================
// MODAL SETUP  (เหมือนเดิม)
// =====================================================
function setupModal() {
  document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
  document.getElementById("reportModal")?.addEventListener("click", e => {
    if (e.target === document.getElementById("reportModal")) closeModal();
  });
}

function openModal() {
  const m = document.getElementById("reportModal");
  if (m) { m.style.display = "flex"; document.body.style.overflow = "hidden"; }
}
function closeModal() {
  const m = document.getElementById("reportModal");
  if (m) { m.style.display = "none"; document.body.style.overflow = ""; }
  currentModalId = null;
}

// =====================================================
// HELPERS
// =====================================================
function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" }); }
  catch (e) { return "—"; }
}

async function formatAttributes(attrs) {
  if (!attrs || !Object.keys(attrs).length) return "";
  try {
    const { data: ad } = await supabaseClient
      .from("attributes").select("id, name").in("id", Object.keys(attrs));
    const am = Object.fromEntries((ad || []).map(a => [a.id, a.name]));
    return `<div class="note-display" style="margin:8px 0;font-size:13px;">` +
      Object.entries(attrs).map(([k, v]) => `<strong>${am[k] || k}:</strong> ${v}`).join("<br>") +
      `</div>`;
  } catch (e) { return ""; }
}

function escapeHtml(t) {
  if (!t) return "";
  const d = document.createElement("div"); d.textContent = t; return d.innerHTML;
}

function setEl(id, val) {
  const el = document.getElementById(id); if (el) el.textContent = val;
}

function showToast(msg) {
  const t = document.getElementById("toast"); if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function setupLogout() {
  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    window.location.href = "/pages/auth/login.html";
  });
}