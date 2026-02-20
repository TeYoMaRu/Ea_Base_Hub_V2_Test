// ===============================
// โหลด Sales เข้า Dropdown
// ===============================
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
}


// ===============================
// โหลดร้านค้าของ Sales ที่เลือก
// ===============================
async function loadSaleShops() {
  const saleId = document.getElementById("selectSaleForPerm").value;
  const container = document.getElementById("permissionsContainer");

  if (!saleId) {
    container.innerHTML = `
      <div class="empty-state">
        เลือก Sales เพื่อดูสิทธิ์ร้านค้า
      </div>
    `;
    return;
  }

  const { data, error } = await supabaseClient
    .from("shops")
    .select("*")
    .eq("sale_id", saleId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  renderShops(data, saleId);
}

// ===============================
// แสดงร้านค้า
// ===============================
function renderShops(shops, saleId) {
  const container = document.getElementById("permissionsContainer");

if (shops.length === 0) {
  container.innerHTML = `
    <div class="empty-state">
      ยังไม่มีร้านค้า
      <br><br>
        <button onclick="openAddModal('${saleId}')">➕ เพิ่มร้าน</button>
    </div>
  `;
  return;
}


  let html = `
    <div class="shop-header">
      <h3>จำนวนร้านทั้งหมด: ${shops.length}</h3>
      <button onclick="openAddModal('${saleId}')">➕ เพิ่มร้าน</button>
    </div>

    <div class="shop-list">
  `;

  shops.forEach(shop => {
  html += `
  <div class="shop-card">

    <div class="shop-info">
      <div class="shop-name">${shop.shop_name}</div>
      <div class="shop-code">${shop.shop_code || "-"}</div>
    </div>

    <div class="shop-actions">
      <button class="btn-icon btn-edit" onclick="editShop('${shop.id}','${shop.shop_name}','${shop.shop_code}')">
        ✏
      </button>

      <button class="btn-icon btn-transfer" onclick="openTransferModal('${shop.id}')">
        🔄
      </button>

      <button class="btn-icon btn-unlink" onclick="unlinkShop('${shop.id}')">
        ❌
      </button>

      <button class="btn-icon btn-delete" onclick="deleteShop('${shop.id}')">
        🗑
      </button>
    </div>

  </div>
`;

  });

  html += `</div>`;
  container.innerHTML = html;
}

// ===============================
// ยกเลิกการเชื่อมโยง
// ===============================
async function unlinkShop(id) {

  if (!confirm("ต้องการยกเลิกการเชื่อมโยงร้านค้านี้หรือไม่?")) return;

  const { error } = await supabaseClient
    .from("shops")
    .update({ sale_id: null })
    .eq("id", id);

  if (error) {
    alert("ไม่สำเร็จ");
    console.error(error);
  } else {
    loadSaleShops();
  }
}

// ===============================
// “โอนร้านไป Sales คนอื่น
// ===============================
async function transferShop(shopId) {

  const newSaleId = prompt("กรอก ID Sales ใหม่:");

  if (!newSaleId) return;

  const { error } = await supabaseClient
    .from("shops")
    .update({ sale_id: newSaleId })
    .eq("id", shopId);

  if (error) {
    alert("โอนไม่สำเร็จ");
    console.error(error);
  } else {
    alert("โอนสำเร็จ");
    loadSaleShops();
  }
}

// ===============================
// เพิ่มร้านค้า
// ===============================
async function addShop(saleId) {
  const shopName = prompt("ชื่อร้านค้า:");
  if (!shopName) return;

  const shopCode = prompt("รหัสร้านค้า (ถ้ามี):");

  const { error } = await supabaseClient.from("shops").insert([
    {
      shop_name: shopName,
      shop_code: shopCode,
      sale_id: saleId
    }
  ]);

  if (error) {
    alert("เพิ่มไม่สำเร็จ");
    console.error(error);
  } else {
    loadSaleShops();
  }
}

// ===============================
// แก้ไขร้านค้า
// ===============================
async function editShop(id, currentName, currentCode) {
  const newName = prompt("แก้ไขชื่อร้าน:", currentName);
  if (!newName) return;

  const newCode = prompt("แก้ไขรหัสร้าน:", currentCode);

  const { error } = await supabaseClient
    .from("shops")
    .update({
      shop_name: newName,
      shop_code: newCode
    })
    .eq("id", id);

  if (error) {
    alert("แก้ไขไม่สำเร็จ");
    console.error(error);
  } else {
    loadSaleShops();
  }
}

// ===============================
// ลบร้านค้า
// ===============================
async function deleteShop(id) {
  if (!confirm("ต้องการลบร้านค้านี้ใช่หรือไม่?")) return;

  const { error } = await supabaseClient
    .from("shops")
    .delete()
    .eq("id", id);

  if (error) {
    alert("ลบไม่สำเร็จ");
    console.error(error);
  } else {
    loadSaleShops();
  }
}

// ===============================
// โหลดตอนเปิดหน้า
// ===============================
window.addEventListener("load", async () => {
  await protectSales();
  await loadSalesForPermissions();
});



// ===============================
// เปิด Modal เพิ่มร้าน
// ===============================

function openAddModal(saleId) {
  document.getElementById("modalTitle").textContent = "เพิ่มร้านค้า";
  document.getElementById("shopId").value = "";
  document.getElementById("shopName").value = "";
  document.getElementById("shopCode").value = "";

  document.getElementById("shopModal").style.display = "flex";

  window.currentSaleId = saleId;
}

// ===============================
// เปิด Modal แก้ไข
// ===============================

function openEditModal(id, name, code) {
  document.getElementById("modalTitle").textContent = "แก้ไขร้านค้า";
  document.getElementById("shopId").value = id;
  document.getElementById("shopName").value = name;
  document.getElementById("shopCode").value = code || "";

  document.getElementById("shopModal").style.display = "flex";
}

// ===============================
// ปิด Modal
// ===============================

function closeModal() {
  document.getElementById("shopModal").style.display = "none";
}



// ===============================
// บันทึก (เพิ่ม + แก้ไข อัตโนมัติ)
// ===============================

async function saveShop() {
  const id = document.getElementById("shopId").value;
  const name = document.getElementById("shopName").value.trim();
  const code = document.getElementById("shopCode").value.trim();

  if (!name) {
    alert("กรุณากรอกชื่อร้าน");
    return;
  }

  if (id) {
    // UPDATE
    const { error } = await supabaseClient
      .from("shops")
      .update({
        shop_name: name,
        shop_code: code
      })
      .eq("id", id);

    if (error) {
      alert("แก้ไขไม่สำเร็จ");
      console.error(error);
      return;
    }

  } else {
    // INSERT
    const { error } = await supabaseClient
      .from("shops")
      .insert({
        shop_name: name,
        shop_code: code,
        sale_id: window.currentSaleId
      });

    if (error) {
      alert("เพิ่มไม่สำเร็จ");
      console.error(error);
      return;
    }
  }

  closeModal();
  loadSaleShops();
}

//เปิด Modal และโหลด Sales เข้า Dropdown
async function openTransferModal(shopId) {

  document.getElementById("transferShopId").value = shopId;

  const select = document.getElementById("transferSaleSelect");
  select.innerHTML = `<option value="">-- เลือก Sales --</option>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, username")
    .eq("role", "sales")
    .order("display_name", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  data.forEach(sale => {
    const option = document.createElement("option");
    option.value = sale.id;
    option.textContent = sale.display_name || sale.username;
    select.appendChild(option);
  });

  document.getElementById("transferModal").style.display = "flex";
}


//ปิด Modal
function closeTransferModal() {
  document.getElementById("transferModal").style.display = "none";
}

//ยืนยันโอน
async function confirmTransfer() {

  const shopId = document.getElementById("transferShopId").value;
  const newSaleId = document.getElementById("transferSaleSelect").value;

  if (!newSaleId) {
    alert("กรุณาเลือก Sales");
    return;
  }

  const { error } = await supabaseClient
    .from("shops")
    .update({ sale_id: newSaleId })
    .eq("id", shopId);

  if (error) {
    alert("โอนไม่สำเร็จ");
    console.error(error);
    return;
  }

  closeTransferModal();
  loadSaleShops();
}
