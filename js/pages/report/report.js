// =====================================================
// report.js  v3
// Draft  → localStorage  (ไม่ขึ้น Supabase)
// Submit → Supabase (status = 'submitted')
// =====================================================

const DRAFT_KEY = "ea_report_drafts"; // localStorage key

let submittedReports = [];   // จาก Supabase
let shopsMap         = {};
let productsMap      = {};
let currentEditDraftId   = null;  // กำลังแก้ไข draft ใน modal
let currentViewReportId  = null;  // กำลังดู submitted

// =====================================================
// 🚀 INIT
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  try { await protectPage(["admin","sales","manager","user"]); }
  catch(e) { return; }

  await loadUserHeader();
  await Promise.all([loadShops(), loadCategories(), loadSubmittedReports()]);
  setDefaultDate();
  setupEventListeners();
  setupLogout();
  renderDraftList();      // โหลด draft จาก localStorage
});

// =====================================================
// 👤 HEADER
// =====================================================
async function loadUserHeader() {
  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const { data:p } = await supabaseClient.from("profiles")
      .select("display_name,role").eq("id", session.user.id).single();
    const name = p?.display_name || session.user.email;
    const $  = id => document.getElementById(id);
    if ($("userName"))   $("userName").textContent   = name;
    if ($("userRole"))   $("userRole").textContent   = p?.role || "";
    if ($("userAvatar")) $("userAvatar").textContent = name.charAt(0).toUpperCase();
  } catch(e) { console.error("loadUserHeader", e); }
}

// =====================================================
// 🗄️ LOCALSTORAGE DRAFT HELPERS
// =====================================================
function getDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]"); }
  catch(e) { return []; }
}

function saveDraftsToStorage(drafts) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function genDraftId() {
  return "draft_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
}

// =====================================================
// 💾 SAVE DRAFT → localStorage
// =====================================================
function saveDraft() {
  const data = collectFormData();

  if (!data.report_date) { alert("❌ กรุณาเลือกวันที่ก่อน"); return; }

  const drafts = getDrafts();
  const newDraft = {
    ...data,
    id:         genDraftId(),
    saved_at:   new Date().toISOString(),
    is_draft:   true
  };

  drafts.push(newDraft);
  saveDraftsToStorage(drafts);

  showToast("💾 บันทึก Draft ลงเครื่องแล้ว");
  clearForm();
  renderDraftList();
}

// =====================================================
// ✏️ EDIT DRAFT (โหลดกลับขึ้น form)
// =====================================================
function editDraftToForm(draftId) {
  const drafts = getDrafts();
  const d = drafts.find(x => x.id === draftId);
  if (!d) return;

  // ลบ draft นี้ออกก่อน แล้วโหลดข้อมูลขึ้น form
  saveDraftsToStorage(drafts.filter(x => x.id !== draftId));

  if (d.report_date)   document.getElementById("reportDate").value   = d.report_date;
  if (d.shop_id)       document.getElementById("shopSelect").value   = d.shop_id;
  if (d.source)        document.getElementById("source").value       = d.source;
  if (d.status)        document.getElementById("status").value       = d.status;
  if (d.quantity)      document.getElementById("amount").value       = d.quantity;
  if (d.followup_date) document.getElementById("followupDate").value = d.followup_date;
  if (d.note)          document.getElementById("note").value         = d.note;

  // โหลด category/product แบบ async
  if (d.category_id) {
    document.getElementById("categorySelect").value = d.category_id;
    loadProducts(d.category_id).then(() => {
      if (d.product_id) document.getElementById("productSelect").value = d.product_id;
    });
  }

  renderDraftList();
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("✏️ โหลด Draft ขึ้น form แล้ว");
}

// =====================================================
// 🗑️ DELETE DRAFT
// =====================================================
function deleteDraft(draftId) {
  if (!confirm("ลบ Draft นี้?")) return;
  saveDraftsToStorage(getDrafts().filter(x => x.id !== draftId));
  showToast("🗑️ ลบ Draft แล้ว");
  renderDraftList();
}

