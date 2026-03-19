// =====================================================
// dashboard.js  v2  — Manager Dashboard
// - admin   : เห็นทุกคน
// - manager : เห็นเฉพาะทีมตัวเอง (team_id match)
// =====================================================

let allReports   = [];
let filtered     = [];
let shopsMap     = {};
let productsMap  = {};
let profilesMap  = {};   // uid → { name, role, team_id }
let currentUser  = null; // { id, role, team_id }
let currentModalId = null;
let chartSales, chartShop, chartProduct, chartWeekly;

const PAGE_SIZE = 20;
let currentPage = 1;
let weekOffset  = 0;

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  try { await protectPage(["admin","manager"]); } catch(e){ return; }

  currentUser = await loadCurrentUser();
  if (!currentUser) return;

  await Promise.all([loadProfiles(), loadShops(), loadProducts()]);
  await loadReports();
  setupModal();
  setupLogout();
});

// =====================================================
// 👤 CURRENT USER
// =====================================================
async function loadCurrentUser() {
  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const { data:p } = await supabaseClient.from("profiles")
      .select("id, display_name, role, team_id")
      .eq("id", session.user.id).single();

    const name = p?.display_name || session.user.email;
    const el = id => document.getElementById(id);
    if (el("userName"))   el("userName").textContent   = name;
    if (el("userRole"))   el("userRole").textContent   = p?.role || "";
    if (el("userAvatar")) el("userAvatar").textContent = name.charAt(0).toUpperCase();

    return { id: session.user.id, role: p?.role, team_id: p?.team_id, name };
  } catch(e){ console.error(e); return null; }
}

// =====================================================
// 👥 LOAD PROFILES
// =====================================================
async function loadProfiles() {
  try {
    let query = supabaseClient.from("profiles").select("id, display_name, role, team_id").in("role",["sales","user"]);

    // manager เห็นเฉพาะทีมตัวเอง
    if (currentUser.role === "manager" && currentUser.team_id) {
      query = query.eq("team_id", currentUser.team_id);
    }

    const { data } = await query;
    profilesMap = Object.fromEntries((data||[]).map(p=>[p.id, p]));

    const sel = document.getElementById("filterSales"); if(!sel) return;
    sel.innerHTML = `<option value="">— ทั้งหมด —</option>`;
    (data||[]).forEach(p => {
      const o = document.createElement("option"); o.value=p.id; o.textContent=p.display_name; sel.appendChild(o);
    });
  } catch(e){ console.error("loadProfiles",e); }
}

// =====================================================
// 🏪 SHOPS / PRODUCTS
// =====================================================
async function loadShops() {
  try {
    const { data } = await supabaseClient.from("shops").select("id,shop_name").order("shop_name");
    shopsMap = Object.fromEntries((data||[]).map(s=>[s.id,s.shop_name]));
    const sel = document.getElementById("filterShop"); if(!sel) return;
    sel.innerHTML = `<option value="">— ทั้งหมด —</option>`;
    (data||[]).forEach(s => { const o=document.createElement("option"); o.value=s.id; o.textContent=s.shop_name; sel.appendChild(o); });
  } catch(e){}
}

async function loadProducts() {
  try {
    const { data } = await supabaseClient.from("products").select("id,name");
    if (data) data.forEach(p=>{ productsMap[p.id]=p.name; });
  } catch(e){}
}

