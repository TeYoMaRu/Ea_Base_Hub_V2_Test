// =====================================================
// managerDashboard.js — Sales Intelligence Dashboard
// สองตาราง คนละหน้าที่:
//   sales_data → KPI ยอดขาย, charts, leaderboard, target bars
//   reports    → Heatmap, weekly trend, KPI ร้านที่เยี่ยม/ส่งรายงาน
// =====================================================

'use strict';

// ── State ─────────────────────────────────────────────────
let salesData     = [];   // จาก sales_data (period ปัจจุบัน)
let prevSalesData = [];   // จาก sales_data (period ก่อน)
let reportsData   = [];   // จาก reports    (period ปัจจุบัน)
let prevReports   = [];   // จาก reports    (period ก่อน)

let profilesMap   = {};   // uid → { display_name, role, team_id }
let shopsMap      = {};   // id  → shop_name

let currentUser   = null;
let weekOffset    = 0;
let currentPeriod = 'week'; // 'week' | 'month' | 'quarter'

let chartSalesInst, chartShopInst, chartProductInst, chartWeeklyInst;

const TARGET_PER_SALES = 500000; // เป้าหมายยอดขายต่อเซลล์ (ปรับได้)

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  try { await protectPage(['admin', 'manager']); } catch (e) { return; }

  currentUser = await loadCurrentUser();
  if (!currentUser) return;

  const sel = document.getElementById('periodSelect');
  if (sel) sel.value = currentPeriod;

  await Promise.all([loadProfiles(), loadShops()]);
  await loadDashboard();
  setupLogout();
});

// =====================================================
// 👤 CURRENT USER
// =====================================================
async function loadCurrentUser() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;

    const { data: p } = await supabaseClient
      .from('profiles')
      .select('id, display_name, role, team_id')
      .eq('id', session.user.id)
      .single();

    const name = p?.display_name || session.user.email;
    setEl('userName',   name);
    setEl('userRole',   p?.role || '');
    setEl('userAvatar', name.charAt(0).toUpperCase());

    return { id: session.user.id, role: p?.role, team_id: p?.team_id, name };
  } catch (e) {
    console.error('loadCurrentUser', e);
    return null;
  }
}

// =====================================================
// 👥 PROFILES
// =====================================================
async function loadProfiles() {
  try {
    let q = supabaseClient
      .from('profiles')
      .select('id, display_name, role, team_id')
      .in('role', ['sales', 'user']);

    if (currentUser.role === 'manager' && currentUser.team_id) {
      q = q.eq('team_id', currentUser.team_id);
    }
    const { data } = await q;
    profilesMap = Object.fromEntries((data || []).map(p => [p.id, p]));
  } catch (e) { console.error('loadProfiles', e); }
}

// =====================================================
// 🏪 SHOPS
// =====================================================
async function loadShops() {
  try {
    const { data } = await supabaseClient
      .from('shops').select('id, shop_name').order('shop_name');
    shopsMap = Object.fromEntries((data || []).map(s => [s.id, s.shop_name]));
  } catch (e) { console.error('loadShops', e); }
}

