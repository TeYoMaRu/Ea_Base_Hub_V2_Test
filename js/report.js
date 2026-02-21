// =====================================================
// report.js
// ระบบรายงานเยี่ยมร้านค้า (Production Version)
// =====================================================



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
  }

  // โหลดข้อมูลหลักของหน้า
  await loadUserInfo();     // โหลดชื่อผู้ใช้
  await loadReports();      // โหลดตารางรายงาน
  await loadShops();        // โหลดร้านค้า
  await loadCategories();   // โหลดหมวดสินค้า

  // ตั้งค่าวันที่เริ่มต้นเป็นวันนี้
  const dateInput = document.getElementById("reportDate");
  if (dateInput) dateInput.valueAsDate = new Date();

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

});



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

    shopSelect.innerHTML = `<option value="">-- เลือกร้านค้า --</option>`;

    data?.forEach(shop => {
      const option = document.createElement("option");
      option.value = shop.id;
      option.textContent = shop.shop_name;
      shopSelect.appendChild(option);
    });

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

    categorySelect.innerHTML = `<option value="">-- เลือกหมวด --</option>`;

    data?.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });

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

    data?.forEach(product => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = product.name;
      productSelect.appendChild(option);
    });

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

    if (!attributes) return;

    // 3️⃣ สร้าง input ตามประเภท
    for (let attr of attributes) {

      const wrapper = document.createElement("div");
      wrapper.classList.add("form-group");

      const label = document.createElement("label");
      label.innerText = attr.name;
      wrapper.appendChild(label);

      if (attr.input_type === "select") {

        const select = document.createElement("select");
        select.dataset.attributeId = attr.id;
        select.classList.add("dynamic-field");

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
        wrapper.appendChild(input);
      }

      container.appendChild(wrapper);
    }

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
// 📊 LOAD REPORT TABLE (Spec รวมในคอลัมน์สินค้า)
// =====================================================
async function loadReports() {

  const tbody = document.getElementById("reportBody");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='6'>กำลังโหลด...</td></tr>";

  try {

    const { data: reports } = await supabaseClient
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (!reports || reports.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6'>ยังไม่มีข้อมูล</td></tr>";
      return;
    }

    // โหลด shop และ product ล่วงหน้า
    const shopIds = [...new Set(reports.map(r => r.shop_id).filter(Boolean))];
    const productIds = [...new Set(reports.map(r => r.product_id).filter(Boolean))];

    const { data: shops } = await supabaseClient
      .from("shops")
      .select("id, shop_name")
      .in("id", shopIds);

    const { data: products } = await supabaseClient
      .from("products")
      .select("id, name")
      .in("id", productIds);

    const shopsMap = Object.fromEntries((shops || []).map(s => [s.id, s.shop_name]));
    const productsMap = Object.fromEntries((products || []).map(p => [p.id, p.name]));

    tbody.innerHTML = "";

    // สร้างแต่ละแถว
    for (const report of reports) {

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
        <td>
          ${productsMap[report.product_id] || "-"}
          ${specText}
        </td>
        <td>${(report.quantity || 0).toLocaleString()}</td>
        <td>${report.status || "-"}</td>
        <td>
          <button onclick="viewReport('${report.id}')">👁️</button>
          <button onclick="deleteReport('${report.id}')">🗑️</button>
        </td>
      `;

      tbody.appendChild(row);
    }

  } catch (error) {
    console.error("❌ loadReports error:", error);
  }
}



// =====================================================
// 💾 SAVE REPORT
// =====================================================
async function saveReport() {

  const reportData = {
    report_date: document.getElementById("reportDate")?.value,
    shop_id: document.getElementById("shopSelect")?.value,
    product_id: document.getElementById("productSelect")?.value,
    source: document.getElementById("source")?.value,
    status: document.getElementById("status")?.value,
    quantity: parseFloat(document.getElementById("amount")?.value || 0),
    followup_date: document.getElementById("followupDate")?.value || null,
    note: document.getElementById("note")?.value,
    sale_id: (await supabaseClient.auth.getUser()).data.user.id,
    attributes: collectDynamicAttributes()
  };

  const { error } = await supabaseClient
    .from("reports")
    .insert([reportData]);

  if (error) {
    alert("❌ บันทึกไม่สำเร็จ");
    return;
  }

  alert("✅ บันทึกสำเร็จ");
  clearForm();
  loadReports();
}



// =====================================================
// 🧹 CLEAR FORM
// =====================================================
function clearForm() {
  document.getElementById("reportDate").valueAsDate = new Date();
  document.getElementById("shopSelect").value = "";
  document.getElementById("categorySelect").value = "";
  document.getElementById("productSelect").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("note").value = "";
  clearDynamicAttributes();
}



// =====================================================
// 🗓 FORMAT DATE
// =====================================================
function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("th-TH");
}