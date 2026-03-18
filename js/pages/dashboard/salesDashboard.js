/* ============================================================
   EABaseHub · Sales Dashboard — Script
   ============================================================ */

'use strict';

// ── Mock Data ─────────────────────────────────────────────
const PERIOD_DATA = {
  month: {
    total: '฿4.28M', orders: '1,347', shops: '238', avg: '฿3,178',
    bar: {
      labels: ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.'],
      cur:    [2.8, 3.1, 3.9, 3.4, 3.8, 4.28],
      prev:   [2.5, 2.7, 3.3, 2.9, 3.1, 3.8]
    }
  },
  week: {
    total: '฿980K', orders: '312', shops: '238', avg: '฿3,141',
    bar: {
      labels: ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'],
      cur:    [128, 142, 115, 163, 177, 134, 121],
      prev:   [110, 130, 105, 145, 155, 120, 108]
    }
  },
  quarter: {
    total: '฿11.9M', orders: '3,820', shops: '238', avg: '฿3,115',
    bar: {
      labels: ['Q2/67', 'Q3/67', 'Q4/67', 'Q1/68'],
      cur:    [9.2, 10.1, 11.0, 11.9],
      prev:   [7.8, 8.8, 9.5, 10.3]
    }
  }
};

const AREAS = [
  { name: 'กรุงเทพฯ',  val: '1.42', pct: '+15%', prog: 100 },
  { name: 'เชียงใหม่',  val: '0.78', pct: '+9%',  prog: 55  },
  { name: 'ขอนแก่น',   val: '0.61', pct: '+7%',  prog: 43  },
  { name: 'ชลบุรี',    val: '0.54', pct: '+11%', prog: 38  },
  { name: 'สุราษฎร์ฯ', val: '0.38', pct: '+4%',  prog: 27  },
];

const REGION_LABELS = ['ภาคกลาง', 'ภาคเหนือ', 'ภาคอีสาน', 'ภาคใต้'];
const REGION_DATA   = [33, 22, 25, 20];
const REGION_COLORS = ['#33913f', '#4caf50', '#81c784', '#c8e6c9'];

const DAILY_DAYS = Array.from({ length: 18 }, (_, i) => i + 1);
const DAILY_VALS = [98, 112, 88, 145, 132, 99, 143, 121, 108, 156, 134, 119, 162, 148, 137, 175, 155, 143];

// ── Chart config ──────────────────────────────────────────
const GRID_COLOR = 'rgba(0,0,0,.05)';
const TICK_FONT  = { family: "'Kanit', sans-serif", size: 11, weight: '300' };

// ── State ─────────────────────────────────────────────────
let barChartInst = null;

// ── Sidebar (Responsive) ──────────────────────────────────
/**
 * เปิด sidebar drawer — ใช้บน tablet/mobile
 */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('active');
  document.body.style.overflow = 'hidden'; // ป้องกัน scroll body
}

/**
 * ปิด sidebar drawer
 */
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ปิด sidebar เมื่อ resize กลับเป็น desktop
window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    closeSidebar();
  }
});

// ── Metric cards ──────────────────────────────────────────
/**
 * อัปเดต metric card ทั้ง 4 ใบ
 * @param {object} data
 */
function updateMetrics(data) {
  document.getElementById('m-total').textContent  = data.total;
  document.getElementById('m-orders').textContent = data.orders;
  document.getElementById('m-shops').textContent  = data.shops;
  document.getElementById('m-avg').textContent    = data.avg;
}

// ── Chart builders ────────────────────────────────────────
/**
 * สร้าง/อัปเดต Bar chart
 * @param {object} data
 */
function buildBarChart(data) {
  if (barChartInst) barChartInst.destroy();
  barChartInst = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: {
      labels: data.bar.labels,
      datasets: [
        {
          label: 'ปีนี้',
          data: data.bar.cur,
          backgroundColor: '#33913f',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: 'ปีก่อน',
          data: data.bar.prev,
          backgroundColor: '#c8e6c9',
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: TICK_FONT } },
        y: { grid: { color: GRID_COLOR }, ticks: { font: TICK_FONT } }
      }
    }
  });
}

/**
 * สร้าง Donut chart
 */
function buildDonutChart() {
  new Chart(document.getElementById('donutChart'), {
    type: 'doughnut',
    data: {
      labels: REGION_LABELS,
      datasets: [{
        data: REGION_DATA,
        backgroundColor: REGION_COLORS,
        borderWidth: 0,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false } }
    }
  });
}

/**
 * สร้าง Line chart
 */
function buildLineChart() {
  new Chart(document.getElementById('lineChart'), {
    type: 'line',
    data: {
      labels: DAILY_DAYS.map(d => `${d}`),
      datasets: [{
        label: 'ยอดขาย (K฿)',
        data: DAILY_VALS,
        borderColor: '#33913f',
        backgroundColor: 'rgba(51,145,63,.1)',
        borderWidth: 2,
        pointRadius: 2.5,
        pointBackgroundColor: '#33913f',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: TICK_FONT, maxTicksLimit: 9 } },
        y: { grid: { color: GRID_COLOR }, ticks: { font: TICK_FONT, callback: v => `${v}K` } }
      }
    }
  });
}

// ── DOM builders ──────────────────────────────────────────
/**
 * สร้าง legend ของ Donut chart
 */
function buildDonutLegend() {
  const container = document.getElementById('donut-legend');
  REGION_LABELS.forEach((label, i) => {
    container.innerHTML += `
      <span>
        <span class="leg-dot" style="background:${REGION_COLORS[i]}"></span>
        ${label} ${REGION_DATA[i]}%
      </span>`;
  });
}

/**
 * สร้างตาราง Top Areas
 */
function buildAreaTable() {
  const container = document.getElementById('area-list');
  AREAS.forEach(a => {
    const isPos = a.pct.startsWith('+');
    container.innerHTML += `
      <div class="tbl-row">
        <div>
          <span class="area-badge">${a.name}</span>
          <div class="prog-wrap">
            <div class="prog-bar">
              <div class="prog-fill" style="width:${a.prog}%"></div>
            </div>
          </div>
        </div>
        <div class="num-right">${a.val}</div>
        <div class="pct-right ${isPos ? 'delta-up' : 'delta-dn'}">${a.pct}</div>
      </div>`;
  });
}

// ── Public: เปลี่ยน period ────────────────────────────────
/**
 * เรียกจาก onclick บน period button
 * @param {string} period - 'week' | 'month' | 'quarter'
 * @param {HTMLElement} btn
 */
function setPeriod(period, btn) {
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const data = PERIOD_DATA[period];
  updateMetrics(data);
  buildBarChart(data);
}

// ── Init ──────────────────────────────────────────────────
(function init() {
  buildDonutLegend();
  buildAreaTable();
  buildDonutChart();
  buildLineChart();
  buildBarChart(PERIOD_DATA.month);
  updateMetrics(PERIOD_DATA.month);
})();