// =====================================================
// 📊 MAIN LOAD — ดึงสองตารางพร้อมกัน
// =====================================================
async function loadDashboard() {
  try {
    showLoadingState(true);

    const { start, end }         = getPeriodRange(currentPeriod, weekOffset);
    const { start: ps, end: pe } = getPeriodRange(currentPeriod, weekOffset - 1);
    updateWeekLabel(start, end);

    // ── ดึงพร้อมกันทั้งสองตาราง (ปัจจุบัน + ก่อนหน้า) ──
    const [sdCur, sdPrev, rpCur, rpPrev] = await Promise.all([

      // ① sales_data ปัจจุบัน
      supabaseClient
        .from('sales_data')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true }),

      // ② sales_data ก่อนหน้า
      supabaseClient
        .from('sales_data')
        .select('sales_code, amount_net, customer_code, profit')
        .gte('created_at', ps.toISOString())
        .lte('created_at', pe.toISOString()),

      // ③ reports ปัจจุบัน (select อยู่ใน buildReportsQuery แล้ว)
      buildReportsQuery(start, end),

      // ④ reports ก่อนหน้า
      buildReportsQuery(ps, pe),
    ]);

    if (sdCur.error) throw sdCur.error;
    if (rpCur.error) throw rpCur.error;

    salesData     = sdCur.data  || [];
    prevSalesData = sdPrev.data || [];
    reportsData   = rpCur.data  || [];
    prevReports   = rpPrev.data || [];

    console.log(`✅ sales_data: ${salesData.length} | reports: ${reportsData.length}`);

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

    showLoadingState(false);

  } catch (e) {
    console.error('loadDashboard', e);
    showToast('❌ โหลดข้อมูลไม่สำเร็จ: ' + e.message);
    showLoadingState(false);
  }
}

// helper: สร้าง reports query พร้อม filter team
function buildReportsQuery(start, end) {
  // ✅ ต้องมี .select() ก่อนถึงจะ chain .eq() ได้
  let q = supabaseClient
    .from('reports')
    .select('*')
    .eq('status', 'submitted')
    .gte('submitted_at', start.toISOString())
    .lte('submitted_at', end.toISOString());

  if (currentUser.role === 'manager' && currentUser.team_id) {
    const ids = Object.keys(profilesMap);
    if (ids.length) q = q.in('sale_id', ids);
  }
  return q;
}

