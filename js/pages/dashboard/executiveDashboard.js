/* ============================================================
   EABaseHub · Executive Dashboard — Script (Green/White)
   ============================================================ */

'use strict';

// ── Chart colors ──────────────────────────────────────────
const C = {
  green:     '#33913f',
  greenLight:'#c8e6c9',
  greenFill: 'rgba(51,145,63,.1)',
  blue:      '#1d6fa4',
  blueFill:  'rgba(29,111,164,.1)',
  amber:     '#b45309',
  amberFill: 'rgba(180,83,9,.1)',
  red:       '#b91c1c',
  redFill:   'rgba(185,28,28,.1)',
  grid:      'rgba(0,0,0,.05)',
  textMuted: '#9da89a',
  textSec:   '#5a6358',
};
const FONT = { family: "'Kanit', sans-serif", size: 11, weight: '300' };

// ── Mock Data ─────────────────────────────────────────────
const PERIOD = {
  quarter: {
    kpi: { revenue:'฿11.9M', claim:'47', team:'34', shops:'238' },
    labels: ['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.'],
    actual: [8.2, 9.1, 11.0, 9.8, 10.4, 11.9],
    target: [9.0, 9.0, 10.0, 10.0, 10.5, 11.0],
  },
  month: {
    kpi: { revenue:'฿4.28M', claim:'18', team:'34', shops:'238' },
    labels: ['ส.1','ส.2','ส.3','ส.4'],
    actual: [0.9, 1.1, 1.2, 1.08],
    target: [1.0, 1.0, 1.1, 1.1],
  },
  year: {
    kpi: { revenue:'฿42.3M', claim:'198', team:'34', shops:'238' },
    labels: ['Q1/67','Q2/67','Q3/67','Q4/67','Q1/68'],
    actual: [8.9, 9.8, 10.6, 11.0, 11.9],
    target: [9.0, 9.5, 10.0, 10.5, 11.0],
  },
};

const CLAIM_DATA = [
  { label:'อนุมัติแล้ว',   count:98, color:'#33913f' },
  { label:'รอ QC',          count:47, color:'#b45309' },
  { label:'ส่งกลับแก้ไข',  count:23, color:'#b91c1c' },
  { label:'ดำเนินการ',      count:14, color:'#1d6fa4' },
];

const TEAM_DATA = [
  { name:'สมชาย ก.',  actual:2.8, target:2.5 },
  { name:'มานี ร.',   actual:2.1, target:2.5 },
  { name:'สุรีย์ พ.', actual:3.2, target:2.8 },
  { name:'วิไล ส.',   actual:1.9, target:2.5 },
  { name:'อนุชา ท.',  actual:2.6, target:2.5 },
];

// monthly sales for bar chart
const SALES_LABELS = ['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.'];
const SALES_DATA   = [2.8, 3.1, 3.9, 3.4, 3.8, 4.28];

// sparklines
const SK = {
  revenue: [7.2,8.1,7.8,9.0,8.8,10.2,9.6,11.9],
  claim:   [62,58,71,55,48,52,44,47],
  team:    [28,29,30,30,31,32,33,34],
  shops:   [241,240,242,239,238,239,237,238],
};

// ── State ─────────────────────────────────────────────────
let revenueInst = null;

// ── Sidebar ───────────────────────────────────────────────
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}
window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) closeSidebar();
});

// ── KPI ───────────────────────────────────────────────────
function updateKPI(period) {
  const d = PERIOD[period].kpi;
  document.getElementById('kv-revenue').textContent = d.revenue;
  document.getElementById('kv-claim').textContent   = d.claim;
  document.getElementById('kv-team').textContent    = d.team;
  document.getElementById('kv-shops').textContent   = d.shops;
}

// ── Sparkline ─────────────────────────────────────────────
function buildSparkline(id, data, color, fillColor) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  new Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_,i) => i),
      datasets: [{
        data,
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill: true,
        backgroundColor: fillColor,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false }, tooltip:{ enabled:false } },
      scales: { x:{ display:false }, y:{ display:false } },
      animation: { duration: 500 },
    }
  });
}

// ── Revenue chart ─────────────────────────────────────────
function buildRevenueChart(period) {
  const d = PERIOD[period];
  if (revenueInst) revenueInst.destroy();
  revenueInst = new Chart(document.getElementById('revenueChart'), {
    type: 'bar',
    data: {
      labels: d.labels,
      datasets: [
        {
          type: 'bar',
          label: 'รายได้จริง',
          data: d.actual,
          backgroundColor: C.greenFill,
          borderColor: C.green,
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
          order: 2,
        },
        {
          type: 'line',
          label: 'เป้าหมาย',
          data: d.target,
          borderColor: C.greenLight,
          borderWidth: 2,
          borderDash: [5, 4],
          pointRadius: 3,
          pointBackgroundColor: C.greenLight,
          tension: 0.3,
          fill: false,
          order: 1,
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false } },
      scales: {
        x: { grid:{ display:false }, ticks:{ font:FONT, color:C.textMuted } },
        y: { grid:{ color:C.grid }, ticks:{ font:FONT, color:C.textMuted } },
      }
    }
  });
}

