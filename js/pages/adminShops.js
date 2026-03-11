// ============================================================
// admin-shops.js
// จัดการสิทธิ์ร้านค้า — pattern เดียวกับ admin-sales.js
// ============================================================

// -------------------------------------------------------
// protectAdmin — wrap protectPage + init userService
// -------------------------------------------------------
async function protectAdmin() {
  await protectPage(["admin"]);

  if (typeof initUserService === "function") {
    await initUserService();
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

// -------------------------------------------------------
// goHome
// -------------------------------------------------------
function goHome() {
  window.location.href = "index.html";
}

// -------------------------------------------------------
// loadSalesForPermissions
// โหลด Sales เข้า Dropdown
// -------------------------------------------------------
async function loadSalesForPermissions() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, username")
    .eq("role", "sales")
    .order("display_name", { ascending: true });

  if (error) {
    console.error("Load sales error:", error);
    return;
  }

  const select = document.getElementById("selectSaleForPerm");
  select.innerHTML = `<option value="">-- เลือก Sales --</option>`;

  data.forEach(sale => {
    const option = document.createElement("option");
    option.value = sale.id;
    option.textContent = sale.display_name || sale.username;
    select.appendChild(option);
  });

  // ถ้า URL มี ?sale=xxx ให้เลือกอัตโนมัติ
  const params = new URLSearchParams(window.location.search);
  const saleParam = params.get("sale");
  if (saleParam) {
    select.value = saleParam;
    await loadSaleShops();
  }
}

// -------------------------------------------------------
// loadSaleShops
// โหลดร้านค้าของ Sales ที่เลือก แล้ว render เป็น table
// -------------------------------------------------------
async function loadSaleShops() {
  const saleId = document.getElementById("selectSaleForPerm").value;
  const container = document.getElementById("permissionsContainer");
  const toolbar = document.getElementById("shopToolbar");
  const countBar = document.getElementById("shopCountBar");

  if (!saleId) {
    toolbar.style.display = "none";
    countBar.style.display = "none";
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined empty-icon">storefront</span>
        <div>เลือก Sales เพื่อดูสิทธิ์ร้านค้า</div>
      </div>`;
    return;
  }

  // เก็บ saleId ไว้ใช้ตอนเพิ่มร้าน
  window.currentSaleId = saleId;

  container.innerHTML = `<div class="empty-state"><div>⏳ กำลังโหลด...</div></div>`;

  const { data, error } = await supabaseClient
    .from("shops")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    container.innerHTML = `<div class="empty-state" style="color:#ef4444">❌ โหลดข้อมูลไม่สำเร็จ</div>`;
    return;
  }

  // แสดง toolbar + count bar
  toolbar.style.display = "flex";
  countBar.style.display = "flex";
  document.getElementById("shopCountText").textContent = `${data.length} ร้านค้า`;

  renderShops(data);
}

// -------------------------------------------------------
// renderShops — render เป็น table เหมือน adminSales
// -------------------------------------------------------
function renderShops(shops) {
  const container = document.getElementById("permissionsContainer");

  if (shops.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined empty-icon">store_off</span>
        <div>ยังไม่มีร้านค้าสำหรับ Sales นี้</div>
        <button class="btn-add" onclick="openAddModal(window.currentSaleId)" style="margin-top:8px">
          <span class="material-symbols-outlined">add</span>เพิ่มร้านค้า
        </button>
      </div>`;
    return;
  }

  const tbody = shops.map((shop, i) => `
    <tr class="fade-row" style="animation-delay:${i * 0.04}s">
      <td><span class="shop-name-text">${escapeHtml(shop.shop_name)}</span></td>
      <td><span class="shop-code-badge">${escapeHtml(shop.shop_code || "-")}</span></td>
      <td>
        ${shop.province
          ? `<span class="province-badge"><span class="material-symbols-outlined" style="font-size:13px;vertical-align:middle">location_on</span> ${escapeHtml(shop.province)}</span>`
          : `<span class="province-empty">-</span>`}
      </td>
      <td>
        <div class="action-group">
          <button class="btn-icon btn-edit"
                  onclick="openEditModal('${shop.id}','${escapeAttr(shop.shop_name)}','${escapeAttr(shop.shop_code || '')}','${escapeAttr(shop.province || '')}')">
            <span class="material-symbols-outlined">edit</span>แก้ไข
          </button>
          <button class="btn-icon btn-transfer"
                  onclick="openTransferModal('${shop.id}')">
            <span class="material-symbols-outlined">swap_horiz</span>โอน
          </button>
          <button class="btn-icon btn-unlink"
                  onclick="unlinkShop('${shop.id}')">
            <span class="material-symbols-outlined">link_off</span>ยกเลิกสิทธิ์
          </button>
          <button class="btn-icon btn-delete"
                  onclick="deleteShop('${shop.id}')">
            <span class="material-symbols-outlined">delete</span>ลบ
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>ชื่อร้านค้า</th>
            <th>รหัสร้าน</th>
            <th>จังหวัด</th>
            <th>ดำเนินการ</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

// -------------------------------------------------------
// filterShops — กรองจาก search input
// -------------------------------------------------------
function filterShops() {
  const keyword = document.getElementById("searchShop").value.toLowerCase();
  const rows = document.querySelectorAll(".data-table tbody tr");

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(keyword) ? "" : "none";
  });
}

// -------------------------------------------------------
// Modal เพิ่ม/แก้ไขร้านค้า
// -------------------------------------------------------
function openAddModal(saleId) {
  window.currentSaleId = saleId;
  document.getElementById("modalTitle").textContent = "เพิ่มร้านค้า";
  document.getElementById("shopId").value = "";
  document.getElementById("shopName").value = "";
  document.getElementById("shopCode").value = "";
  document.getElementById("shopProvince").value = "";
  document.getElementById("shopModal").style.display = "flex";
  setTimeout(() => document.getElementById("shopName").focus(), 100);
}

function openEditModal(id, name, code, province) {
  document.getElementById("modalTitle").textContent = "แก้ไขร้านค้า";
  document.getElementById("shopId").value = id;
  document.getElementById("shopName").value = name;
  document.getElementById("shopCode").value = code;
  document.getElementById("shopProvince").value = province || "";
  document.getElementById("shopModal").style.display = "flex";
  setTimeout(() => document.getElementById("shopName").focus(), 100);
}

function closeModal() {
  document.getElementById("shopModal").style.display = "none";
}

// -------------------------------------------------------
// saveShop — เพิ่ม หรือ แก้ไข อัตโนมัติ
// -------------------------------------------------------
async function saveShop() {
  const id = document.getElementById("shopId").value;
  const name = document.getElementById("shopName").value.trim();
  const code = document.getElementById("shopCode").value.trim();
  const province = document.getElementById("shopProvince").value.trim();

  if (!name) {
    document.getElementById("shopName").focus();
    document.getElementById("shopName").style.borderColor = "#ef4444";
    return;
  }

  const btn = document.querySelector("#shopModal .btn-save");
  btn.disabled = true;
  btn.style.opacity = "0.7";

  if (id) {
    const { error } = await supabaseClient
      .from("shops")
      .update({ shop_name: name, shop_code: code || null, province: province || null })
      .eq("id", id);
    if (error) { alert("แก้ไขไม่สำเร็จ"); console.error(error); btn.disabled = false; btn.style.opacity = "1"; return; }
  } else {
    const { error } = await supabaseClient
      .from("shops")
      .insert({ shop_name: name, shop_code: code || null, province: province || null, sale_id: window.currentSaleId });
    if (error) { alert("เพิ่มไม่สำเร็จ"); console.error(error); btn.disabled = false; btn.style.opacity = "1"; return; }
  }

  closeModal();
  await loadSaleShops();
}

// -------------------------------------------------------
// unlinkShop / deleteShop
// -------------------------------------------------------
async function unlinkShop(id) {
  if (!confirm("ต้องการยกเลิกสิทธิ์ร้านค้านี้หรือไม่?")) return;

  const { error } = await supabaseClient
    .from("shops").update({ sale_id: null }).eq("id", id);

  if (error) { alert("ไม่สำเร็จ"); console.error(error); }
  else await loadSaleShops();
}

async function deleteShop(id) {
  if (!confirm("ต้องการลบร้านค้านี้ออกจากระบบ?")) return;

  const { error } = await supabaseClient
    .from("shops").delete().eq("id", id);

  if (error) { alert("ลบไม่สำเร็จ"); console.error(error); }
  else await loadSaleShops();
}

// -------------------------------------------------------
// Transfer Modal
// -------------------------------------------------------
async function openTransferModal(shopId) {
  document.getElementById("transferShopId").value = shopId;

  const select = document.getElementById("transferSaleSelect");
  select.innerHTML = `<option value="">-- เลือก Sales --</option>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, username")
    .eq("role", "sales")
    .order("display_name", { ascending: true });

  if (error) { console.error(error); return; }

  data.forEach(sale => {
    const opt = document.createElement("option");
    opt.value = sale.id;
    opt.textContent = sale.display_name || sale.username;
    select.appendChild(opt);
  });

  document.getElementById("transferModal").style.display = "flex";
}

function closeTransferModal() {
  document.getElementById("transferModal").style.display = "none";
}

async function confirmTransfer() {
  const shopId = document.getElementById("transferShopId").value;
  const newSaleId = document.getElementById("transferSaleSelect").value;

  if (!newSaleId) { alert("กรุณาเลือก Sales"); return; }

  const { error } = await supabaseClient
    .from("shops").update({ sale_id: newSaleId }).eq("id", shopId);

  if (error) { alert("โอนไม่สำเร็จ"); console.error(error); return; }

  closeTransferModal();
  await loadSaleShops();
}

// -------------------------------------------------------
// escape helpers
// -------------------------------------------------------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

// -------------------------------------------------------
// ปิด modal เมื่อกดนอก modal-box
// -------------------------------------------------------
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("modal-overlay")) {
    closeModal();
    closeTransferModal();
  }
});

// -------------------------------------------------------
// เริ่มต้น
// -------------------------------------------------------
window.addEventListener("load", async () => {
  await protectAdmin();
  await loadSalesForPermissions();
});