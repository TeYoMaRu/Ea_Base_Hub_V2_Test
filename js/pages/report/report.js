// =====================================================
// report.js
// ระบบรายงานเยี่ยมร้านค้า (Production Version)
// =====================================================

// =====================================================
// 🌐 GLOBAL VARIABLES
// =====================================================
let currentEditId = null;
let reports = [];        // เก็บข้อมูลรายงานทั้งหมด
let shopsMap = {};       // เก็บข้อมูลร้านค้าเป็น Map
let productsMap = {};    // เก็บข้อมูลสินค้าเป็น Map

// =====================================================
// 🚀 INITIALIZE PAGE
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Page loaded");

  // 🔐 ตรวจสอบสิทธิ์ก่อนเข้าใช้งานหน้า
  try {
    await protectPage(["admin", "sales", "manager", "user"]);
    console.log("✅ Auth check passed");
  } catch (error) {
    console.error("❌ Auth error:", error);
    return; // หยุดการทำงานถ้า auth ไม่ผ่าน
  }

  await loadUserHeader();

  // โหลดข้อมูลหลักของหน้า
  await initializePageData();

  // ตั้งค่าวันที่เริ่มต้นเป็นวันนี้
  setDefaultDate();

  // ตั้งค่า Event Listeners
  setupEventListeners();

  setupLogout();
});

// =====================================================
// 👤 LOAD USER HEADER
// =====================================================
async function loadUserHeader() {

  try {

    // ดึง session
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      console.error("Session error:", error);
      return;
    }

    const session = data.session;

    if (!session) {
      console.warn("No session found");
      return;
    }

    const userId = session.user.id;

    // ดึง profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("display_name, role")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
    }

    const name = profile?.display_name || session.user.email;
    const role = profile?.role || "user";

    // ===== แสดงบนหน้าเว็บ =====
    const userName = document.getElementById("userName");
    const userRole = document.getElementById("userRole");
    const userAvatar = document.getElementById("userAvatar");

    if (userName) userName.textContent = name;
    if (userRole) userRole.textContent = role;

    // Avatar ตัวอักษรแรก
    if (userAvatar) {
      userAvatar.textContent = name.charAt(0).toUpperCase();
    }

  } catch (err) {
    console.error("loadUserHeader error:", err);
  }

}



// =====================================================
// 📦 INITIALIZE DATA
// =====================================================
async function initializePageData() {
  try {
    await Promise.all([
      loadUserInfo(),     // โหลดชื่อผู้ใช้
      loadReports(),      // โหลดตารางรายงาน
      loadShops(),        // โหลดร้านค้า
      loadCategories()    // โหลดหมวดสินค้า
    ]);
    console.log("✅ All data loaded successfully");
  } catch (error) {
    console.error("❌ Error loading page data:", error);
  }
}

function setDefaultDate() {
  const dateInput = document.getElementById("reportDate");
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }
  
  // ตั้งค่า followup date เป็น 7 วันข้างหน้า
  const followupInput = document.getElementById("followupDate");
  if (followupInput) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    followupInput.valueAsDate = nextWeek;
  }
}

// =====================================================
// 🎯 EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  // เมื่อเปลี่ยนหมวดสินค้า → โหลดสินค้าใหม่
  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      loadProducts(e.target.value);
      clearDynamicAttributes(); // ล้าง spec เดิม
    });
  }

  // เมื่อเปลี่ยนสินค้า → โหลด Dynamic Spec
  const productSelect = document.getElementById("productSelect");
  if (productSelect) {
    productSelect.addEventListener("change", handleProductChange);
  }

  // ปุ่มบันทึกรายงาน
  const saveBtn = document.getElementById("saveReportBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", saveReport);
  }

  // ปุ่มบันทึกการแก้ไข
  const saveEditBtn = document.getElementById("saveEditBtn");
  if (saveEditBtn) {
    saveEditBtn.addEventListener("click", saveEdit);
  }

  // ปุ่มปิด Modal
  const closeModalBtn = document.getElementById("closeModalBtn");
  if (closeModalBtn) {
    closeModalBtn.addEventListener("click", closeModal);
  }

  // คลิกนอก Modal เพื่อปิด
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  }
}

// =====================================================
// 📝 MODAL MANAGEMENT
// =====================================================
function openModal() {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden"; // ป้องกันการ scroll
  }
}