// =====================================================
// 🎨 RENDER DRAFT LIST
// =====================================================
function renderDraftList() {
  const drafts  = getDrafts();
  const counter = document.getElementById("draftCount");
  const tbody   = document.getElementById("draftBody");
  const section = document.getElementById("draftSection");
  const submitAllBtn = document.getElementById("submitAllBtn");

  if (counter) counter.textContent = drafts.length;
  if (submitAllBtn) submitAllBtn.disabled = drafts.length === 0;

  if (!tbody) return;
  tbody.innerHTML = "";

  if (!section) return;
  section.style.display = drafts.length > 0 ? "block" : "none";

  drafts.forEach(d => {
    const shopName = shopsMap[d.shop_id] || d.shop_id || "—";
    const prodName = productsMap[d.product_id] || d.product_id || "—";
    const savedAt  = new Date(d.saved_at).toLocaleString("th-TH", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${d.report_date || "—"}</td>
      <td>${shopName}</td>
      <td>${prodName}</td>
      <td class="detail-text" title="${escapeHtml(d.note||"")}">${escapeHtml(d.note||"—")}</td>
      <td style="color:#888;font-size:12px;">${savedAt}</td>
      <td class="action-buttons">
        <button onclick="editDraftToForm('${d.id}')" title="แก้ไข" class="btn-action-edit">✏️</button>
        <button onclick="submitOneDraft('${d.id}')" title="ส่งรายการนี้" class="btn-action-submit">📤</button>
        <button onclick="deleteDraft('${d.id}')" title="ลบ" class="btn-action-del">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================================================
// 📤 SUBMIT ONE DRAFT
// =====================================================
async function submitOneDraft(draftId) {
  const drafts = getDrafts();
  const d = drafts.find(x => x.id === draftId);
  if (!d) return;

  if (!d.shop_id || !d.product_id) {
    alert("❌ ข้อมูลไม่ครบ — กรุณาแก้ไขก่อนส่ง (ต้องมีร้านค้าและสินค้า)");
    return;
  }

  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if (!session) { alert("❌ Session หมดอายุ กรุณาล็อกอินใหม่"); return; }

    const { error } = await supabaseClient.from("reports").insert([{
      report_date:   d.report_date,
      shop_id:       d.shop_id,
      product_id:    d.product_id,
      source:        d.source,
      status:        "submitted",
      quantity:      d.quantity || 0,
      followup_date: d.followup_date,
      note:          d.note,
      attributes:    d.attributes || {},
      sale_id:       session.user.id,
      submitted_at:  new Date().toISOString(),
      created_at:    d.saved_at || new Date().toISOString()
    }]);

    if (error) throw error;

    // ลบออกจาก localStorage
    saveDraftsToStorage(drafts.filter(x => x.id !== draftId));
    showToast("✅ ส่งรายงานสำเร็จ");
    renderDraftList();
    await loadSubmittedReports();
  } catch(e) {
    console.error("submitOneDraft", e);
    alert("❌ ส่งไม่สำเร็จ: " + e.message);
  }
}

// =====================================================
// 📤 SUBMIT ALL DRAFTS
// =====================================================
async function submitAllDrafts() {
  const drafts = getDrafts();
  if (!drafts.length) { alert("ℹ️ ไม่มี Draft ที่รอส่ง"); return; }

  const incomplete = drafts.filter(d => !d.shop_id || !d.product_id);
  if (incomplete.length) {
    alert(`❌ มี ${incomplete.length} รายการที่ข้อมูลยังไม่ครบ\nกรุณาแก้ไขก่อน`);
    return;
  }

  if (!confirm(`ยืนยันส่งรายงาน ${drafts.length} รายการ?\nรายงานที่ส่งแล้วจะไม่สามารถแก้ไขได้`)) return;

  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if (!session) { alert("❌ Session หมดอายุ"); return; }

    const now = new Date().toISOString();
    const rows = drafts.map(d => ({
      report_date:   d.report_date,
      shop_id:       d.shop_id,
      product_id:    d.product_id,
      source:        d.source,
      status:        "submitted",
      quantity:      d.quantity || 0,
      followup_date: d.followup_date,
      note:          d.note,
      attributes:    d.attributes || {},
      sale_id:       session.user.id,
      submitted_at:  now,
      created_at:    d.saved_at || now
    }));

    const { error } = await supabaseClient.from("reports").insert(rows);
    if (error) throw error;

    // ล้าง localStorage
    saveDraftsToStorage([]);
    showToast(`📤 ส่งรายงาน ${rows.length} รายการสำเร็จ!`);
    renderDraftList();
    await loadSubmittedReports();
  } catch(e) {
    console.error("submitAllDrafts", e);
    alert("❌ เกิดข้อผิดพลาด: " + e.message);
  }
}

// =====================================================
// ✅ SAVE REPORT (บันทึก + ส่งทันที ไม่ผ่าน Draft)
// =====================================================
async function saveReport() {
  const data = collectFormData();
  if (!validateForm(data)) return;

  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if (!session) { alert("❌ กรุณาเข้าสู่ระบบใหม่"); return; }

    const { error } = await supabaseClient.from("reports").insert([{
      ...data,
      sale_id:      session.user.id,
      status:       "submitted",
      submitted_at: new Date().toISOString()
    }]);

    if (error) throw error;

    showToast("✅ บันทึกและส่งรายงานสำเร็จ");
    clearForm();
    await loadSubmittedReports();
  } catch(e) {
    console.error("saveReport", e);
    alert("❌ บันทึกไม่สำเร็จ: " + e.message);
  }
}

// =====================================================
// 📋 LOAD SUBMITTED (ของตัวเอง)
// =====================================================
async function loadSubmittedReports() {
  const tbody = document.getElementById("reportBody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center">กำลังโหลด...</td></tr>`;

  try {
    const { data:{ session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    const { data, error } = await supabaseClient
      .from("reports")
      .select("*")
      .eq("sale_id", session.user.id)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false });

    if (error) throw error;
    submittedReports = data || [];

    // โหลด products ที่ขาด
    const missing = [...new Set(submittedReports.map(r=>r.product_id).filter(id=>id&&!productsMap[id]))];
    if (missing.length) {
      const { data:prods } = await supabaseClient.from("products").select("id,name").in("id",missing);
      prods?.forEach(p=>{ productsMap[p.id]=p.name; });
    }

    renderSubmittedTable();
  } catch(e) {
    console.error("loadSubmittedReports", e);
    tbody.innerHTML = `<tr><td colspan="7">เกิดข้อผิดพลาด</td></tr>`;
  }
}

function renderSubmittedTable() {
  const tbody = document.getElementById("reportBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!submittedReports.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#888;">ยังไม่มีรายงานที่ส่ง</td></tr>`;
    return;
  }

  submittedReports.forEach(r => {
    const ackBadge = r.manager_acknowledged
      ? `<span class="badge-ack" title="ผู้บริหารอ่านแล้ว">👁️ อ่านแล้ว</span>`
      : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(r.submitted_at || r.report_date)}</td>
      <td>${shopsMap[r.shop_id]||"—"}</td>
      <td><span class="badge-submitted">✅ ส่งแล้ว</span>${ackBadge}</td>
      <td class="detail-text" title="${escapeHtml(r.note||"")}">${escapeHtml(r.note||"—")}</td>
      <td>${productsMap[r.product_id]||"—"}</td>
      <td style="text-align:right">${(r.quantity||0).toLocaleString()}</td>
      <td class="action-buttons">
        <button onclick="handleView('${r.id}')" title="ดูรายละเอียด">👁️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================================================
// 👁️ VIEW SUBMITTED
// =====================================================
async function handleView(id) {
  const r = submittedReports.find(x => x.id === id);
  if (!r) return;

  document.getElementById("modalTitle").innerText = "รายละเอียดรายงาน";
  const set = (eid, v) => { const el=document.getElementById(eid); if(el) el.innerText=v||"—"; };
  set("m-date",    formatDate(r.submitted_at||r.report_date));
  set("m-store",   shopsMap[r.shop_id]||"—");
  set("m-product", productsMap[r.product_id]||"—");
  set("m-source",  r.source||"—");
  set("m-status",  "✅ ส่งแล้ว" + (r.manager_acknowledged ? " • 👁️ ผู้บริหารอ่านแล้ว" : ""));
  set("m-qty",     (r.quantity||0).toLocaleString());
  set("m-followup",formatDate(r.followup_date));

  const attrEl = document.getElementById("m-attributes");
  if (attrEl) attrEl.innerHTML = await formatAttributes(r.attributes);

  const noteEl = document.getElementById("m-note");
  if (noteEl) { noteEl.value = r.note||""; noteEl.disabled = true; }

  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) saveBtn.style.display = "none";

  // โหลด comments จาก manager
  await loadManagerComments(id);

  openModal();
}

async function loadManagerComments(reportId) {
  const container = document.getElementById("m-manager-comments");
  if (!container) return;
  try {
    const { data } = await supabaseClient
      .from("report_comments")
      .select("comment, created_at, profiles(display_name)")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true });

    if (!data?.length) {
      container.innerHTML = `<div style="color:#aaa;font-size:12px;padding:4px 0;">ยังไม่มี comment จากผู้บริหาร</div>`;
      return;
    }
    container.innerHTML = data.map(c => `
      <div style="background:#f0fdf4;border-left:3px solid #10b981;border-radius:6px;padding:8px 10px;margin-bottom:6px;">
        <div style="font-size:11px;color:#888;margin-bottom:3px;">
          <strong>${c.profiles?.display_name||"ผู้บริหาร"}</strong> · ${formatDate(c.created_at)}
        </div>
        <div style="font-size:13px;">${escapeHtml(c.comment)}</div>
      </div>
    `).join("");
  } catch(e) { container.innerHTML = ""; }
}