// ── Claim donut ───────────────────────────────────────────
function buildClaimChart() {
  const total = CLAIM_DATA.reduce((s,c) => s + c.count, 0);
  document.getElementById('claim-total').textContent = `รวม ${total} รายการ`;

  // legend
  const legendEl = document.getElementById('claim-legend');
  CLAIM_DATA.forEach(c => {
    legendEl.innerHTML += `
      <div class="cl-item">
        <div class="cl-left">
          <span class="cl-dot" style="background:${c.color}"></span>
          <span>${c.label}</span>
        </div>
        <span class="cl-count">${c.count}</span>
      </div>`;
  });

  // stats
  document.getElementById('claim-stats').innerHTML = `
    <div class="cs-box">
      <div class="cs-val" style="color:var(--green-700)">${CLAIM_DATA[0].count}</div>
      <div class="cs-label">อนุมัติ</div>
    </div>
    <div class="cs-box">
      <div class="cs-val" style="color:var(--amber-600)">${CLAIM_DATA[1].count}</div>
      <div class="cs-label">รอดำเนิน</div>
    </div>
    <div class="cs-box">
      <div class="cs-val" style="color:var(--red-600)">${CLAIM_DATA[2].count}</div>
      <div class="cs-label">ส่งกลับ</div>
    </div>`;

  new Chart(document.getElementById('claimChart'), {
    type: 'doughnut',
    data: {
      labels: CLAIM_DATA.map(c => c.label),
      datasets: [{
        data: CLAIM_DATA.map(c => c.count),
        backgroundColor: CLAIM_DATA.map(c => c.color + '22'),
        borderColor: CLAIM_DATA.map(c => c.color),
        borderWidth: 1.5,
        hoverOffset: 5,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '70%',
      plugins: { legend:{ display:false } }
    }
  });
}

// ── Team list ─────────────────────────────────────────────
function buildTeamList() {
  const maxVal = Math.max(...TEAM_DATA.map(t => Math.max(t.actual, t.target)));
  const container = document.getElementById('team-list');
  TEAM_DATA.forEach(t => {
    const pct      = ((t.actual / t.target) * 100).toFixed(0);
    const fillW    = (t.actual / maxVal * 100).toFixed(1);
    const targetW  = (t.target / maxVal * 100).toFixed(1);
    const achieved = t.actual >= t.target;
    const barColor = achieved ? C.green : C.amber;
    const pctColor = achieved ? 'var(--green-700)' : 'var(--amber-600)';
    container.innerHTML += `
      <div class="team-row">
        <div class="team-name">${t.name}</div>
        <div class="team-bar-wrap">
          <div class="team-bar-fill"
               style="width:${fillW}%;background:${barColor}22;border:1px solid ${barColor}"></div>
          <div class="team-target-line" style="left:${targetW}%"></div>
        </div>
        <div class="team-pct" style="color:${pctColor}">${pct}%</div>
      </div>`;
  });
}

// ── Monthly sales bar ─────────────────────────────────────
function buildSalesMonthChart() {
  new Chart(document.getElementById('salesMonthChart'), {
    type: 'bar',
    data: {
      labels: SALES_LABELS,
      datasets: [{
        label: 'ยอดขาย',
        data: SALES_DATA,
        backgroundColor: SALES_DATA.map(v =>
          v >= 4 ? C.greenFill.replace('.1', '.2') : C.greenFill
        ),
        borderColor: C.green,
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{ display:false } },
      scales: {
        x: { grid:{ display:false }, ticks:{ font:FONT, color:C.textMuted } },
        y: { grid:{ color:C.grid },  ticks:{ font:FONT, color:C.textMuted } },
      }
    }
  });
}

// ── Period toggle ─────────────────────────────────────────
function setPeriod(period, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  updateKPI(period);
  buildRevenueChart(period);
}

// ── Init ──────────────────────────────────────────────────
(function init() {
  updateKPI('quarter');
  buildSparkline('ks-revenue', SK.revenue, C.green,  C.greenFill);
  buildSparkline('ks-claim',   SK.claim,   C.amber,  C.amberFill);
  buildSparkline('ks-team',    SK.team,    C.blue,   C.blueFill);
  buildSparkline('ks-shops',   SK.shops,   C.red,    C.redFill);
  buildRevenueChart('quarter');
  buildClaimChart();
  buildTeamList();
  buildSalesMonthChart();
})();