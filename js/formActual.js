/* =====================================================
   STORAGE CONFIG - key สำหรับ localStorage
   ===================================================== */
const STORAGE_KEY = 'formActualDrafts';

/* =====================================================
   INIT - รอ supabase พร้อมก่อนค่อยโหลดข้อมูล
   ===================================================== */
document.addEventListener('DOMContentLoaded', async () => {
  // supabaseClient.js init แบบ synchronous → พร้อมใช้ได้เลย ไม่ต้องรอ
  await loadUserInfo();
  addRow(); // เพิ่มแถวเริ่มต้น 1 แถว
});

/* =====================================================
   TABLE - เพิ่มแถว
   ===================================================== */
function addRow() {
  const tbody = document.getElementById('tableBody');
  const tr = document.createElement('tr');

  const today = new Date().toISOString().split('T')[0];

  tr.innerHTML = `
    <td><input type="date" value="${today}"></td>
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

/* =====================================================
   TABLE - ลบแถว
   ===================================================== */
function deleteRow() {
  const tbody = document.getElementById('tableBody');
  if (tbody.rows.length > 0) {
    tbody.deleteRow(-1);
    calcTotal();
  }
}

/* =====================================================
   CALC - คำนวณจำนวนวันและยอดรวม
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
   SAVE DRAFT - บันทึกลง localStorage
   ===================================================== */
function saveDraft() {
  const data = collectFormData();
  if (!data) return; // collectFormData จัดการ alert เองแล้ว

  const drafts = getDrafts();
  drafts.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));

  alert('💾 บันทึก Draft เรียบร้อย');
  clearForm();
}

/* =====================================================
   COLLECT DATA - เก็บข้อมูลจากฟอร์ม
   ===================================================== */
function collectFormData() {
  const emp  = document.getElementById('empName')?.value?.trim() || '';
  // ✅ แก้ id: zone → empZone ให้ตรงกับ HTML
  const zone = document.getElementById('empZone')?.value?.trim() || '';

  // ✅ แก้ validation: ถ้า user login แล้ว emp จะมีค่าเสมอ
  //    ถ้า emp ว่างแสดงว่า session หมดหรือโหลดไม่สำเร็จ
  if (!emp) {
    alert('ไม่พบข้อมูลพนักงาน กรุณา Login ก่อนใช้งาน');
    return null;
  }

  const rows = [];
  let firstDate = '';
  let lastDate  = '';

  document.querySelectorAll('#tableBody tr').forEach((tr, index) => {
    const inputs = tr.querySelectorAll('input');
    const date   = inputs[0].value;

    if (index === 0) firstDate = date;
    lastDate = date;

    rows.push({
      date:      date,
      route:     inputs[1].value,
      allowance: Number(inputs[2].value || 0),
      hotel:     Number(inputs[3].value || 0),
      fuel:      Number(inputs[4].value || 0),
      other:     Number(inputs[5].value || 0),
      note:      inputs[6].value
    });
  });

  if (rows.length === 0) {
    alert('กรุณาเพิ่มข้อมูลอย่างน้อย 1 แถว');
    return null;
  }

  return {
    id:    Date.now(),
    start: firstDate,
    end:   lastDate,
    emp,
    zone,
    rows
  };
}

/* =====================================================
   STORAGE - ดึง drafts จาก localStorage
   ===================================================== */
function getDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

/* =====================================================
   CLEAR - ล้างตารางและเพิ่มแถวใหม่
   ===================================================== */
function clearForm() {
  document.getElementById('tableBody').innerHTML = '';
  addRow();
  calcTotal();
}

/* =====================================================
   EXPORT CSV - export ข้อมูลทั้งหมดใน localStorage
   ===================================================== */
function exportCSV() {
  const drafts = getDrafts();
  if (drafts.length === 0) {
    alert('ไม่มีข้อมูลให้ Export (กรุณา Save Draft ก่อน)');
    return;
  }

  let csv = 'start,end,emp,zone,date,route,allowance,hotel,fuel,other,note\n';

  drafts.forEach(d => {
    d.rows.forEach(r => {
      // ✅ ครอบ field ด้วย "" ป้องกัน comma ใน text ทำ CSV พัง
      csv += [
        d.start, d.end,
        `"${d.emp}"`, `"${d.zone}"`,
        r.date, `"${r.route}"`,
        r.allowance, r.hotel, r.fuel, r.other,
        `"${r.note}"`
      ].join(',') + '\n';
    });
  });

  downloadFile(csv, 'formActual.csv');
}

/* =====================================================
   DOWNLOAD - สร้าง link และ trigger download
   ===================================================== */
function downloadFile(content, filename) {
  // ✅ เพิ่ม BOM (\uFEFF) ให้ Excel อ่านภาษาไทยได้ถูกต้อง
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href); // ✅ คืน memory หลัง download
}

/* =====================================================
   LOAD USER INFO - โหลดข้อมูลจาก Supabase profiles
   ===================================================== */
async function loadUserInfo() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();

    if (!session) {
      alert('กรุณา Login ก่อนใช้งาน');
      window.location.href = 'index.html'; // ✅ redirect ไป login
      return;
    }

    // แสดงอีเมลใน sidebar
    const sidebarEmail = document.getElementById('sidebarEmail');
    if (sidebarEmail) {
      sidebarEmail.textContent = session.user.email;
    }

    // ✅ query: display_name + area (ชื่อ field ใน profiles table)
    const { data: profile, error } = await supabaseClient
      .from('profiles')
      .select('display_name, area')
      .eq('id', session.user.id)
      .single();

    if (error) {
      console.error('❌ query profiles error:', error.message);
    }

    // ✅ แสดงชื่อพนักงาน
    const empInput = document.getElementById('empName');
    if (empInput) {
      empInput.value    = profile?.display_name || session.user.email;
      empInput.readOnly = true;
    }

    // ✅ แสดงเขตการขาย (id แก้เป็น empZone ให้ตรงกับ HTML)
    const zoneInput = document.getElementById('empZone');
    if (zoneInput) {
      zoneInput.value    = profile?.area || '';
      zoneInput.readOnly = true;
    }

    console.log('✅ loadUserInfo (formActual) สำเร็จ');

  } catch (err) {
    console.error('❌ loadUserInfo error:', err);
  }
}