// ===== MODAL =====
function openModal()  { const m=document.getElementById("reportModal"); if(m){ m.style.display="flex"; document.body.style.overflow="hidden"; } }
function closeModal() { const m=document.getElementById("reportModal"); if(m){ m.style.display="none";  document.body.style.overflow=""; } }

// =====================================================
// FORM HELPERS
// =====================================================
function collectFormData() {
  return {
    report_date:   document.getElementById("reportDate")?.value    || null,
    shop_id:       document.getElementById("shopSelect")?.value    || null,
    category_id:   document.getElementById("categorySelect")?.value || null,
    product_id:    document.getElementById("productSelect")?.value || null,
    source:        document.getElementById("source")?.value        || null,
    status_visit:  document.getElementById("status")?.value        || null,
    quantity:      parseFloat(document.getElementById("amount")?.value || 0),
    followup_date: document.getElementById("followupDate")?.value  || null,
    note:          document.getElementById("note")?.value          || null,
    attributes:    collectDynamicAttributes()
  };
}

function validateForm(data) {
  if (!data.report_date) { alert("❌ กรุณาเลือกวันที่"); return false; }
  if (!data.shop_id)     { alert("❌ กรุณาเลือกร้านค้า"); return false; }
  if (!data.product_id)  { alert("❌ กรุณาเลือกสินค้า"); return false; }
  if (data.quantity <= 0){ alert("❌ กรุณาระบุยอดสั่งซื้อ"); return false; }
  return true;
}

