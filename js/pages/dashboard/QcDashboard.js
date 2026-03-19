// ============================================================
// qcDashboard.js
// QC Dashboard — ดึงข้อมูลจริงจาก Supabase table: claims
//
// ข้อมูลที่แสดง:
// - KPI Cards  : นับจาก status (submitted/approved/rejected)
// - Pass/Fail  : approved = Pass, rejected = Fail, submitted = รอตรวจ
// - เคลมล่าสุด : 4 รายการล่าสุด order by created_at
// - ตารางสินค้า : แสดงรายการ claims พร้อม filter
// - กราฟ        : นับรายเดือน 6 เดือนย้อนหลัง
// - สรุปเคลม   : นับจาก claim_types
// ============================================================



// ============================================================
// STATE
// ============================================================

let allClaims = [];   // ข้อมูลทั้งหมดจาก DB



// ============================================================
// waitForSupabase()
// รอให้ supabaseClient พร้อมก่อน
// ============================================================

async function waitForSupabase(maxMs = 5000) {
  const start = Date.now();
  while (typeof supabaseClient === 'undefined') {
    if (Date.now() - start > maxMs) return false;
    await new Promise(r => setTimeout(r, 100));
  }
  return true;
}



// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  // แสดงวันที่
  setCurrentDate();

  // ✅ setup logout ก่อนเสมอ ไม่ว่าจะเกิด error ตรงไหน
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn && typeof logout === 'function') {
    logoutBtn.addEventListener('click', logout);
  }

  // รอ Supabase
  const ready = await waitForSupabase();
  if (!ready) {
    console.error('❌ Supabase ไม่พร้อม');
    showLoadingError();
    return;
  }

  // ตรวจสอบสิทธิ์
  if (typeof protectPage === 'function') {
    await protectPage(['admin', 'adminQC', 'adminqc', 'manager', 'executive']);
  }

  // โหลดข้อมูล
  await loadDashboardData();

  // ตั้ง filter
  const filterEl = document.getElementById('filterStatus');
  if (filterEl) filterEl.addEventListener('change', filterTable);

});



// ============================================================
// setCurrentDate()
// แสดงวันที่ปัจจุบันใน header
// ============================================================

function setCurrentDate() {
  const el = document.getElementById('currentDate');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', timeZone: 'Asia/Bangkok'
  });
}



// ============================================================
// loadDashboardData()
// โหลดข้อมูลทั้งหมดจาก Supabase ครั้งเดียว
// ============================================================

async function loadDashboardData() {

  try {

    showSkeletons();

    // ดึงข้อมูลจาก table claims
    const { data, error } = await supabaseClient
      .from('claims')
      .select('id, status, claim_date, created_at, emp_name, area, customer, product, qty, claim_types, detail, media_urls, qc_comment')
      .in('status', ['submitted', 'approved', 'rejected'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    allClaims = data || [];

    // render ทุกส่วน
    renderKPICards(allClaims);
    renderPassFailPie(allClaims);
    renderRecentClaims(allClaims);
    renderTable(allClaims);
    renderClaimSummary(allClaims);
    renderTrendChart(allClaims);

    console.log(`✅ Dashboard loaded: ${allClaims.length} claims`);

  } catch (err) {
    console.error('❌ loadDashboardData error:', err);
    showLoadingError();
  }
}



// ============================================================
// renderKPICards()
// อัปเดต KPI Cards จากข้อมูลจริง
// ============================================================

function renderKPICards(claims) {

  const total    = claims.length;
  const approved = claims.filter(c => c.status === 'approved').length;
  const rejected = claims.filter(c => c.status === 'rejected').length;
  const pending  = claims.filter(c => c.status === 'submitted').length;

  // อัตรา pass (approved / (approved+rejected) * 100)
  const passRate = (approved + rejected) > 0
    ? Math.round(approved / (approved + rejected) * 100)
    : 0;

  // อัตรา approved จากทั้งหมด
  const approveRate = total > 0 ? Math.round(approved / total * 100) : 0;

  setKPI('kpi-total',    total,    `จาก ${allClaims.length} รายการ`);
  setKPI('kpi-pass',     approved, `${passRate}% อัตราผ่าน`, 'pass');
  setKPI('kpi-fail',     rejected, `${100 - passRate}% ไม่ผ่าน`, 'fail');
  setKPI('kpi-pending',  pending,  'รอพิจารณา', 'warn');
  setKPI('kpi-claims',   total,    'เดือนนี้');
  setKPI('kpi-approved', approved, `${approveRate}% อัตราอนุมัติ`, 'pass');
}


// helper อัปเดต KPI element
function setKPI(id, value, subText, colorClass) {
  const card = document.getElementById(id);
  if (!card) return;

  const valEl = card.querySelector('.kpi-val');
  const subEl = card.querySelector('.kpi-sub');

  if (valEl) {
    valEl.textContent = value.toLocaleString();
    // reset class
    valEl.className = 'kpi-val';
    if (colorClass) valEl.classList.add(colorClass);
  }

  if (subEl && subText) {
    subEl.textContent = subText;
  }
}



// ============================================================
// renderPassFailPie()
// แสดง Pie Chart Pass / Fail / รอตรวจ
// ============================================================

function renderPassFailPie(claims) {

  const container = document.getElementById('pfPieWrap');
  if (!container || typeof Chart === 'undefined') return;

  const total    = claims.length;
  const approved = claims.filter(c => c.status === 'approved').length;
  const rejected = claims.filter(c => c.status === 'rejected').length;
  const pending  = claims.filter(c => c.status === 'submitted').length;

  const pPass = total > 0 ? Math.round(approved / total * 100) : 0;
  const pFail = total > 0 ? Math.round(rejected / total * 100) : 0;
  const pPend = 100 - pPass - pFail;

  // ทำลาย chart เดิมก่อน
  if (window._pfChart) window._pfChart.destroy();

  const canvas = document.getElementById('pfPieChart');
  if (!canvas) return;

  window._pfChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['Pass (อนุมัติ)', 'Fail (ปฏิเสธ)', 'รอตรวจ'],
      datasets: [{
        data:            [approved, rejected, pending],
        backgroundColor: ['#639922', '#E24B4A', '#EF9F27'],
        borderColor:     ['#ffffff', '#ffffff', '#ffffff'],
        borderWidth:     3,
        hoverOffset:     6,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout:              '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = total > 0 ? Math.round(ctx.parsed / total * 100) : 0;
              return ` ${ctx.label}: ${ctx.parsed} ราย (${pct}%)`;
            },
          },
        },
      },
    },
  });

  // อัปเดต legend ด้านล่าง
  const legend = document.getElementById('pfLegend');
  if (legend) {
    legend.innerHTML = `
      <span><span class="dot dot-pass"></span>Pass ${pPass}% (${approved})</span>
      <span><span class="dot dot-fail"></span>Fail ${pFail}% (${rejected})</span>
      <span><span class="dot dot-pend"></span>รอตรวจ ${pPend}% (${pending})</span>
    `;
  }
}