function closeModal() {
  const modal = document.getElementById("reportModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = ""; // คืนค่าการ scroll
  }
  // รีเซ็ต currentEditId เมื่อปิด Modal
  currentEditId = null;
}

// =====================================================
// 👁️ VIEW REPORT
// =====================================================
async function handleView(id) {
  const report = reports.find(r => r.id === id);
  if (!report) {
    console.error("Report not found:", id);
    alert("❌ ไม่พบรายงานที่ต้องการดู");
    return;
  }

  // ตั้งค่าหัวข้อ Modal
  const modalTitle = document.getElementById("modalTitle");
  if (modalTitle) modalTitle.innerText = "รายละเอียดรายงาน";

  // แสดงข้อมูลรายงาน
  setElementText("m-date", formatDate(report.report_date || report.created_at));
  setElementText("m-store", shopsMap[report.shop_id] || "-");
  setElementText("m-product", productsMap[report.product_id] || "-");
  setElementText("m-source", report.source || "-");
  setElementText("m-status", report.status || "-");
  setElementText("m-qty", report.quantity || "0");
  setElementText("m-followup", formatDate(report.followup_date));

  // แสดง Attributes (ถ้ามี)
  const attrContainer = document.getElementById("m-attributes");
  if (attrContainer) {
    attrContainer.innerHTML = await formatAttributes(report.attributes);
  }

  // ตั้งค่า Note (แบบ read-only)
  const noteElement = document.getElementById("m-note");
  if (noteElement) {
    noteElement.value = report.note || "-";
    noteElement.disabled = true;
  }

  // ซ่อนปุ่มบันทึก
  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) saveBtn.style.display = "none";

  openModal();
}

// =====================================================
// ✏️ EDIT REPORT
// =====================================================
async function handleEdit(id) {
  const report = reports.find(r => r.id === id);
  if (!report) {
    console.error("Report not found:", id);
    alert("❌ ไม่พบรายงานที่ต้องการแก้ไข");
    return;
  }

  // เก็บ ID ของรายงานที่กำลังแก้ไข
  currentEditId = id;

  // ตั้งค่าหัวข้อ Modal
  const modalTitle = document.getElementById("modalTitle");
  if (modalTitle) modalTitle.innerText = "แก้ไขรายงาน";

  // แสดงข้อมูลรายงาน
  setElementText("m-date", formatDate(report.report_date || report.created_at));
  setElementText("m-store", shopsMap[report.shop_id] || "-");
  setElementText("m-product", productsMap[report.product_id] || "-");
  setElementText("m-source", report.source || "-");
  setElementText("m-status", report.status || "-");
  setElementText("m-qty", report.quantity || "0");
  setElementText("m-followup", formatDate(report.followup_date));

  // แสดง Attributes (ถ้ามี)
  const attrContainer = document.getElementById("m-attributes");
  if (attrContainer) {
    attrContainer.innerHTML = await formatAttributes(report.attributes);
  }

  // ตั้งค่า Note (แบบ editable)
  const noteElement = document.getElementById("m-note");
  if (noteElement) {
    noteElement.value = report.note || "";
    noteElement.disabled = false;
  }

  // แสดงปุ่มบันทึก
  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) saveBtn.style.display = "inline-block";

  openModal();
}

// =====================================================
// 💾 SAVE EDIT
// =====================================================
async function saveEdit() {
  if (!currentEditId) {
    alert("❌ ไม่พบรายงานที่ต้องการแก้ไข");
    return;
  }

  const noteElement = document.getElementById("m-note");
  if (!noteElement) {
    alert("❌ ไม่พบฟิลด์หมายเหตุ");
    return;
  }

  const newNote = noteElement.value.trim();

  try {
    const { error } = await supabaseClient
      .from("reports")
      .update({ 
        note: newNote,
        updated_at: new Date().toISOString()
      })
      .eq("id", currentEditId);

    if (error) {
      console.error("Supabase error:", error);
      alert("❌ บันทึกไม่สำเร็จ");
      return;
    }

    // อัพเดทข้อมูลใน array local
    const reportIndex = reports.findIndex(r => r.id === currentEditId);
    if (reportIndex !== -1) {
      reports[reportIndex].note = newNote;
    }

    alert("✅ บันทึกสำเร็จ");
    closeModal();
    
    // โหลดตารางใหม่
    await loadReportsUI();
  } catch (error) {
    console.error("Error saving edit:", error);
    alert("❌ เกิดข้อผิดพลาดในการบันทึก");
  }
}