function clearForm() {
  document.getElementById("reportDate").valueAsDate = new Date();
  ["shopSelect","categorySelect","productSelect"].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = "";
  });
  ["source","status"].forEach(id => {
    const el = document.getElementById(id); if(el) el.selectedIndex = 0;
  });
  document.getElementById("amount").value = "";
  document.getElementById("note").value   = "";
  const f = document.getElementById("followupDate");
  if (f) { const nw = new Date(); nw.setDate(nw.getDate()+7); f.valueAsDate = nw; }
  clearDynamicAttributes();
}

function setDefaultDate() {
  const d = document.getElementById("reportDate"); if(d) d.valueAsDate = new Date();
  const f = document.getElementById("followupDate");
  if (f) { const nw = new Date(); nw.setDate(nw.getDate()+7); f.valueAsDate = nw; }
}

// =====================================================
// SHOPS / CATEGORIES / PRODUCTS / ATTRIBUTES
// =====================================================
async function loadShops() {
  try {
    const { data } = await supabaseClient.from("shops").select("id,shop_name").eq("status","Active").order("shop_name");
    shopsMap = Object.fromEntries((data||[]).map(s=>[s.id,s.shop_name]));
    const sel = document.getElementById("shopSelect"); if(!sel) return;
    sel.innerHTML = `<option value="">-- เลือกร้านค้า --</option>`;
    data?.forEach(s => { const o=document.createElement("option"); o.value=s.id; o.textContent=s.shop_name; sel.appendChild(o); });
  } catch(e){}
}

async function loadCategories() {
  try {
    const { data } = await supabaseClient.from("categories").select("id,name").order("name");
    const sel = document.getElementById("categorySelect"); if(!sel) return;
    sel.innerHTML = `<option value="">-- เลือกหมวดสินค้า --</option>`;
    data?.forEach(c => { const o=document.createElement("option"); o.value=c.id; o.textContent=c.name; sel.appendChild(o); });
  } catch(e){}
}

async function loadProducts(categoryId) {
  const sel = document.getElementById("productSelect"); if(!sel) return;
  sel.innerHTML = `<option value="">-- เลือกสินค้า --</option>`;
  if (!categoryId) return;
  try {
    const { data } = await supabaseClient.from("products").select("id,name").eq("category_id",categoryId).order("name");
    data?.forEach(p => { productsMap[p.id]=p.name; const o=document.createElement("option"); o.value=p.id; o.textContent=p.name; sel.appendChild(o); });
  } catch(e){}
}