// ============================================================
// renderRecentClaims()
// แสดง 4 เคลมล่าสุด
// ============================================================

function renderRecentClaims(claims) {

  const container = document.getElementById('claimList');
  if (!container) return;

  const recent = claims.slice(0, 4);

  if (recent.length === 0) {
    container.innerHTML = `<div style="color:var(--text-soft);font-size:0.82rem;padding:12px 0">ยังไม่มีข้อมูล</div>`;
    return;
  }

  const statusMap = {
    submitted: { label: 'รอพิจารณา', cls: 'sb-pending' },
    approved:  { label: 'อนุมัติ',   cls: 'sb-pass'    },
    rejected:  { label: 'ไม่อนุมัติ',cls: 'sb-fail'    },
  };

  container.innerHTML = recent.map(c => {
    const s   = statusMap[c.status] || { label: c.status, cls: 'sb-pending' };
    const id  = (c.id || '').substring(0, 8).toUpperCase();
    const dt  = formatDate(c.claim_date || c.created_at);

    return `
      <div class="claim-row">
        <div>
          <div class="claim-name">CL-${id}</div>
          <div class="claim-meta">${c.product || '—'} · ${dt}</div>
        </div>
        <span class="status-badge ${s.cls}">${s.label}</span>
      </div>
    `;
  }).join('');
}



// ============================================================
// renderTable(data)
// render ตารางสินค้าจาก claims
// ============================================================

function renderTable(data) {

  const tbody = document.getElementById('productTable');
  if (!tbody) return;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">
          ไม่พบข้อมูล
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {

    // map status → score แสดง
    const scoreVal =
      r.status === 'approved' ? 100 :
      r.status === 'rejected' ? 30  : 60;

    const scoreColor =
      r.status === 'approved' ? '#639922' :
      r.status === 'rejected' ? '#E24B4A' : '#EF9F27';

    const scoreLabel =
      r.status === 'approved' ? 'ผ่าน' :
      r.status === 'rejected' ? 'ไม่ผ่าน' : 'รอตรวจ';

    const statusMap = {
      submitted: { label: 'รอตรวจ',  cls: 'sb-pending' },
      approved:  { label: 'Pass',    cls: 'sb-pass'    },
      rejected:  { label: 'Fail',    cls: 'sb-fail'    },
    };

    const s   = statusMap[r.status] || { label: r.status, cls: 'sb-pending' };
    const lot = r.claim_date ? formatDate(r.claim_date) : '—';

    return `
      <tr>
        <td><span class="mono">${(r.id || '').substring(0,8).toUpperCase()}</span></td>
        <td>${r.product || '—'}</td>
        <td><span class="mono">${lot}</span></td>
        <td class="text-right">${r.qty || '—'}</td>
        <td>
          <div class="score-wrap">
            <span class="score-num">${scoreLabel}</span>
            <div class="score-bar">
              <div class="score-fill" style="width:${scoreVal}%; background:${scoreColor}"></div>
            </div>
          </div>
        </td>
        <td><span class="status-badge ${s.cls}">${s.label}</span></td>
        <td style="color:#64748b;font-size:0.78rem">${r.emp_name || '—'}</td>
      </tr>
    `;

  }).join('');
}