// =====================================================
// 📊 LOAD REPORTS
// =====================================================
async function loadReports() {
  const tbody = document.getElementById("reportBody");
  if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center">กำลังโหลด...</td></tr>`;

  try {
    const { start, end } = getWeekRange(weekOffset);
    updateWeekLabel(start, end);

    let query = supabaseClient
      .from("reports")
      .select("*")
      .eq("status","submitted")
      .gte("submitted_at", start.toISOString())
      .lte("submitted_at", end.toISOString())
      .order("submitted_at",{ascending:false});

    // manager กรองเฉพาะทีม
    if (currentUser.role === "manager" && currentUser.team_id) {
      const teamMemberIds = Object.keys(profilesMap);
      if (teamMemberIds.length) query = query.in("sale_id", teamMemberIds);
    }

    const { data, error } = await query;
    if (error) throw error;

    allReports = data || [];
    filtered   = [...allReports];

    updateKPI();
    updateSalesGrid();
    renderCharts();
    currentPage = 1;
    renderTable();

  } catch(e) {
    console.error("loadReports",e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="8">เกิดข้อผิดพลาด: ${e.message}</td></tr>`;
  }
}

// =====================================================
// 📅 WEEK HELPERS
// =====================================================
function getWeekRange(offset=0) {
  const now = new Date();
  const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
  const mon = new Date(now); mon.setDate(now.getDate()+diff+offset*7); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return { start:mon, end:sun };
}

function updateWeekLabel(start, end) {
  const fmt = d => d.toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"numeric"});
  const el = document.getElementById("weekLabel"); if(el) el.textContent=`${fmt(start)} – ${fmt(end)}`;
  const wk = document.getElementById("weekOffsetLabel"); if(wk) {
    if (weekOffset===0) wk.textContent="สัปดาห์นี้";
    else if (weekOffset===-1) wk.textContent="สัปดาห์ที่แล้ว";
    else wk.textContent=`${Math.abs(weekOffset)} สัปดาห์ก่อน`;
  }
}

async function changeWeek(dir) { weekOffset+=dir; await loadReports(); }

// =====================================================
// 📈 KPI
// =====================================================
function updateKPI() {
  const total   = allReports.length;
  const amount  = allReports.reduce((s,r)=>s+(r.quantity||0),0);
  const shops   = new Set(allReports.map(r=>r.shop_id).filter(Boolean)).size;
  const salesSent = new Set(allReports.map(r=>r.sale_id).filter(Boolean)).size;
  const totalSales = Object.keys(profilesMap).length;
  const ackd    = allReports.filter(r=>r.manager_acknowledged).length;

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set("kpiTotal",     total.toLocaleString());
  set("kpiAmount",    amount.toLocaleString("th-TH"));
  set("kpiShops",     shops.toLocaleString());
  set("kpiSalesRate", `${salesSent}/${totalSales}`);
  set("kpiAck",       `${ackd}/${total}`);
}

// =====================================================
// 👥 SALES GRID
// =====================================================
function updateSalesGrid() {
  const grid = document.getElementById("salesGrid"); if(!grid) return;
  const sentIds = new Set(allReports.map(r=>r.sale_id));
  const entries = Object.entries(profilesMap);

  if (!entries.length) { grid.innerHTML=`<div class="loading-text">ไม่มีข้อมูล</div>`; return; }

  grid.innerHTML = entries.map(([id,p]) => {
    const count = allReports.filter(r=>r.sale_id===id).length;
    const sent  = sentIds.has(id);
    return `
      <div class="sales-card ${sent?"sent":"not-sent"}" onclick="filterBySales('${id}')">
        <div class="sales-avatar">${(p.display_name||"?").charAt(0).toUpperCase()}</div>
        <div class="sales-info">
          <div class="sales-name">${p.display_name}</div>
          <div class="sales-count">${count} รายการ</div>
        </div>
        <div class="sales-status-icon">${sent?"✅":"⏳"}</div>
      </div>`;
  }).join("");
}

function filterBySales(saleId) {
  document.getElementById("filterSales").value = saleId;
  applyFilter();
}

// =====================================================
// 📊 CHARTS (Chart.js)
// =====================================================
function renderCharts() {
  renderSalesChart();
  renderShopChart();
  renderProductChart();
  renderWeeklyTrendChart();
}

function destroyChart(chart) { if (chart) { try { chart.destroy(); } catch(e){} } }

function renderSalesChart() {
  const ctx = document.getElementById("chartSales"); if(!ctx) return;
  destroyChart(chartSales);

  const salesTotals = {};
  allReports.forEach(r => {
    const name = profilesMap[r.sale_id]?.display_name || r.sale_id || "ไม่ระบุ";
    salesTotals[name] = (salesTotals[name]||0) + (r.quantity||0);
  });

  const sorted = Object.entries(salesTotals).sort((a,b)=>b[1]-a[1]);
  const labels = sorted.map(([k])=>k);
  const values = sorted.map(([,v])=>v);

  chartSales = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "ยอดสั่งซื้อ (฿)",
        data: values,
        backgroundColor: "rgba(13,148,136,0.75)",
        borderColor: "#0d9488",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero:true, ticks: { callback: v => v.toLocaleString("th-TH") } }
      }
    }
  });
}

function renderShopChart() {
  const ctx = document.getElementById("chartShop"); if(!ctx) return;
  destroyChart(chartShop);

  const shopCounts = {};
  allReports.forEach(r => {
    const name = shopsMap[r.shop_id] || "ไม่ระบุ";
    shopCounts[name] = (shopCounts[name]||0) + 1;
  });

  const sorted = Object.entries(shopCounts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  const colors = ["#0d9488","#14b8a6","#2dd4bf","#5eead4","#99f6e4","#f59e0b","#fbbf24","#fcd34d"];

  chartShop = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{
        data: sorted.map(([,v])=>v),
        backgroundColor: colors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "right", labels: { font:{ size:12 }, boxWidth:14 } } }
    }
  });
}

function renderProductChart() {
  const ctx = document.getElementById("chartProduct"); if(!ctx) return;
  destroyChart(chartProduct);

  const prodTotals = {};
  allReports.forEach(r => {
    const name = productsMap[r.product_id] || "ไม่ระบุ";
    prodTotals[name] = (prodTotals[name]||0) + (r.quantity||0);
  });

  const sorted = Object.entries(prodTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);

  chartProduct = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sorted.map(([k])=>k),
      datasets: [{
        label: "ยอดรวม (฿)",
        data: sorted.map(([,v])=>v),
        backgroundColor: "rgba(139,92,246,0.75)",
        borderColor: "#7c3aed",
        borderWidth: 1,
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display:false } },
      scales: { x: { beginAtZero:true, ticks: { callback: v => v.toLocaleString("th-TH") } } }
    }
  });
}

async function renderWeeklyTrendChart() {
  const ctx = document.getElementById("chartWeekly"); if(!ctx) return;
  destroyChart(chartWeekly);

  try {
    // โหลด 8 สัปดาห์ย้อนหลัง
    const now = new Date();
    const { start: eightWeeksAgo } = getWeekRangeAbs(now, -7);

    let query = supabaseClient
      .from("reports")
      .select("submitted_at, quantity")
      .eq("status","submitted")
      .gte("submitted_at", eightWeeksAgo.toISOString());

    if (currentUser.role === "manager" && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) query = query.in("sale_id", ids);
    }

    const { data } = await query;
    if (!data) return;

    // จัด group by week
    const weekTotals = {};
    data.forEach(r => {
      const d = new Date(r.submitted_at);
      const wk = getWeekKey(d);
      weekTotals[wk] = (weekTotals[wk]||0) + (r.quantity||0);
    });

    const labels = Object.keys(weekTotals).sort();
    const values = labels.map(k=>weekTotals[k]);

    chartWeekly = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map(k => {
          const [y,w] = k.split("-W");
          return `สัปดาห์ ${w}`;
        }),
        datasets: [{
          label: "ยอดรวม (฿)",
          data: values,
          borderColor: "#0d9488",
          backgroundColor: "rgba(13,148,136,0.1)",
          tension: 0.4,
          fill: true,
          pointBackgroundColor: "#0d9488",
          pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display:false } },
        scales: { y: { beginAtZero:true, ticks: { callback: v=>v.toLocaleString("th-TH") } } }
      }
    });
  } catch(e){ console.error("weeklyChart", e); }
}

function getWeekKey(d) {
  const jan1 = new Date(d.getFullYear(),0,1);
  const wk   = Math.ceil(((d - jan1)/86400000 + jan1.getDay()+1)/7);
  return `${d.getFullYear()}-W${String(wk).padStart(2,"0")}`;
}

function getWeekRangeAbs(refDate, weekDelta) {
  const d = new Date(refDate);
  const diff = d.getDay()===0 ? -6 : 1-d.getDay();
  const mon = new Date(d); mon.setDate(d.getDate()+diff+weekDelta*7); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999);
  return { start:mon, end:sun };
}

// =====================================================
// 🔍 FILTER
// =====================================================
function applyFilter() {
  const salesId = document.getElementById("filterSales")?.value;
  const shopId  = document.getElementById("filterShop")?.value;
  const ack     = document.getElementById("filterAck")?.value;

  filtered = allReports.filter(r => {
    if (salesId && r.sale_id  !== salesId)           return false;
    if (shopId  && r.shop_id  !== shopId)             return false;
    if (ack === "yes" && !r.manager_acknowledged)     return false;
    if (ack === "no"  &&  r.manager_acknowledged)     return false;
    return true;
  });
  currentPage = 1;
  renderTable();
}

function resetFilter() {
  ["filterSales","filterShop","filterAck"].forEach(id => { const el=document.getElementById(id); if(el) el.value=""; });
  filtered=[...allReports]; currentPage=1; renderTable();
}

// =====================================================
// 🎨 RENDER TABLE
// =====================================================
function renderTable() {
  const tbody = document.getElementById("reportBody"); if(!tbody) return;
  const start = (currentPage-1)*PAGE_SIZE;
  const page  = filtered.slice(start, start+PAGE_SIZE);

  tbody.innerHTML = "";

  if (!page.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:#888;">ไม่มีข้อมูล</td></tr>`;
    renderPagination(); return;
  }

  page.forEach(r => {
    const p    = profilesMap[r.sale_id];
    const name = p?.display_name || "—";
    const ack  = r.manager_acknowledged ? `<span class="badge-ack">👁️ อ่านแล้ว</span>` : `<span class="badge-pending">🕐 รอ</span>`;
    const tr   = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatDate(r.submitted_at||r.report_date)}</td>
      <td><div class="sales-chip"><span class="chip-av">${name.charAt(0)}</span>${name}</div></td>
      <td>${shopsMap[r.shop_id]||"—"}</td>
      <td><span class="badge-submitted">✅ ส่งแล้ว</span></td>
      <td>${productsMap[r.product_id]||"—"}</td>
      <td style="text-align:right">${(r.quantity||0).toLocaleString()}</td>
      <td>${ack}</td>
      <td><button class="btn-view-detail" onclick="openReportModal('${r.id}')">🔍 ดู / Comment</button></td>
    `;
    tbody.appendChild(tr);
  });

  renderPagination();
}

function renderPagination() {
  const el = document.getElementById("pagination"); if(!el) return;
  const total = Math.ceil(filtered.length/PAGE_SIZE);
  if (total<=1) { el.innerHTML=""; return; }
  let html = `<span style="font-size:12px;color:#888;">หน้า ${currentPage}/${total} (${filtered.length} รายการ)</span> `;
  for(let i=1;i<=total;i++) html+=`<button class="page-btn${i===currentPage?" active":""}" onclick="goPage(${i})">${i}</button>`;
  el.innerHTML = html;
}

function goPage(n) { currentPage=n; renderTable(); }

// =====================================================
// 📋 MODAL: VIEW + COMMENT + ACKNOWLEDGE
// =====================================================
async function openReportModal(id) {
  const r = allReports.find(x=>x.id===id); if(!r) return;
  currentModalId = id;
  const salesName = profilesMap[r.sale_id]?.display_name || "—";

  document.getElementById("modalTitle").innerText = `รายงาน — ${salesName}`;

  const set = (eid,v) => { const el=document.getElementById(eid); if(el) el.innerText=v||"—"; };
  set("m-date",    formatDate(r.submitted_at||r.report_date));
  set("m-sales",   salesName);
  set("m-store",   shopsMap[r.shop_id]||"—");
  set("m-product", productsMap[r.product_id]||"—");
  set("m-source",  r.source||"—");
  set("m-qty",     (r.quantity||0).toLocaleString());
  set("m-followup",formatDate(r.followup_date));

  const statusEl = document.getElementById("m-status");
  if (statusEl) statusEl.innerHTML = r.manager_acknowledged
    ? `✅ ส่งแล้ว &nbsp;<span class="badge-ack">👁️ อ่านแล้วแล้ว</span>`
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
  const container = document.getElementById("existingComments"); if(!container) return;
  try {
    const { data } = await supabaseClient
      .from("report_comments")
      .select("comment, created_at, profiles(display_name)")
      .eq("report_id", reportId)
      .order("created_at",{ascending:true});

    if (!data?.length) {
      container.innerHTML = `<div style="color:#aaa;font-size:12px;padding:4px;">ยังไม่มี comment</div>`;
      return;
    }
    container.innerHTML = data.map(c => `
      <div class="comment-item">
        <div class="comment-meta">
          <strong>${c.profiles?.display_name||"ผู้บริหาร"}</strong>
          <span>${formatDate(c.created_at)}</span>
        </div>
        <div class="comment-text">${escapeHtml(c.comment)}</div>
      </div>
    `).join("");
  } catch(e) { container.innerHTML=""; }
}

async function saveComment() {
  if (!currentModalId) return;
  const text = document.getElementById("managerComment")?.value.trim();
  if (!text) { alert("กรุณาพิมพ์ comment"); return; }

  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    const { error } = await supabaseClient.from("report_comments").insert([{
      report_id:  currentModalId,
      manager_id: session.user.id,
      comment:    text,
      created_at: new Date().toISOString()
    }]);
    if (error) throw error;
    document.getElementById("managerComment").value = "";
    await loadComments(currentModalId);
    showToast("💬 บันทึก Comment แล้ว");
  } catch(e) { alert("❌ บันทึกไม่สำเร็จ: "+e.message); }
}

async function acknowledgeReport() {
  if (!currentModalId) return;
  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();

    // บันทึก comment ถ้ามี
    const text = document.getElementById("managerComment")?.value.trim();
    if (text) await saveComment();

    const { error } = await supabaseClient.from("reports").update({
      manager_acknowledged: true,
      acknowledged_by:      session.user.id,
      acknowledged_at:      new Date().toISOString()
    }).eq("id", currentModalId);
    if (error) throw error;

    const idx = allReports.findIndex(r=>r.id===currentModalId);
    if (idx!==-1) allReports[idx].manager_acknowledged = true;
    filtered = filtered.map(r => r.id===currentModalId ? {...r,manager_acknowledged:true} : r);

    showToast("✅ รับทราบรายงานแล้ว");
    updateKPI();
    renderTable();
    closeModal();
  } catch(e) { alert("❌ เกิดข้อผิดพลาด: "+e.message); }
}

// =====================================================
// 📤 EXPORT
// =====================================================
function exportData(type) {
  if (type!=="csv") { alert("🚧 กำลังพัฒนา"); return; }
  if (!filtered.length) { alert("ไม่มีข้อมูล"); return; }
  const headers = ["วันที่ส่ง","เซลล์","ร้านค้า","สินค้า","ยอด","หมายเหตุ","อ่านแล้ว"];
  const rows = filtered.map(r => [
    formatDate(r.submitted_at||r.report_date),
    profilesMap[r.sale_id]?.display_name||"—",
    shopsMap[r.shop_id]||"—",
    productsMap[r.product_id]||"—",
    r.quantity||0,
    (r.note||"—").replace(/,/g," "),
    r.manager_acknowledged?"ใช่":"ยังไม่"
  ]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`team_reports_week${weekOffset}_${new Date().toISOString().split("T")[0]}.csv`; a.click();
}

// =====================================================
// MODAL
// =====================================================
function setupModal() {
  document.getElementById("closeModalBtn")?.addEventListener("click", closeModal);
  document.getElementById("reportModal")?.addEventListener("click", e => { if(e.target===document.getElementById("reportModal")) closeModal(); });
}

function openModal()  { const m=document.getElementById("reportModal"); if(m){ m.style.display="flex"; document.body.style.overflow="hidden"; } }
function closeModal() { const m=document.getElementById("reportModal"); if(m){ m.style.display="none";  document.body.style.overflow=""; } currentModalId=null; }

// =====================================================
// HELPERS
// =====================================================
function formatDate(s) {
  if(!s) return "—";
  try { return new Date(s).toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"}); } catch(e){ return "—"; }
}

async function formatAttributes(attrs) {
  if (!attrs||!Object.keys(attrs).length) return "";
  try {
    const { data:ad } = await supabaseClient.from("attributes").select("id,name").in("id",Object.keys(attrs));
    const am = Object.fromEntries((ad||[]).map(a=>[a.id,a.name]));
    return `<div style="background:#f8fafc;border-radius:6px;padding:8px;font-size:13px;">`+
      Object.entries(attrs).map(([k,v])=>`<strong>${am[k]||k}:</strong> ${v}`).join("<br>")+`</div>`;
  } catch(e){ return ""; }
}

function escapeHtml(t) {
  if(!t) return ""; const d=document.createElement("div"); d.textContent=t; return d.innerHTML;
}

function showToast(msg) {
  const t=document.getElementById("toast"); if(!t){ console.log(msg); return; }
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),3000);
}

function setupLogout() {
  document.getElementById("logoutBtn")?.addEventListener("click", async ()=>{ await supabaseClient.auth.signOut(); window.location.href="/pages/auth/login.html"; });
}