// =====================================================
// 📅 PERIOD HELPERS
// =====================================================
function getPeriodRange(period, offset = 0) {
  const now = new Date();

  if (period === 'week') {
    const diff = now.getDay() === 0 ? -6 : 1 - now.getDay();
    const mon  = new Date(now);
    mon.setDate(now.getDate() + diff + offset * 7);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return { start: mon, end: sun };
  }

  if (period === 'month') {
    const d     = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (period === 'quarter') {
    const q     = Math.floor(now.getMonth() / 3) + offset;
    const year  = now.getFullYear() + Math.floor(q / 4);
    const qNorm = ((q % 4) + 4) % 4;
    const start = new Date(year, qNorm * 3, 1, 0, 0, 0, 0);
    const end   = new Date(year, qNorm * 3 + 3, 0, 23, 59, 59, 999);
    return { start, end };
  }

  return { start: new Date(0), end: new Date() };
}

function updateWeekLabel(start, end) {
  const fmt = d => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
  setEl('weekLabel', `${fmt(start)} – ${fmt(end)}`);

  const wkEl = document.getElementById('weekOffsetLabel');
  if (!wkEl) return;
  const lbl = {
    week:    ['สัปดาห์นี้', 'สัปดาห์ที่แล้ว', 'สัปดาห์ก่อน'],
    month:   ['เดือนนี้',   'เดือนที่แล้ว',   'เดือนก่อน'],
    quarter: ['ไตรมาสนี้', 'ไตรมาสที่แล้ว', 'ไตรมาสก่อน'],
  }[currentPeriod] || ['ปัจจุบัน','ก่อนหน้า','ก่อนหน้า'];

  if      (weekOffset ===  0) wkEl.textContent = lbl[0];
  else if (weekOffset === -1) wkEl.textContent = lbl[1];
  else wkEl.textContent = `${Math.abs(weekOffset)} ${lbl[2]}`;
}

// ── Public: เปลี่ยน period (dropdown) ──
async function changePeriod(period) {
  currentPeriod = period;
  weekOffset    = 0;
  await loadDashboard();
}

// ── Public: เลื่อน period ‹ › ──
async function changeWeek(dir) {
  weekOffset += dir;
  await loadDashboard();
}

// =====================================================
// 📈 KPI CARDS
// ยอดขาย/กำไร → sales_data | ร้าน/รายงาน → reports
// =====================================================
function renderKPIs() {
  // sales_data
  const totalAmount  = salesData.reduce((s, r) => s + (r.amount_net || 0), 0);
  const totalProfit  = salesData.reduce((s, r) => s + (r.profit     || 0), 0);
  const prevAmount   = prevSalesData.reduce((s, r) => s + (r.amount_net || 0), 0);
  const uniqueSales  = new Set(salesData.map(r => r.sales_code).filter(Boolean));

  // reports
  const total        = reportsData.length;
  const acked        = reportsData.filter(r => r.manager_acknowledged).length;
  const shops        = new Set(reportsData.map(r => r.shop_id).filter(Boolean)).size;
  const salesSent    = new Set(reportsData.map(r => r.sale_id).filter(Boolean)).size;
  const totalProfiles = Object.keys(profilesMap).length;

  const growth = prevAmount > 0
    ? ((totalAmount - prevAmount) / prevAmount * 100).toFixed(1)
    : null;

  const targetTotal = uniqueSales.size * TARGET_PER_SALES || 1;
  const targetPct   = Math.round(totalAmount / targetTotal * 100);

  setEl('kpiAmount',    fmtNum(totalAmount));
  setEl('kpiTargetPct', targetPct + '%');
  setEl('kpiTargetSub', `เป้า: ฿${fmtNum(targetTotal)}`);
  setEl('kpiSalesRate', `${salesSent}/${totalProfiles || uniqueSales.size}`);
  setEl('kpiSalesSub',  `กำไรรวม ฿${fmtNum(totalProfit)}`);
  setEl('kpiShops',     shops.toLocaleString());
  setEl('kpiTotal',     total.toLocaleString());
  setEl('kpiAck',       `รับทราบ: ${acked}/${total}`);

  const chEl = document.getElementById('kpiAmountChange');
  if (chEl) {
    if (growth !== null) {
      const up = parseFloat(growth) >= 0;
      chEl.textContent = (up ? '▲ +' : '▼ ') + growth + '% vs ช่วงก่อน';
      chEl.className   = 'kpi-change ' + (up ? 'up' : 'down');
    } else {
      chEl.textContent = 'ไม่มีข้อมูลช่วงก่อน';
      chEl.className   = 'kpi-change';
    }
  }
}

// =====================================================
// 💡 INSIGHT PILLS
// =====================================================
function renderInsightPills() {
  const salesMap = {}, prodMap = {}, shopMap = {};

  // top เซลล์ + สินค้า → sales_data
  for (const r of salesData) {
    const sKey = r.sales_name   || r.sales_code   || 'ไม่ระบุ';
    const pKey = r.product_name || r.product_code || 'ไม่ระบุ';
    salesMap[sKey] = (salesMap[sKey] || 0) + (r.amount_net || 0);
    prodMap[pKey]  = (prodMap[pKey]  || 0) + (r.qty_net    || 0);
  }

  // top ร้าน → reports
  for (const r of reportsData) {
    const shKey = shopsMap[r.shop_id] || r.shop_id || 'ไม่ระบุ';
    shopMap[shKey] = (shopMap[shKey] || 0) + (r.quantity || 0);
  }

  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1])[0];
  const topS  = top(salesMap);
  const topP  = top(prodMap);
  const topSh = top(shopMap);

  const prevAmt = prevSalesData.reduce((s, r) => s + (r.amount_net || 0), 0);
  const curAmt  = salesData.reduce((s, r) => s + (r.amount_net || 0), 0);
  const growth  = prevAmt > 0 ? ((curAmt - prevAmt) / prevAmt * 100).toFixed(1) : null;

  if (topS)  setEl('topSale',    topS[0]);
  if (topP)  setEl('topProduct', topP[0]);
  if (topSh) setEl('topShop',    topSh[0]);

  if (growth !== null) {
    const el = document.getElementById('growthRate');
    if (el) {
      el.textContent = (parseFloat(growth) >= 0 ? '+' : '') + growth + '%';
      el.style.color = parseFloat(growth) >= 0 ? 'var(--accent)' : 'var(--accent3)';
    }
  }
}