async function handleProductChange() {
  const productId = this.value;
  const container = document.getElementById("dynamicAttributes"); if(!container) return;
  container.innerHTML = ""; if(!productId) return;
  try {
    const { data:prod } = await supabaseClient.from("products").select("category_id").eq("id",productId).single();
    if (!prod) return;
    const { data:attrs } = await supabaseClient.from("attributes").select("*").eq("category_id",prod.category_id).order("order_no",{ascending:true});
    if (!attrs?.length) return;
    for (const attr of attrs) {
      const wrap = document.createElement("div"); wrap.classList.add("form-group");
      const lbl  = document.createElement("label"); lbl.innerText = attr.name;
      if (attr.is_required) lbl.innerHTML += ' <span style="color:red">*</span>';
      wrap.appendChild(lbl);
      if (attr.input_type === "select") {
        const sel = document.createElement("select"); sel.dataset.attributeId=attr.id; sel.classList.add("dynamic-field");
        const { data:opts } = await supabaseClient.from("attribute_options").select("value").eq("attribute_id",attr.id).order("value");
        sel.innerHTML = `<option value="">-- เลือก --</option>`;
        opts?.forEach(o => { const op=document.createElement("option"); op.value=o.value; op.textContent=o.value; sel.appendChild(op); });
        wrap.appendChild(sel);
      } else {
        const inp = document.createElement("input"); inp.type=attr.input_type==="number"?"number":"text";
        inp.dataset.attributeId=attr.id; inp.classList.add("dynamic-field"); wrap.appendChild(inp);
      }
      container.appendChild(wrap);
    }
  } catch(e){}
}

function collectDynamicAttributes() {
  const attrs = {}; document.querySelectorAll(".dynamic-field").forEach(f => { if(f.value) attrs[f.dataset.attributeId]=f.value; }); return attrs;
}
function clearDynamicAttributes() { const c=document.getElementById("dynamicAttributes"); if(c) c.innerHTML=""; }

// =====================================================
// EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  const cat = document.getElementById("categorySelect");
  if (cat) cat.addEventListener("change", e => { loadProducts(e.target.value); clearDynamicAttributes(); });
  const prod = document.getElementById("productSelect");
  if (prod) prod.addEventListener("change", handleProductChange);
  const closeBtn = document.getElementById("closeModalBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  const modal = document.getElementById("reportModal");
  if (modal) modal.addEventListener("click", e => { if(e.target===modal) closeModal(); });
}

// =====================================================
// EXPORT CSV
// =====================================================
function exportData(type) {
  if (type !== "csv") { alert("🚧 ฟีเจอร์นี้กำลังพัฒนา"); return; }
  if (!submittedReports.length) { alert("ไม่มีข้อมูล"); return; }
  const headers = ["วันที่ส่ง","ร้านค้า","สินค้า","ยอด","รายละเอียด","ผู้บริหารอ่านแล้ว"];
  const rows = submittedReports.map(r => [
    formatDate(r.submitted_at||r.report_date), shopsMap[r.shop_id]||"—",
    productsMap[r.product_id]||"—", r.quantity||0,
    (r.note||"—").replace(/,/g," "), r.manager_acknowledged?"ใช่":"ยังไม่"
  ]);
  const csv = [headers,...rows].map(r=>r.map(c=>`"${c}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const a = document.createElement("a"); a.href=URL.createObjectURL(blob);
  a.download=`my_reports_${new Date().toISOString().split("T")[0]}.csv`; a.click();
}

// =====================================================
// HELPERS
// =====================================================
function formatDate(s) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("th-TH",{year:"numeric",month:"long",day:"numeric"}); } catch(e){ return "—"; }
}

async function formatAttributes(attrs) {
  if (!attrs || !Object.keys(attrs).length) return "";
  try {
    const { data:ad } = await supabaseClient.from("attributes").select("id,name").in("id",Object.keys(attrs));
    const am = Object.fromEntries((ad||[]).map(a=>[a.id,a.name]));
    return `<div style="background:#f8fafc;border-radius:6px;padding:8px;font-size:13px;">` +
      Object.entries(attrs).map(([k,v])=>`<strong>${am[k]||k}:</strong> ${v}`).join("<br>") + `</div>`;
  } catch(e){ return ""; }
}

function escapeHtml(t) {
  if (!t) return ""; const d=document.createElement("div"); d.textContent=t; return d.innerHTML;
}

function showToast(msg) {
  const t = document.getElementById("toast");
  if (!t) { console.log(msg); return; }
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

function setupLogout() {
  const btn = document.getElementById("logoutBtn"); if(!btn) return;
  btn.addEventListener("click", async () => { await supabaseClient.auth.signOut(); window.location.href="/pages/auth/login.html"; });
}