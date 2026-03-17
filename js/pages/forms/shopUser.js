// =====================================================
// shopUser.js
// =====================================================

// ใช้ var เพื่อป้องกัน SyntaxError กรณี shopDetailService.js declare ซ้ำ
var SHIPPING_OPTIONS = ["Flash", "Kerry", "J&T", "Thailand Post", "Ninja Van", "DHL", "อื่นๆ"];

// =====================================================
// 🔄 รอ Supabase + Auth
// =====================================================
async function waitForAppReady(maxMs = 5000) {
  const start = Date.now();
  while (typeof supabaseClient === "undefined") {
    if (Date.now() - start > maxMs) throw new Error("Supabase ยังไม่โหลด");
    await new Promise((r) => setTimeout(r, 100));
  }
  if (typeof getCurrentUser !== "function") {
    console.warn("ไม่พบ getCurrentUser → จะใช้ supabase.auth แทน");
  }
}

// =====================================================
// 👤 โหลด user
// =====================================================
async function getUser() {
  if (typeof getCurrentUser === "function") {
    const user = await getCurrentUser();
    if (user) return user;
  }
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("กรุณาเข้าสู่ระบบ");
    window.location.href = "/login.html";
    return null;
  }
  return user;
}

// =====================================================
// 🏪 โหลดรายชื่อร้าน
// =====================================================
async function loadShops(user) {
  const { data, error } = await supabaseClient
    .from("shops")
    .select("*")
    .eq("sale_id", user.id)
    .order("shop_name");

  if (error) { console.error(error); return; }

  const tbody  = document.getElementById("shopTableBody");
  const counter = document.getElementById("shopCount");
  if (!tbody) return;

  tbody.innerHTML = "";
  if (counter) counter.textContent = (data?.length ?? 0) + " ร้าน";

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" class="table-placeholder">ไม่พบร้านค้า</td></tr>`;
    return;
  }

  data.forEach((shop) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="code-badge">${shop.shop_code || "-"}</span></td>
      <td>${shop.shop_name}</td>
      <td>${shop.province || "-"}</td>
    `;
    tr.addEventListener("click", () => selectShop(shop, tr));
    tbody.appendChild(tr);
  });
}

// =====================================================
// 📦 เลือกร้าน
// =====================================================
async function selectShop(shop, rowElement) {
  window.shopId = shop.id;

  document.querySelectorAll("#shopTableBody tr").forEach((tr) => tr.classList.remove("active"));
  rowElement.classList.add("active");

  const shopNameEl = document.getElementById("shopName");
  const provinceEl = document.getElementById("province");
  const emptyState = document.getElementById("emptyState");
  const shopForm   = document.getElementById("shopForm");

  if (shopNameEl) shopNameEl.value = shop.shop_name || "";
  if (provinceEl) provinceEl.value = shop.province  || "";
  if (emptyState) emptyState.style.display = "none";
  if (shopForm)   shopForm.style.display   = "";

  // โหลด tab ที่ active อยู่
  const activeTab = document.querySelector(".tab-btn.active")?.dataset.tab || "alias";
  loadTabContent(activeTab);
}

// =====================================================
// 🗂️ Tab switching
// =====================================================
function initTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-pane").forEach((p) => p.style.display = "none");

      btn.classList.add("active");
      const pane = document.getElementById("tab-" + btn.dataset.tab);
      if (pane) pane.style.display = "";

      if (window.shopId) loadTabContent(btn.dataset.tab);
    });
  });
}

async function loadTabContent(tab) {
  if (tab === "alias")  loadAlias();
  if (tab === "detail") loadDetail();
  if (tab === "images") loadImages();
}

// =====================================================
// 📦 ชื่อรอง
// =====================================================
async function loadAlias() {
  if (!window.shopId) return;
  const { data, error } = await supabaseClient
    .from("shop_aliases")
    .select("*")
    .eq("shop_id", window.shopId)
    .order("created_at", { ascending: false });

  if (error) { console.error(error); return; }

  const list = document.getElementById("aliasList");
  if (!list) return;
  list.innerHTML = "";

  if (!data || data.length === 0) {
    list.innerHTML = `<span class="no-data">ยังไม่มีชื่อรอง</span>`;
    return;
  }
  data.forEach((a) => {
    const div = document.createElement("div");
    div.className = "alias-item";
    div.innerText = a.alias_name;
    list.appendChild(div);
  });
}

async function addAlias() {
  const input = document.getElementById("aliasInput");
  if (!input) return;
  const value = input.value.trim();
  if (!value) { alert("กรอกชื่อรองก่อน"); return; }
  if (!window.shopId) { alert("กรุณาเลือกร้านก่อน"); return; }

  const { error } = await supabaseClient
    .from("shop_aliases")
    .insert({ shop_id: window.shopId, alias_name: value });

  if (error) { console.error(error); alert("เพิ่มไม่สำเร็จ"); return; }
  input.value = "";
  loadAlias();
}

// =====================================================
// 📋 รายละเอียดร้าน
// =====================================================
async function loadDetail() {
  if (!window.shopId) return;

  const detail = await loadShopDetail(window.shopId);

  // fill fields
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ""; };
  set("detailAddress",     detail?.address);
  set("detailMapsUrl",     detail?.maps_url);
  set("detailPhone",       detail?.phone);
  set("detailContactName", detail?.contact_name);
  set("detailLineId",      detail?.line_id);
  set("detailNote",        detail?.note);

  // maps link button
  const mapsLink = document.getElementById("mapsLink");
  if (mapsLink) {
    const url = detail?.maps_url;
    mapsLink.href = url || "#";
    mapsLink.style.display = url ? "" : "none";
  }

  // live update maps link
  document.getElementById("detailMapsUrl")?.addEventListener("input", (e) => {
    const mapsLink = document.getElementById("mapsLink");
    if (!mapsLink) return;
    const v = e.target.value.trim();
    mapsLink.href = v || "#";
    mapsLink.style.display = v ? "" : "none";
  });

  // render shipping chips
  renderShippingChips(detail?.shipping || []);
}

function renderShippingChips(selected) {
  const container = document.getElementById("shippingChips");
  if (!container) return;
  container.innerHTML = "";

  SHIPPING_OPTIONS.forEach((name) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "shipping-chip" + (selected.includes(name) ? " active" : "");
    chip.textContent = name;
    chip.addEventListener("click", () => chip.classList.toggle("active"));
    container.appendChild(chip);
  });
}

function getSelectedShipping() {
  return [...document.querySelectorAll(".shipping-chip.active")].map((c) => c.textContent);
}

async function saveDetail() {
  if (!window.shopId || !window.currentUser) return;

  const btn    = document.getElementById("saveDetailBtn");
  const status = document.getElementById("detailSaveStatus");

  btn.disabled = true;
  if (status) { status.textContent = "กำลังบันทึก..."; status.className = "save-status saving"; }

  try {
    await saveShopDetail(window.shopId, window.currentUser.id, {
      address:      document.getElementById("detailAddress")?.value,
      maps_url:     document.getElementById("detailMapsUrl")?.value,
      phone:        document.getElementById("detailPhone")?.value,
      contact_name: document.getElementById("detailContactName")?.value,
      line_id:      document.getElementById("detailLineId")?.value,
      note:         document.getElementById("detailNote")?.value,
      shipping:     getSelectedShipping(),
    });
    if (status) { status.textContent = "✓ บันทึกแล้ว"; status.className = "save-status saved"; }
    setTimeout(() => { if (status) status.textContent = ""; }, 3000);
  } catch (err) {
    console.error(err);
    if (status) { status.textContent = "เกิดข้อผิดพลาด"; status.className = "save-status error"; }
  } finally {
    btn.disabled = false;
  }
}

// =====================================================
// 📸 รูปภาพ
// =====================================================
window._currentImages = [];

async function loadImages() {
  if (!window.shopId) return;

  const detail = await loadShopDetail(window.shopId);
  window._currentImages = detail?.images || [];
  await renderImageGrid(window._currentImages);
}

async function renderImageGrid(paths) {
  const grid = document.getElementById("imageGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!paths || paths.length === 0) {
    grid.innerHTML = `<p class="no-data">ยังไม่มีรูปภาพ</p>`;
    return;
  }

  for (const path of paths) {
    const url = await getImageUrl(path);
    if (!url) continue;

    const card = document.createElement("div");
    card.className = "image-card";
    card.innerHTML = `
      <img src="${url}" alt="shop image" loading="lazy" />
      <button class="image-delete-btn" data-path="${path}" title="ลบรูป">✕</button>
    `;
    card.querySelector(".image-delete-btn").addEventListener("click", async (e) => {
      if (!confirm("ลบรูปนี้?")) return;
      try {
        window._currentImages = await deleteShopImage(window.shopId, path, window._currentImages);
        await renderImageGrid(window._currentImages);
      } catch { alert("ลบไม่สำเร็จ"); }
    });
    grid.appendChild(card);
  }
}

function initImageUpload() {
  const area  = document.getElementById("uploadArea");
  const input = document.getElementById("imageInput");
  if (!area || !input) return;

  area.addEventListener("click", () => input.click());

  area.addEventListener("dragover", (e) => { e.preventDefault(); area.classList.add("drag-over"); });
  area.addEventListener("dragleave", ()  => area.classList.remove("drag-over"));
  area.addEventListener("drop", async (e) => {
    e.preventDefault();
    area.classList.remove("drag-over");
    await handleFiles([...e.dataTransfer.files]);
  });

  input.addEventListener("change", async () => {
    await handleFiles([...input.files]);
    input.value = "";
  });
}

async function handleFiles(files) {
  if (!window.shopId) { alert("กรุณาเลือกร้านก่อน"); return; }

  const MAX = 5 * 1024 * 1024; // 5MB
  const valid = files.filter((f) => {
    if (!f.type.startsWith("image/")) { alert(`${f.name}: ไม่ใช่ไฟล์รูปภาพ`); return false; }
    if (f.size > MAX) { alert(`${f.name}: ขนาดเกิน 5MB`); return false; }
    return true;
  });

  for (const file of valid) {
    try {
      const path = await uploadShopImage(window.shopId, file);
      window._currentImages = await appendShopImage(window.shopId, path, window._currentImages);
    } catch (err) {
      console.error(err);
      alert(`อัปโหลด ${file.name} ไม่สำเร็จ`);
    }
  }
  await renderImageGrid(window._currentImages);
}

// =====================================================
// 🔍 Search
// =====================================================
function initSearch() {
  const el = document.getElementById("searchInput");
  if (!el) return;
  el.addEventListener("input", (e) => {
    const kw = e.target.value.toLowerCase();
    document.querySelectorAll("#shopTableBody tr").forEach((tr) => {
      tr.style.display = tr.innerText.toLowerCase().includes(kw) ? "" : "none";
    });
  });
}

// =====================================================
// 🎯 INIT
// =====================================================
async function init() {
  try {
    await waitForAppReady();
    const user = await getUser();
    if (!user) return;
    window.currentUser = user;

    await loadShops(user);
    initTabs();
    initSearch();
    initImageUpload();

    const addBtn  = document.getElementById("addAliasBtn");
    const saveBtn = document.getElementById("saveDetailBtn");
    if (addBtn)  addBtn.addEventListener("click", addAlias);
    if (saveBtn) saveBtn.addEventListener("click", saveDetail);

  } catch (err) {
    console.error(err);
    alert("โหลดไม่สำเร็จ: " + err.message);
  }
}

init();