// =====================================================
// 🎯 TARGET BARS (sales_data)
// =====================================================
function renderTargetBars() {
  const map = {};
  for (const r of salesData) {
    const key = r.sales_code || 'ไม่ระบุ';
    if (!map[key]) map[key] = { name: r.sales_name || key, total: 0 };
    map[key].total += (r.amount_net || 0);
  }

  const sorted = Object.values(map).sort((a, b) => b.total - a.total);
  if (!sorted.length) {
    document.getElementById('targetSection').innerHTML = '<div class="loading-text">ไม่มีข้อมูล</div>';
    return;
  }

  document.getElementById('targetSection').innerHTML = sorted.map(({ name, total }) => {
    const pct = Math.min(Math.round(total / TARGET_PER_SALES * 100), 100);
    const cls = pct >= 100 ? '' : pct >= 60 ? 'warning' : 'danger';
    return `
      <div class="target-row">
        <div class="target-name" title="${name}">${name}</div>
        <div class="target-track"><div class="target-fill ${cls}" style="width:${pct}%"></div></div>
        <div class="target-pct">${pct}%</div>
        <div class="target-val">฿${fmtNum(total)}</div>
      </div>`;
  }).join('');
}

// =====================================================
// 🏆 LEADERBOARD (sales_data)
// =====================================================
function renderLeaderboard() {
  const map = {};
  for (const r of salesData) {
    const key = r.sales_code || 'ไม่ระบุ';
    if (!map[key]) map[key] = { name: r.sales_name || key, total: 0 };
    map[key].total += (r.amount_net || 0);
  }

  const sorted = Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8);
  if (!sorted.length) {
    document.getElementById('leaderboard').innerHTML = '<div class="loading-text">ไม่มีข้อมูล</div>';
    return;
  }

  const medals  = ['🥇','🥈','🥉'];
  const rankCls = ['r1','r2','r3'];
  document.getElementById('leaderboard').innerHTML = sorted.map(({ name, total }, i) => `
    <div class="lb-row">
      <div class="lb-rank ${rankCls[i] || 'other'}">${i < 3 ? medals[i] : i + 1}</div>
      <div class="lb-name">${name}</div>
      <div class="lb-amount">฿${fmtNum(total)}</div>
    </div>`).join('');
}

// =====================================================
// 📦 TOP PRODUCTS (sales_data — qty_net)
// =====================================================
function renderTopProductsList() {
  const map = {};
  for (const r of salesData) {
    const key = r.product_name || r.product_code || 'ไม่ระบุ';
    map[key] = (map[key] || 0) + (r.qty_net || 0);
  }

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sorted.length) {
    document.getElementById('topProductsList').innerHTML = '<div class="loading-text">ไม่มีข้อมูล</div>';
    return;
  }

  const maxVal = sorted[0][1] || 1;
  document.getElementById('topProductsList').innerHTML = sorted.map(([name, qty], i) => `
    <div class="product-row">
      <div class="product-rank">${i + 1}</div>
      <div class="product-name">${name}</div>
      <div class="product-bar-wrap">
        <div class="product-bar-bg">
          <div class="product-bar-fg" style="width:${Math.round(qty / maxVal * 100)}%"></div>
        </div>
      </div>
      <div class="product-amount">${fmtNum(qty)} ชิ้น</div>
    </div>`).join('');
}

// =====================================================
// 📊 CHARTS
// =====================================================
function destroyChart(inst) { if (inst) { try { inst.destroy(); } catch (_) {} } }