// =====================================================
// 🗑️ DELETE REPORT
// =====================================================
async function handleDelete(id) {
  if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายงานนี้?")) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("reports")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase error:", error);
      alert("❌ ลบไม่สำเร็จ");
      return;
    }

    // ลบออกจาก array local
    reports = reports.filter(r => r.id !== id);

    alert("✅ ลบสำเร็จ");
    await loadReportsUI();
  } catch (error) {
    console.error("Error deleting report:", error);
    alert("❌ เกิดข้อผิดพลาดในการลบ");
  }
}

// =====================================================
// 👤 LOAD USER INFO
// =====================================================
async function loadUserInfo() {
  try {
    // ดึง session ปัจจุบัน
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;

    // ดึงชื่อจาก profiles table
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .single();

    const userNameElement = document.querySelector(".user-name");
    if (userNameElement) {
      userNameElement.textContent =
        profile?.display_name || session.user.email;
    }
  } catch (error) {
    console.error("❌ loadUserInfo error:", error);
  }
}

// =====================================================
// 🏪 LOAD SHOPS
// =====================================================
async function loadShops() {
  const shopSelect = document.getElementById("shopSelect");
  if (!shopSelect) return;

  try {
    const { data, error } = await supabaseClient
      .from("shops")
      .select("id, shop_name")
      .eq("status", "Active")
      .order("shop_name");

    if (error) throw error;

    // เก็บเป็น Map สำหรับใช้งานภายหลัง
    shopsMap = Object.fromEntries((data || []).map(s => [s.id, s.shop_name]));

    shopSelect.innerHTML = `<option value="">-- เลือกร้านค้า --</option>`;

    data?.forEach(shop => {
      const option = document.createElement("option");
      option.value = shop.id;
      option.textContent = shop.shop_name;
      shopSelect.appendChild(option);
    });

    console.log(`✅ Loaded ${data?.length || 0} shops`);
  } catch (error) {
    console.error("❌ loadShops error:", error);
  }
}

// =====================================================
// 📂 LOAD CATEGORIES
// =====================================================
async function loadCategories() {
  const categorySelect = document.getElementById("categorySelect");
  if (!categorySelect) return;

  try {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("id, name")
      .order("name");

    if (error) throw error;

    categorySelect.innerHTML = `<option value="">-- เลือกหมวดสินค้า --</option>`;

    data?.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });

    console.log(`✅ Loaded ${data?.length || 0} categories`);
  } catch (error) {
    console.error("❌ loadCategories error:", error);
  }
}

// =====================================================
// 🛍️ LOAD PRODUCTS BY CATEGORY
// =====================================================
async function loadProducts(categoryId) {
  const productSelect = document.getElementById("productSelect");
  if (!productSelect) return;

  productSelect.innerHTML = `<option value="">-- เลือกสินค้า --</option>`;
  if (!categoryId) return;

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id, name")
      .eq("category_id", categoryId)
      .order("name");

    if (error) throw error;

    // เก็บเป็น Map สำหรับใช้งานภายหลัง
    if (data) {
      data.forEach(p => {
        productsMap[p.id] = p.name;
      });
    }

    data?.forEach(product => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = product.name;
      productSelect.appendChild(option);
    });

    console.log(`✅ Loaded ${data?.length || 0} products`);
  } catch (error) {
    console.error("❌ loadProducts error:", error);
  }
}

