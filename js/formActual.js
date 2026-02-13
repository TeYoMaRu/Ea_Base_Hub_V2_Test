/* =====================================================
   STORAGE CONFIG
   ===================================================== */
const STORAGE_KEY = 'formActualDrafts';

/* =====================================================
   INIT
   ===================================================== */
document.addEventListener('DOMContentLoaded', () => {
  setDefaultDates();
  addRow();
});

/* =====================================================
   DATE
   ===================================================== */
function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('start').value = today;
  document.getElementById('end').value = today;
}

/* =====================================================
   TABLE
   ===================================================== */
function addRow() {
  const tbody = document.getElementById('tableBody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="date"></td>
    <td><input placeholder="เส้นทาง"></td>
    <td><input type="number" value="0" min="0" oninput="calcTotal()"></td>
    <td><input type="number" value="0" min="0" oninput="calcTotal()"></td>
    <td><input type="number" value="0" min="0" oninput="calcTotal()"></td>
    <td><input type="number" value="0" min="0" oninput="calcTotal()"></td>
    <td><input placeholder="หมายเหตุ"></td>
  `;
  tbody.appendChild(tr);
  calcTotal();
}

function deleteRow() {
  const tbody = document.getElementById('tableBody');
  if (tbody.rows.length > 0) {
    tbody.deleteRow(-1);
    calcTotal();
  }
}

/* =====================================================
   CALC
   ===================================================== */
function calcTotal() {
  let total = 0;
  const rows = document.querySelectorAll('#tableBody tr');

  rows.forEach(row => {
    row.querySelectorAll('input[type="number"]').forEach(input => {
      total += Number(input.value || 0);
    });
  });

  document.getElementById('days').textContent = rows.length;
  document.getElementById('total').textContent = total.toFixed(2);
}

/* =====================================================
   SAVE DRAFT
   ===================================================== */
function saveDraft() {
  const data = collectFormData();
  if (!data) return;

  const drafts = getDrafts();
  drafts.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));

  alert('💾 บันทึก Draft เรียบร้อย');
  clearForm();
}

/* =====================================================
   COLLECT DATA
   ===================================================== */
function collectFormData() {
  const start = document.getElementById('start').value;
  const end = document.getElementById('end').value;
  const emp = document.getElementById('emp').value;
  const zone = document.getElementById('zone').value;

  if (!start || !end || !emp || !zone) {
    alert('กรุณากรอกข้อมูลให้ครบ');
    return null;
  }

  const rows = [];
  document.querySelectorAll('#tableBody tr').forEach(tr => {
    const i = tr.querySelectorAll('input');
    rows.push({
      date: i[0].value,
      route: i[1].value,
      allowance: Number(i[2].value || 0),
      hotel: Number(i[3].value || 0),
      fuel: Number(i[4].value || 0),
      other: Number(i[5].value || 0),
      note: i[6].value
    });
  });

  return {
    id: Date.now(),
    start,
    end,
    emp,
    zone,
    rows
  };
}

/* =====================================================
   STORAGE
   ===================================================== */
function getDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/* =====================================================
   CLEAR
   ===================================================== */
function clearForm() {
  document.getElementById('tableBody').innerHTML = '';
  addRow();
  calcTotal();
}

/* =====================================================
   EXPORT CSV
   ===================================================== */
function exportCSV() {
  const drafts = getDrafts();
  if (drafts.length === 0) {
    alert('ไม่มีข้อมูลให้ Export');
    return;
  }

  let csv = 'start,end,emp,zone,date,route,allowance,hotel,fuel,other,note\n';

  drafts.forEach(d => {
    d.rows.forEach(r => {
      csv += `${d.start},${d.end},${d.emp},${d.zone},${r.date},${r.route},${r.allowance},${r.hotel},${r.fuel},${r.other},${r.note}\n`;
    });
  });

  download(csv, 'formActual.csv');
}

function download(content, filename) {
  const blob = new Blob([content], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}
