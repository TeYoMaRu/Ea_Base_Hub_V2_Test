// =====================================================
// managerDashboard.js  — Sales Intelligence Dashboard
// อิงจาก dashboard.js v2 เดิม:
//   - admin   : เห็นทุกคน
//   - manager : เห็นเฉพาะทีมตัวเอง (team_id match)
// Schema: reports, profiles, shops, products
// =====================================================

let allReports   = [];
let prevReports  = [];
let shopsMap     = {};
let productsMap  = {};
let profilesMap  = {};   // uid → { display_name, role, team_id }
let currentUser  = null; // { id, role, team_id, name }
let weekOffset   = 0;

let chartSalesInst, chartShopInst, chartProductInst, chartWeeklyInst;

// ── TARGET mock (เปลี่ยนเป็น query จาก DB ได้) ─────────────────────────
const TARGET_PER_SALES = 100000;

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  try { await protectPage(["admin", "manager"]); } catch (e) { return; }

  currentUser = await loadCurrentUser();
  if (!currentUser) return;

  await Promise.all([loadProfiles(), loadShops(), loadProducts()]);
  await loadDashboard();
  setupLogout();
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
  } catch (e) { console.error("loadProfiles", e); }
}

// =====================================================
// 🏪 SHOPS / PRODUCTS  (เหมือนเดิม)
// =====================================================
async function loadShops() {
  try {
    const { data } = await supabaseClient.from("shops").select("id, shop_name").order("shop_name");
    shopsMap = Object.fromEntries((data || []).map(s => [s.id, s.shop_name]));
  } catch (e) {}
}

async function loadProducts() {
  try {
    const { data } = await supabaseClient.from("products").select("id, name");
    if (data) data.forEach(p => { productsMap[p.id] = p.name; });
  } catch (e) {}
}

// =====================================================
// 📊 MAIN LOAD
// =====================================================
async function loadDashboard() {
  try {
    const { start, end } = getWeekRange(weekOffset);
    updateWeekLabel(start, end);

    // ── ดึงสัปดาห์ปัจจุบัน ──
    let q = supabaseClient
      .from("reports")
      .select("*")
      .eq("status", "submitted")
      .gte("submitted_at", start.toISOString())
      .lte("submitted_at", end.toISOString())
      .order("submitted_at", { ascending: false });

    if (currentUser.role === "manager" && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) q = q.in("sale_id", ids);
    }

    const { data, error } = await q;
    if (error) throw error;
    allReports = data || [];

    // ── ดึงสัปดาห์ก่อน (เพื่อ growth) ──
    const { start: ps, end: pe } = getWeekRange(weekOffset - 1);
    let qp = supabaseClient
      .from("reports")
      .select("sale_id, quantity, shop_id")
      .eq("status", "submitted")
      .gte("submitted_at", ps.toISOString())
      .lte("submitted_at", pe.toISOString());

    if (currentUser.role === "manager" && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) qp = qp.in("sale_id", ids);
    }
    const { data: pd } = await qp;
    prevReports = pd || [];

    // ── Render ──
    renderKPIs();
    renderInsightPills();
    renderTargetBars();
    renderLeaderboard();
    renderTopProductsList();
    await renderWeeklyTrendChart();
    renderSalesChart();
    renderShopChart();
    renderProductChart();
    renderHeatmap();

  } catch (e) {
    console.error("loadDashboard", e);
    showToast("❌ โหลดข้อมูลไม่สำเร็จ");
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
  const fmt = d => d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
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
  await loadDashboard();
}

// =====================================================
// 📈 KPI CARDS
// =====================================================
function renderKPIs() {
  const totalAmount   = allReports.reduce((s, r) => s + (r.quantity || 0), 0);
  const prevAmount    = prevReports.reduce((s, r) => s + (r.quantity || 0), 0);
  const total         = allReports.length;
  const acked         = allReports.filter(r => r.manager_acknowledged).length;
  const shops         = new Set(allReports.map(r => r.shop_id).filter(Boolean)).size;
  const salesSent     = new Set(allReports.map(r => r.sale_id).filter(Boolean)).size;
  const totalProfiles = Object.keys(profilesMap).length;

  // Growth
  const growth = prevAmount > 0
    ? ((totalAmount - prevAmount) / prevAmount * 100).toFixed(1)
    : null;

  // Target %
  const targetTotal = totalProfiles * TARGET_PER_SALES || 1;
  const targetPct   = Math.round(totalAmount / targetTotal * 100);

  setEl("kpiAmount",    fmtNum(totalAmount));
  setEl("kpiTargetPct", targetPct + "%");
  setEl("kpiTargetSub", `เป้า: ฿${fmtNum(targetTotal)}`);
  setEl("kpiSalesRate", `${salesSent}/${totalProfiles}`);
  setEl("kpiSalesSub",  `จากทั้งหมด ${totalProfiles} คน`);
  setEl("kpiShops",     shops.toLocaleString());
  setEl("kpiTotal",     total.toLocaleString());
  setEl("kpiAck",       `รับทราบ: ${acked}/${total}`);

  const chEl = document.getElementById("kpiAmountChange");
  if (chEl && growth !== null) {
    const up = parseFloat(growth) >= 0;
    chEl.textContent  = (up ? "▲ +" : "▼ ") + growth + "% vs สัปดาห์ก่อน";
    chEl.className    = "kpi-change " + (up ? "up" : "down");
  }
}