const CHART_COLORS = [
  '#00d4aa','#f5a623','#e74c8b','#4d9fff','#a855f7',
  '#f97316','#06b6d4','#84cc16','#fbbf24','#ec4899'
];

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#7a9cc0', font: { family: 'Kanit', size: 12 } } },
    tooltip: {
      backgroundColor: '#1e2d42', titleColor: '#e8f0fe', bodyColor: '#7a9cc0',
      borderColor: 'rgba(0,212,170,0.3)', borderWidth: 1,
      titleFont: { family: 'Kanit' }, bodyFont: { family: 'Kanit' },
    }
  },
  scales: {
    x: { ticks: { color: '#7a9cc0', font: { family: 'Kanit', size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
    y: { ticks: { color: '#7a9cc0', font: { family: 'Kanit', size: 11 }, callback: v => fmtNum(v) }, grid: { color: 'rgba(255,255,255,0.04)' } }
  }
};

// Bar: ยอดขายแยกเซลล์ (sales_data)
function renderSalesChart() {
  const ctx = document.getElementById('chartSales'); if (!ctx) return;
  destroyChart(chartSalesInst);
  const map = {};
  salesData.forEach(r => {
    const k = r.sales_name || r.sales_code || 'ไม่ระบุ';
    map[k] = (map[k] || 0) + (r.amount_net || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
  chartSalesInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: sorted.map(([k]) => k),
      datasets: [{ label: 'ยอดขาย (฿)', data: sorted.map(([, v]) => v),
        backgroundColor: CHART_COLORS.slice(0, sorted.length), borderRadius: 6, borderSkipped: false }]
    },
    options: { ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: false } } }
  });
}

// Doughnut: ยอดแยกร้านค้า Top 8 (reports)
function renderShopChart() {
  const ctx = document.getElementById('chartShop'); if (!ctx) return;
  destroyChart(chartShopInst);
  const map = {};
  reportsData.forEach(r => {
    const k = shopsMap[r.shop_id] || r.shop_id || 'ไม่ระบุ';
    map[k] = (map[k] || 0) + (r.quantity || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  chartShopInst = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: sorted.map(([k]) => k),
      datasets: [{ data: sorted.map(([, v]) => v),
        backgroundColor: CHART_COLORS, borderColor: '#162032', borderWidth: 2, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#7a9cc0', font: { family: 'Kanit', size: 11 }, padding: 8 } },
        tooltip: chartOpts.plugins.tooltip
      }
    }
  });
}

// Horizontal bar: ยอดรวมแยกสินค้า (sales_data)
function renderProductChart() {
  const ctx = document.getElementById('chartProduct'); if (!ctx) return;
  destroyChart(chartProductInst);
  const map = {};
  salesData.forEach(r => {
    const k = r.product_name || r.product_code || 'ไม่ระบุ';
    map[k] = (map[k] || 0) + (r.amount_net || 0);
  });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  chartProductInst = new Chart(ctx, {
    type: 'bar',
    data: { labels: sorted.map(([k]) => k),
      datasets: [{ label: 'ยอดรวม (฿)', data: sorted.map(([, v]) => v),
        backgroundColor: 'rgba(168,85,247,0.75)', borderColor: '#a855f7', borderWidth: 1, borderRadius: 6 }]
    },
    options: { ...chartOpts, indexAxis: 'y', plugins: { ...chartOpts.plugins, legend: { display: false } } }
  });
}

// Line: แนวโน้ม 8 period (reports)
async function renderWeeklyTrendChart() {
  const ctx = document.getElementById('chartWeekly'); if (!ctx) return;
  destroyChart(chartWeeklyInst);

  try {
    const { start: trendStart } = getPeriodRange(currentPeriod, weekOffset - 7);
    const { end:   trendEnd   } = getPeriodRange(currentPeriod, weekOffset);

    let q = supabaseClient
      .from('reports')
      .select('submitted_at, quantity')
      .eq('status', 'submitted')
      .gte('submitted_at', trendStart.toISOString())
      .lte('submitted_at', trendEnd.toISOString());

    if (currentUser.role === 'manager' && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) q = q.in('sale_id', ids);
    }

    const { data } = await q;
    if (!data?.length) return;

    const totals = {};
    data.forEach(r => {
      const key = getPeriodKey(new Date(r.submitted_at), currentPeriod);
      totals[key] = (totals[key] || 0) + (r.quantity || 0);
    });

    const labels = Object.keys(totals).sort();
    const values = labels.map(k => totals[k]);

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(0,212,170,0.3)');
    gradient.addColorStop(1, 'rgba(0,212,170,0)');

    chartWeeklyInst = new Chart(ctx, {
      type: 'line',
      data: { labels: labels.map(k => formatPeriodLabel(k, currentPeriod)),
        datasets: [{ label: 'ยอดรวม (฿)', data: values,
          borderColor: '#00d4aa', backgroundColor: gradient, fill: true, tension: 0.4,
          pointRadius: 5, pointBackgroundColor: '#00d4aa', pointBorderColor: '#0f1923', pointBorderWidth: 2 }]
      },
      options: { ...chartOpts, plugins: { ...chartOpts.plugins, legend: { display: false } } }
    });
  } catch (e) { console.error('weeklyChart', e); }
}