// ============================================================
// filterTable()
// กรองตารางตาม select#filterStatus
// ============================================================

function filterTable() {

  const filter = document.getElementById('filterStatus')?.value;

  // map UI value → DB status
  const statusMap = { pass: 'approved', fail: 'rejected', pending: 'submitted' };
  const dbStatus  = statusMap[filter] || filter;

  const filtered = dbStatus
    ? allClaims.filter(r => r.status === dbStatus)
    : allClaims;

  renderTable(filtered);
}



// ============================================================
// renderClaimSummary()
// นับจาก claim_types array
// ============================================================

function renderClaimSummary(claims) {

  const container = document.getElementById('claimSummary');
  if (!container) return;

  // รวม claim_types ทั้งหมด
  const countMap = {};

  claims.forEach(c => {
    if (!c.claim_types) return;
    const types = Array.isArray(c.claim_types) ? c.claim_types : [];
    types.forEach(t => {
      countMap[t] = (countMap[t] || 0) + 1;
    });
  });

  // เรียงจากมากไปน้อย
  const sorted = Object.entries(countMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  const total = claims.length;

  if (sorted.length === 0) {
    container.innerHTML = `<div class="sum-row"><span class="sum-label">ยังไม่มีข้อมูล</span><span class="sum-val">—</span></div>`;
    return;
  }

  const rows = sorted.map(([label, count]) => `
    <div class="sum-row">
      <span class="sum-label">${label}</span>
      <span class="sum-val">${count} ราย</span>
    </div>
  `).join('');

  const totalRow = `
    <div class="sum-row">
      <span class="sum-label" style="font-weight:600;color:var(--text-main)">รวม</span>
      <span class="sum-val">${total} ราย</span>
    </div>
  `;

  container.innerHTML = rows + totalRow;
}



// ============================================================
// renderTrendChart()
// กราฟแนวโน้ม 6 เดือนย้อนหลัง นับจาก claims จริง
// ============================================================

function renderTrendChart(claims) {

  const canvas = document.getElementById('trendChart');
  if (!canvas || typeof Chart === 'undefined') return;

  // สร้าง labels 6 เดือนย้อนหลัง
  const months  = [];
  const labels  = [];
  const now     = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    labels.push(d.toLocaleDateString('th-TH', { month: 'short' }));
  }

  // นับ approved / rejected ต่อเดือน
  const passData = months.map(m =>
    claims.filter(c => c.status === 'approved' && (c.claim_date || c.created_at || '').startsWith(m)).length
  );

  const failData = months.map(m =>
    claims.filter(c => c.status === 'rejected' && (c.claim_date || c.created_at || '').startsWith(m)).length
  );

  const isDark     = matchMedia('(prefers-color-scheme: dark)').matches;
  const gridColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const labelColor = isDark ? '#888' : '#64748b';

  // ถ้ามี chart เดิมให้ destroy ก่อน
  if (window._trendChart) window._trendChart.destroy();

  window._trendChart = new Chart(canvas, {

    type: 'bar',

    data: {
      labels,
      datasets: [
        {
          label:           'Pass (อนุมัติ)',
          data:            passData,
          backgroundColor: '#639922',
          borderRadius:    4,
          stack:           'stack',
        },
        {
          label:           'Fail (ปฏิเสธ)',
          data:            failData,
          backgroundColor: '#E24B4A',
          borderRadius:    4,
          stack:           'stack',
        },
      ],
    },

    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} ราย`
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid:    { display: false },
          ticks:   { color: labelColor, font: { size: 11, family: "'Kanit', sans-serif" } },
        },
        y: {
          stacked: true,
          grid:    { color: gridColor },
          border:  { display: false },
          ticks:   {
            color: labelColor,
            font:  { size: 11, family: "'Kanit', sans-serif" },
            stepSize: 1,
            callback: v => Number.isInteger(v) ? v : null,
          },
        },
      },
    },
  });
}



// ============================================================
// showSkeletons()
// แสดง loading state ระหว่างโหลด
// ============================================================

function showSkeletons() {
  const tbody = document.getElementById('productTable');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:32px;color:#94a3b8">
          ⏳ กำลังโหลดข้อมูล...
        </td>
      </tr>`;
  }

  const claimList = document.getElementById('claimList');
  if (claimList) {
    claimList.innerHTML = `<div style="color:#94a3b8;font-size:0.82rem;padding:12px 0">⏳ กำลังโหลด...</div>`;
  }
}



// ============================================================
// showLoadingError()
// แสดง error state
// ============================================================

function showLoadingError() {
  const tbody = document.getElementById('productTable');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;padding:32px;color:#ef4444">
          ❌ โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่
        </td>
      </tr>`;
  }
}



// ============================================================
// UTILITIES
// ============================================================

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}



// ============================================================
// END OF FILE
// ============================================================

console.log('✅ qcDashboard.js loaded');