// =====================================================
// 💡 INSIGHT PILLS
// =====================================================
function renderInsightPills() {
  const salesMap = {}, prodMap = {}, shopMap = {};

  for (const r of allReports) {
    const sName = profilesMap[r.sale_id]?.display_name || r.sale_id || "ไม่ระบุ";
    const pName = productsMap[r.product_id] || "ไม่ระบุ";
    const shName = shopsMap[r.shop_id] || "ไม่ระบุ";
    salesMap[sName]  = (salesMap[sName]  || 0) + (r.quantity || 0);
    prodMap[pName]   = (prodMap[pName]   || 0) + (r.quantity || 0);
    shopMap[shName]  = (shopMap[shName]  || 0) + (r.quantity || 0);
  }

  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
  const topS  = top(salesMap);
  const topP  = top(prodMap);
  const topSh = top(shopMap);

  const prevAmt = prevReports.reduce((s, r) => s + (r.quantity || 0), 0);
  const curAmt  = allReports.reduce((s, r) => s + (r.quantity || 0), 0);
  const growth  = prevAmt > 0 ? ((curAmt - prevAmt) / prevAmt * 100).toFixed(1) : null;

  if (topS)  setEl("topSale",    topS[0]);
  if (topP)  setEl("topProduct", topP[0]);
  if (topSh) setEl("topShop",    topSh[0]);
  if (growth !== null) {
    const el = document.getElementById("growthRate");
    if (el) {
      el.textContent = (parseFloat(growth) >= 0 ? "+" : "") + growth + "%";
      el.style.color = parseFloat(growth) >= 0 ? "var(--accent)" : "var(--accent3)";
    }
  }
}

// =====================================================
// 🎯 TARGET BARS
// =====================================================
function renderTargetBars() {
  const salesMap = {};
  for (const r of allReports) {
    const key = r.sale_id;
    salesMap[key] = (salesMap[key] || 0) + (r.quantity || 0);
  }

  const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    document.getElementById("targetSection").innerHTML =
      '<div class="loading-text">ไม่มีข้อมูล</div>';
    return;
  }

  const html = sorted.map(([uid, amt]) => {
    const name = profilesMap[uid]?.display_name || uid;
    const pct  = Math.min(Math.round(amt / TARGET_PER_SALES * 100), 100);
    const cls  = pct >= 100 ? "" : pct >= 60 ? "warning" : "danger";
    return `
      <div class="target-row">
        <div class="target-name" title="${name}">${name}</div>
        <div class="target-track">
          <div class="target-fill ${cls}" style="width:${pct}%"></div>
        </div>
        <div class="target-pct">${pct}%</div>
        <div class="target-val">฿${fmtNum(amt)}</div>
      </div>`;
  }).join("");

  document.getElementById("targetSection").innerHTML = html;
}

// =====================================================
// 🏆 LEADERBOARD
// =====================================================
function renderLeaderboard() {
  const salesMap = {};
  for (const r of allReports) {
    const key = r.sale_id;
    salesMap[key] = (salesMap[key] || 0) + (r.quantity || 0);
  }

  const sorted = Object.entries(salesMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sorted.length) {
    document.getElementById("leaderboard").innerHTML =
      '<div class="loading-text">ไม่มีข้อมูล</div>';
    return;
  }

  const rankCls    = ["r1", "r2", "r3"];
  const rankMedal  = ["🥇", "🥈", "🥉"];

  const html = sorted.map(([uid, amt], i) => {
    const name  = profilesMap[uid]?.display_name || uid;
    const rCls  = rankCls[i] || "other";
    const label = i < 3 ? rankMedal[i] : i + 1;
    return `
      <div class="lb-row">
        <div class="lb-rank ${rCls}">${label}</div>
        <div class="lb-name">${name}</div>
        <div class="lb-amount">฿${fmtNum(amt)}</div>
      </div>`;
  }).join("");

  document.getElementById("leaderboard").innerHTML = html;
}