// =====================================================
// 🧩 HANDLE DYNAMIC ATTRIBUTE FORM
// =====================================================
async function handleProductChange() {
  const productId = this.value;
  const container = document.getElementById("dynamicAttributes");
  if (!container) return;

  container.innerHTML = "";
  if (!productId) return;

  try {
    // 1️⃣ หา category ของสินค้า
    const { data: product } = await supabaseClient
      .from("products")
      .select("category_id")
      .eq("id", productId)
      .single();

    if (!product) return;

    // 2️⃣ โหลด attributes ตาม category
    const { data: attributes } = await supabaseClient
      .from("attributes")
      .select("*")
      .eq("category_id", product.category_id)
      .order("order_no", { ascending: true });

    if (!attributes || attributes.length === 0) {
      console.log("ℹ️ No attributes for this product");
      return;
    }

    // 3️⃣ สร้าง input ตามประเภท
    for (let attr of attributes) {
      const wrapper = document.createElement("div");
      wrapper.classList.add("form-group");

      const label = document.createElement("label");
      label.innerText = attr.name;
      if (attr.is_required) {
        label.innerHTML += ' <span style="color:red;">*</span>';
      }
      wrapper.appendChild(label);

      if (attr.input_type === "select") {
        const select = document.createElement("select");
        select.dataset.attributeId = attr.id;
        select.classList.add("dynamic-field");
        if (attr.is_required) {
          select.required = true;
        }

        const { data: options } = await supabaseClient
          .from("attribute_options")
          .select("value")
          .eq("attribute_id", attr.id)
          .order("value");

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "-- เลือก --";
        select.appendChild(defaultOption);

        options?.forEach(opt => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.value;
          select.appendChild(option);
        });

        wrapper.appendChild(select);

      } else {
        const input = document.createElement("input");
        input.type = attr.input_type === "number" ? "number" : "text";
        input.dataset.attributeId = attr.id;
        input.classList.add("dynamic-field");
        if (attr.is_required) {
          input.required = true;
        }
        wrapper.appendChild(input);
      }

      container.appendChild(wrapper);
    }

    console.log(`✅ Loaded ${attributes.length} attributes`);
  } catch (error) {
    console.error("❌ handleProductChange error:", error);
  }
}

// =====================================================
// 📋 COLLECT DYNAMIC ATTRIBUTE VALUES
// =====================================================
function collectDynamicAttributes() {
  const fields = document.querySelectorAll(".dynamic-field");
  const attributes = {};

  fields.forEach(field => {
    if (field.value) {
      attributes[field.dataset.attributeId] = field.value;
    }
  });

  return attributes;
}

// =====================================================
// 🧹 CLEAR DYNAMIC ATTRIBUTES
// =====================================================
function clearDynamicAttributes() {
  const container = document.getElementById("dynamicAttributes");
  if (container) {
    container.innerHTML = "";
  }
}

// =====================================================
// 📊 LOAD REPORT TABLE (Main Function)
// =====================================================
async function loadReports() {
  const tbody = document.getElementById("reportBody");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='6'>กำลังโหลด...</td></tr>";

  try {
    const { data, error } = await supabaseClient
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // เก็บไว้ใน global variable
    reports = data || [];

    if (reports.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6'>ยังไม่มีข้อมูล</td></tr>";
      return;
    }

    // โหลด products ที่ยังไม่มีใน Map
    const missingProductIds = reports
      .map(r => r.product_id)
      .filter(id => id && !productsMap[id]);

    if (missingProductIds.length > 0) {
      const { data: products } = await supabaseClient
        .from("products")
        .select("id, name")
        .in("id", [...new Set(missingProductIds)]);

      if (products) {
        products.forEach(p => {
          productsMap[p.id] = p.name;
        });
      }
    }

    // สร้าง UI
    await loadReportsUI();

    console.log(`✅ Loaded ${reports.length} reports`);
  } catch (error) {
    console.error("❌ loadReports error:", error);
    tbody.innerHTML = "<tr><td colspan='6'>เกิดข้อผิดพลาดในการโหลดข้อมูล</td></tr>";
  }
}