function getPeriodKey(d, period) {
  if (period === 'week') {
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const wk   = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
  }
  if (period === 'month')   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (period === 'quarter') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  return d.toISOString().split('T')[0];
}

function formatPeriodLabel(key, period) {
  if (period === 'week')    return `สัปดาห์ ${key.split('-W')[1]}`;
  if (period === 'quarter') return key.replace('-', ' ');
  if (period === 'month') {
    const [y, m] = key.split('-');
    const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    return `${months[parseInt(m) - 1]} ${y}`;
  }
  return key;
}

// =====================================================
// 🗓️ HEATMAP (reports — 30 วัน คงที่)
// =====================================================
async function renderHeatmap() {
  const wrap = document.getElementById('heatmapWrap'); if (!wrap) return;
  try {
    const d30 = new Date(); d30.setDate(d30.getDate() - 29); d30.setHours(0, 0, 0, 0);
    let q = supabaseClient.from('reports').select('submitted_at')
      .eq('status', 'submitted').gte('submitted_at', d30.toISOString());
    if (currentUser.role === 'manager' && currentUser.team_id) {
      const ids = Object.keys(profilesMap);
      if (ids.length) q = q.in('sale_id', ids);
    }

    const { data } = await q;
    const counts = {};
    const today  = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      counts[d.toISOString().split('T')[0]] = 0;
    }
    (data || []).forEach(r => {
      const key = r.submitted_at.split('T')[0];
      if (key in counts) counts[key]++;
    });

    const maxC    = Math.max(...Object.values(counts), 1);
    const dayTH   = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'];
    const entries = Object.entries(counts);
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
      const first = w.find(x => x);
      const label = first ? new Date(first.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '';
      html += `<tr><th style="font-size:10px;color:var(--text-muted);padding-right:8px;white-space:nowrap">${label}</th>`;
      for (let d = 0; d < 7; d++) {
        const cell = w[d];
        if (!cell) { html += `<td class="heat-0">—</td>`; continue; }
        const lvl = cell.cnt === 0 ? 0 : cell.cnt <= maxC * 0.25 ? 1 : cell.cnt <= maxC * 0.50 ? 2 : cell.cnt <= maxC * 0.75 ? 3 : 4;
        html += `<td class="heat-${lvl}" title="${cell.date}: ${cell.cnt} รายงาน">${cell.cnt || ''}</td>`;
      }
      html += `</tr>`;
    });
    html += `</tbody></table>`;
    wrap.innerHTML = html;
  } catch (e) {
    console.error('heatmap', e);
    document.getElementById('heatmapWrap').innerHTML = '<div class="loading-text">โหลดไม่สำเร็จ</div>';
  }
}

// =====================================================
// HELPERS
// =====================================================
function fmtNum(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('th-TH');
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function showToast(msg) {
  const t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function showLoadingState(loading) {
  ['kpiAmount','kpiTargetPct','kpiSalesRate','kpiShops','kpiTotal'].forEach(id => {
    const el = document.getElementById(id);
    if (el && loading) el.textContent = '...';
  });
}

function setupLogout() {
  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '/pages/auth/login.html';
  });
}