// =====================================================
// 📦 TOP PRODUCTS LIST
// =====================================================
function renderTopProductsList() {
  const prodMap = {};
  for (const r of allReports) {
    const key = productsMap[r.product_id] || "ไม่ระบุ";
    prodMap[key] = (prodMap[key] || 0) + (r.quantity || 0);
  }

  const sorted = Object.entries(prodMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sorted.length) {
    document.getElementById("topProductsList").innerHTML =
      '<div class="loading-text">ไม่มีข้อมูล</div>';
    return;
  }

  const maxVal = sorted[0][1] || 1;
  const html = sorted.map(([name, amt], i) => {
    const pct = Math.round(amt / maxVal * 100);
    return `
      <div class="product-row">
        <div class="product-rank">${i + 1}</div>
        <div class="product-name">${name}</div>
        <div class="product-bar-wrap">
          <div class="product-bar-bg">
            <div class="product-bar-fg" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="product-amount">฿${fmtNum(amt)}</div>
      </div>`;
  }).join("");

  document.getElementById("topProductsList").innerHTML = html;
}

// =====================================================
// 📊 CHARTS  (ใช้ field เดิม: sale_id, shop_id, product_id, quantity)
// =====================================================
function destroyChart(inst) { if (inst) { try { inst.destroy(); } catch (e) {} } }

const CHART_COLORS = [
  "#00d4aa","#f5a623","#e74c8b","#4d9fff","#a855f7",
  "#f97316","#06b6d4","#84cc16","#fbbf24","#ec4899"
];

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#7a9cc0", font: { family: "Kanit", size: 12 } } },
    tooltip: {
      backgroundColor: "#1e2d42",
      titleColor: "#e8f0fe",
      bodyColor: "#7a9cc0",
      borderColor: "rgba(0,212,170,0.3)",
      borderWidth: 1,
      titleFont: { family: "Kanit" },
      bodyFont:  { family: "Kanit" },
    }
  },
  scales: {
    x: { ticks: { color: "#7a9cc0", font: { family: "Kanit", size: 11 } }, grid: { color: "rgba(255,255,255,0.04)" } },
    y: { ticks: { color: "#7a9cc0", font: { family: "Kanit", size: 11 }, callback: v => v.toLocaleString("th-TH") }, grid: { color: "rgba(255,255,255,0.04)" } }
  }
};

// Bar: Sales per person (เดิม renderSalesChart)
function renderSalesChart() {
  const ctx = document.getElementById("chartSales"); if (!ctx) return;
  destroyChart(chartSalesInst);

  const map = {};
  allReports.forEach(r => {
    const name = profilesMap[r.sale_id]?.display_name || r.sale_id || "ไม่ระบุ";
    map[name] = (map[name] || 0) + (r.quantity || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

  chartSalesInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels:   sorted.map(([k]) => k),
      datasets: [{
        label: "ยอดสั่งซื้อ (฿)",
        data:  sorted.map(([, v]) => v),
        backgroundColor: CHART_COLORS.slice(0, sorted.length),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      ...chartOpts,
      plugins: { ...chartOpts.plugins, legend: { display: false } }
    }
  });
}

// Doughnut: Top shops (เดิม renderShopChart)
function renderShopChart() {
  const ctx = document.getElementById("chartShop"); if (!ctx) return;
  destroyChart(chartShopInst);

  const map = {};
  allReports.forEach(r => {
    const name = shopsMap[r.shop_id] || "ไม่ระบุ";
    map[name] = (map[name] || 0) + (r.quantity || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);

  chartShopInst = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels:   sorted.map(([k]) => k),
      datasets: [{
        data:            sorted.map(([, v]) => v),
        backgroundColor: CHART_COLORS,
        borderColor:     "#162032",
        borderWidth:     2,
        hoverOffset:     8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%",
      plugins: {
        legend: { position: "bottom", labels: { color: "#7a9cc0", font: { family: "Kanit", size: 11 }, padding: 8 } },
        tooltip: chartOpts.plugins.tooltip
      }
    }
  });
}

// Horizontal bar: Products (เดิม renderProductChart)
function renderProductChart() {
  const ctx = document.getElementById("chartProduct"); if (!ctx) return;
  destroyChart(chartProductInst);

  const map = {};
  allReports.forEach(r => {
    const name = productsMap[r.product_id] || "ไม่ระบุ";
    map[name] = (map[name] || 0) + (r.quantity || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);

  chartProductInst = new Chart(ctx, {
    type: "bar",
    data: {
      labels:   sorted.map(([k]) => k),
      datasets: [{
        label: "ยอดรวม (฿)",
        data:  sorted.map(([, v]) => v),
        backgroundColor: "rgba(168,85,247,0.75)",
        borderColor:     "#a855f7",
        borderWidth:     1,
        borderRadius:    6,
      }]
    },
    options: {
      ...chartOpts,
      indexAxis: "y",
      plugins: { ...chartOpts.plugins, legend: { display: false } }
    }
  });
}

// Line: 8-week trend (เดิม renderWeeklyTrendChart)
async function renderWeeklyTrendChart() {
  const ctx = document.getElementById("chartWeekly"); if (!ctx) return;
  destroyChart(chartWeeklyInst);

  try {
    const { start: trendStart } = getWeekRange(weekOffset - 7);
    const { end:   trendEnd   } = getWeekRange(weekOffset);

    let q = supabaseClient
      .from("reports")
      .select("submitted_at, quantity")
      .eq("status", "submitted")
      .gte("submitted_at", trendStart.toISOString())
      .lte("submitted_at", trendEnd.toISOString());

    if (currentUser.role === "manager" && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) q = q.in("sale_id", ids);
    }

    const { data } = await q;
    if (!data) return;

    // Group by ISO week key
    const weekTotals = {};
    data.forEach(r => {
      const wk = getWeekKey(new Date(r.submitted_at));
      weekTotals[wk] = (weekTotals[wk] || 0) + (r.quantity || 0);
    });

    const labels = Object.keys(weekTotals).sort();
    const values = labels.map(k => weekTotals[k]);

    const gradient = ctx.getContext("2d").createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, "rgba(0,212,170,0.3)");
    gradient.addColorStop(1, "rgba(0,212,170,0)");

    chartWeeklyInst = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map(k => {
          const [, w] = k.split("-W");
          return `สัปดาห์ ${w}`;
        }),
        datasets: [{
          label: "ยอดรวม (฿)",
          data:  values,
          borderColor:      "#00d4aa",
          backgroundColor:  gradient,
          fill:             true,
          tension:          0.4,
          pointRadius:      5,
          pointBackgroundColor: "#00d4aa",
          pointBorderColor:     "#0f1923",
          pointBorderWidth:     2,
        }]
      },
      options: {
        ...chartOpts,
        plugins: { ...chartOpts.plugins, legend: { display: false } }
      }
    });
  } catch (e) { console.error("weeklyChart", e); }
}