// =====================================================
// 🎨 RENDER REPORT TABLE UI
// =====================================================
async function loadReportsUI() {
  const tbody = document.getElementById("reportBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  for (const report of reports) {
    // จัดรูปแบบ Spec
    let specText = "";
    if (report.attributes && Object.keys(report.attributes).length > 0) {
      const attributeIds = Object.keys(report.attributes);

      const { data: attrData } = await supabaseClient
        .from("attributes")
        .select("id, name")
        .in("id", attributeIds);

      const attrMap = Object.fromEntries(
        (attrData || []).map(a => [a.id, a.name])
      );

      const specArray = [];
      for (let [attrId, value] of Object.entries(report.attributes)) {
        specArray.push(`${attrMap[attrId] || attrId}: ${value}`);
      }

      specText = `<br><small style="color:#666;">${specArray.join(" | ")}</small>`;
    }

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatDate(report.report_date || report.created_at)}</td>
      <td>${shopsMap[report.shop_id] || "-"}</td>
      <td>${report.status || "-"}</td>
      <td class="detail-text" title="${escapeHtml(report.note || "-")}">
        ${escapeHtml(report.note || "-")}
      </td>
      <td>
        ${productsMap[report.product_id] || "-"}
        ${specText}
      </td>
      <td class="action-buttons">
        <button onclick="handleView('${report.id}')" title="ดูรายละเอียด">👁️</button>
        <button onclick="handleEdit('${report.id}')" title="แก้ไข">✏️</button>
        <button onclick="handleDelete('${report.id}')" title="ลบ">🗑️</button>
      </td>
    `;

    tbody.appendChild(row);
  }
}

// =====================================================
// 💾 SAVE REPORT
// =====================================================
async function saveReport() {
  // Validate form
  const reportDate = document.getElementById("reportDate")?.value;
  const shopId = document.getElementById("shopSelect")?.value;
  const productId = document.getElementById("productSelect")?.value;
  const status = document.getElementById("status")?.value;
  const quantity = parseFloat(document.getElementById("amount")?.value || 0);

  if (!reportDate) {
    alert("❌ กรุณาเลือกวันที่");
    return;
  }

  if (!shopId) {
    alert("❌ กรุณาเลือกร้านค้า");
    return;
  }

  if (!productId) {
    alert("❌ กรุณาเลือกสินค้า");
    return;
  }

  if (!status) {
    alert("❌ กรุณาเลือกสถานะ");
    return;
  }

  if (quantity <= 0) {
    alert("❌ กรุณาระบุจำนวนที่มากกว่า 0");
    return;
  }

  try {

    // ใช้ userService
    const userId = getUserData("id");
    
    const reportData = {
      report_date: reportDate,
      shop_id: shopId,
      product_id: productId,
      source: document.getElementById("source")?.value || null,
      status: status,
      quantity: quantity,
      followup_date: document.getElementById("followupDate")?.value || null,
      note: document.getElementById("note")?.value || null,
      sale_id: userId,
      attributes: collectDynamicAttributes(),
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("reports")
      .insert([reportData])
      .select();

    if (error) {
      console.error("Supabase error:", error);
      alert("❌ บันทึกไม่สำเร็จ");
      return;
    }

    alert("✅ บันทึกสำเร็จ");
    clearForm();
    await loadReports();
  } catch (error) {
    console.error("Error saving report:", error);
    alert("❌ เกิดข้อผิดพลาดในการบันทึก");
  }
}

// =====================================================
// 🧹 CLEAR FORM
// =====================================================
function clearForm() {
  document.getElementById("reportDate").valueAsDate = new Date();
  document.getElementById("shopSelect").value = "";
  document.getElementById("categorySelect").value = "";
  document.getElementById("productSelect").value = "";
  document.getElementById("source").value = "";
  document.getElementById("status").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("note").value = "";
  
  const followupInput = document.getElementById("followupDate");
  if (followupInput) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    followupInput.valueAsDate = nextWeek;
  }
  
  clearDynamicAttributes();
  
  console.log("✅ Form cleared");
}

// =====================================================
// 🛠️ HELPER FUNCTIONS
// =====================================================
function setElementText(elementId, text) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerText = text || "-";
  }
}

function formatDate(dateString) {
  if (!dateString) return "-";
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "-";
  }
}

async function formatAttributes(attributes) {
  if (!attributes || Object.keys(attributes).length === 0) {
    return "<p>-</p>";
  }

  try {
    const attributeIds = Object.keys(attributes);

    const { data: attrData } = await supabaseClient
      .from("attributes")
      .select("id, name")
      .in("id", attributeIds);

    const attrMap = Object.fromEntries(
      (attrData || []).map(a => [a.id, a.name])
    );

    const specArray = [];
    for (let [attrId, value] of Object.entries(attributes)) {
      specArray.push(`<strong>${attrMap[attrId] || attrId}:</strong> ${value}`);
    }

    return `<div style="font-size:0.9em;">${specArray.join("<br>")}</div>`;
  } catch (error) {
    console.error("Error formatting attributes:", error);
    return "<p>-</p>";
  }
}

function escapeHtml(text) {
  if (!text) return "";
  
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// =====================================================
// 🔍 FILTER & SEARCH (Optional Enhancement)
// =====================================================
function filterReports(filterType, filterValue) {
  // สำหรับใช้งานในอนาคต
  console.log(`Filter by ${filterType}: ${filterValue}`);
}

// =====================================================
// 📤 EXPORT (Optional Enhancement)
// =====================================================
function exportReports() {
  // สำหรับใช้งานในอนาคต
  console.log("Export reports");
}

// =====================================================
// 🚪 LOGOUT
// =====================================================
function setupLogout() {

  const logoutBtn = document.getElementById("logoutBtn");

  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {

    await supabaseClient.auth.signOut();

    window.location.href = "/pages/auth/login.html";

  });

}
