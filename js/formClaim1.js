/* ================= CONFIG ================= */
const STORAGE_KEY = 'claimDrafts';
let editingId = null;

/* ================= INIT ================= */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('claimDate').value =
    new Date().toISOString().split('T')[0];

  initClaimType();
  loadDrafts();
});

/* ================= CLAIM TYPE ================= */
function initClaimType() {
  document.querySelectorAll('.claim-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('active');
    });
  });
}

function getSelectedTypes() {
  return [...document.querySelectorAll('.claim-item.active')]
    .map(el => el.textContent);
}

/* ================= SAVE DRAFT ================= */
function saveDraft() {
  const data = collectData('draft');
  if (!data) return;

  const drafts = getDrafts();

  if (editingId) {
    const idx = drafts.findIndex(d => d.id === editingId);
    drafts[idx] = data;
    editingId = null;
  } else {
    drafts.push(data);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  clearForm();
  loadDrafts();
  alert('💾 บันทึก Draft แล้ว');
}

/* ================= SUBMIT ================= */
function submitClaim() {
  const data = collectData('submitted');
  if (!data) return;

  const drafts = getDrafts();
  drafts.push(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));

  clearForm();
  loadDrafts();
  alert('✅ ส่งเคลมเรียบร้อย');
}

/* ================= COLLECT ================= */
function collectData(status) {
  const product = document.getElementById('product').value;
  const claimDate = document.getElementById('claimDate').value;

  if (!product || !claimDate) {
    alert('กรุณากรอกข้อมูลให้ครบ');
    return null;
  }

  return {
    id: editingId || Date.now(),
    product,
    claimDate,
    qty: document.getElementById('qty').value,
    buyDate: document.getElementById('buyDate').value,
    types: getSelectedTypes(),
    detail: document.getElementById('detail').value,
    status
  };
}

/* ================= DRAFT LIST ================= */
function getDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function loadDrafts() {
  const tbody = document.getElementById('draftBody');
  tbody.innerHTML = '';

  getDrafts().forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${d.claimDate}</td>
      <td>${d.product}</td>
      <td>${d.status}</td>
      <td>
        <button class="btn-small btn-edit" onclick="editDraft(${d.id})">แก้ไข</button>
        <button class="btn-small btn-delete" onclick="deleteDraft(${d.id})">ลบ</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ================= EDIT / DELETE ================= */
function editDraft(id) {
  const d = getDrafts().find(x => x.id === id);
  if (!d) return;

  editingId = id;
  document.getElementById('product').value = d.product;
  document.getElementById('claimDate').value = d.claimDate;
  document.getElementById('qty').value = d.qty;
  document.getElementById('buyDate').value = d.buyDate;
  document.getElementById('detail').value = d.detail;

  document.querySelectorAll('.claim-item').forEach(el => {
    el.classList.toggle('active', d.types.includes(el.textContent));
  });
}

function deleteDraft(id) {
  if (!confirm('ลบรายการนี้?')) return;
  const drafts = getDrafts().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  loadDrafts();
}

/* ================= CLEAR ================= */
function clearForm() {
  editingId = null;
  document.querySelectorAll('input, textarea').forEach(i => i.value = '');
  document.querySelectorAll('.claim-item').forEach(el => el.classList.remove('active'));
}