// ISO week key  (เหมือนเดิม)
function getWeekKey(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const wk   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}

// =====================================================
// 🗓️ HEATMAP (30 วัน)
// =====================================================
async function renderHeatmap() {
  const wrap = document.getElementById("heatmapWrap"); if (!wrap) return;

  try {
    const d30 = new Date(); d30.setDate(d30.getDate() - 29); d30.setHours(0, 0, 0, 0);

    let q = supabaseClient
      .from("reports")
      .select("submitted_at")
      .eq("status", "submitted")
      .gte("submitted_at", d30.toISOString());

    if (currentUser.role === "manager" && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) q = q.in("sale_id", ids);
    }

    const { data } = await q;
    const counts = {};
    const today  = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      counts[d.toISOString().split("T")[0]] = 0;
    }
    (data || []).forEach(r => {
      const key = r.submitted_at.split("T")[0];
      if (key in counts) counts[key]++;
    });

    const maxC    = Math.max(...Object.values(counts), 1);
    const dayTH   = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
    const entries = Object.entries(counts);

    // ── Build grid ──
    const firstDay = new Date(entries[0][0]);
    const pad      = (firstDay.getDay() + 6) % 7;
    let week = [], weeks = [];
    for (let i = 0; i < pad; i++) week.push(null);
    for (const [date, cnt] of entries) {
      week.push({ date, cnt });
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    if (week.length) weeks.push(week);

    let html = `<table class="heatmap-table"><thead><tr><th></th>`;
    dayTH.forEach(d => html += `<th>${d}</th>`);
    html += `</tr></thead><tbody>`;

    weeks.forEach(w => {
      const label = w.find(x => x)?.date
        ? new Date(w.find(x => x).date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })
        : "";
      html += `<tr><th style="font-size:10px;color:var(--text-muted);padding-right:8px;white-space:nowrap">${label}</th>`;
      for (let d = 0; d < 7; d++) {
        const cell = w[d];
        if (!cell) { html += `<td class="heat-0">—</td>`; continue; }
        const lvl = cell.cnt === 0 ? 0
          : cell.cnt <= maxC * 0.25 ? 1
          : cell.cnt <= maxC * 0.50 ? 2
          : cell.cnt <= maxC * 0.75 ? 3 : 4;
        html += `<td class="heat-${lvl}" title="${cell.date}: ${cell.cnt} รายงาน">${cell.cnt || ""}</td>`;
      }
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    wrap.innerHTML = html;

  } catch (e) { console.error("heatmap", e); }
}

// =====================================================
// HELPERS
// =====================================================
function fmtNum(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("th-TH");
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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