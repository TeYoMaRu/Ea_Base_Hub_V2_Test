// =====================================================
// report.js (Debug Version - แก้ปัญหา dropdown ไม่แสดง)
// หน้ารายงานเยี่ยมร้านค้า
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {

  console.log("🚀 Page loaded");

  // 🔐 ป้องกันหน้า
  try {
    await protectPage(["admin", "sales", "manager", "user"]);
    console.log("✅ Auth check passed");
  } catch (error) {
    console.error("❌ Auth error:", error);
  }

  await loadUserInfo();
  await loadReports();
  await loadShops();
  await loadCategories();

  // ตั้งค่าวันที่เริ่มต้นเป็นวันนี้
  const dateInput = document.getElementById("reportDate");
  if (dateInput) {
    dateInput.valueAsDate = new Date();
  }

  // เมื่อเปลี่ยนหมวด → โหลดสินค้า
  const categorySelect = document.getElementById("categorySelect");
  if (categorySelect) {
    categorySelect.addEventListener("change", (e) => {
      console.log("📦 Category changed:", e.target.value);
      loadProducts(e.target.value);
      clearDynamicAttributes();
    });
  } else {
    console.error("❌ categorySelect not found");
  }

  // เมื่อเปลี่ยนสินค้า → โหลด Dynamic Attribute
  const productSelect = document.getElementById("productSelect");
  if (productSelect) {
    productSelect.addEventListener("change", handleProductChange);
  } else {
    console.error("❌ productSelect not found");
  }

});


// =====================================================
// โหลดชื่อผู้ใช้
// =====================================================
async function loadUserInfo() {

  console.log("👤 Loading user info...");

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (!session) {
      console.warn("⚠️ No session found");
      return;
    }

    const { data: profile, error } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("❌ Profile error:", error);
    }

    const userNameElement = document.querySelector(".user-name");

    if (userNameElement) {
      userNameElement.textContent = profile?.display_name || session.user.email;
      console.log("✅ User loaded:", userNameElement.textContent);
    }

  } catch (error) {
    console.error("❌ loadUserInfo error:", error);
  }
}


// =====================================================
// โหลดร้านค้า
// =====================================================
async function loadShops() {

  console.log("🏪 Loading shops...");

  const shopSelect = document.getElementById("shopSelect");

  if (!shopSelect) {
    console.error("❌ shopSelect element not found!");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("shops")
      .select("id, shop_name")
      .eq("status", "Active")
      .order("shop_name");

    if (error) {
      console.error("❌ Shops query error:", error);
      shopSelect.innerHTML = `<option value="">เกิดข้อผิดพลาด</option>`;
      return;
    }

    console.log("📊 Shops data:", data);

    shopSelect.innerHTML = `<option value="">-- เลือกร้านค้า --</option>`;

    if (!data || data.length === 0) {
      console.warn("⚠️ No shops found");
      return;
    }

    data.forEach(shop => {
      const option = document.createElement("option");
      option.value = shop.id;
      option.textContent = shop.shop_name;
      shopSelect.appendChild(option);
    });

    console.log(`✅ Loaded ${data.length} shops`);

  } catch (error) {
    console.error("❌ loadShops error:", error);
  }
}


// =====================================================
// โหลดหมวดสินค้า
// =====================================================
async function loadCategories() {

  console.log("📂 Loading categories...");

  const categorySelect = document.getElementById("categorySelect");

  if (!categorySelect) {
    console.error("❌ categorySelect element not found!");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("categories")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("❌ Categories query error:", error);
      categorySelect.innerHTML = `<option value="">เกิดข้อผิดพลาด</option>`;
      return;
    }

    console.log("📊 Categories data:", data);

    categorySelect.innerHTML = `<option value="">-- เลือกหมวด --</option>`;

    if (!data || data.length === 0) {
      console.warn("⚠️ No categories found");
      return;
    }

    data.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });

    console.log(`✅ Loaded ${data.length} categories`);

  } catch (error) {
    console.error("❌ loadCategories error:", error);
  }
}


// =====================================================
// โหลดสินค้าตามหมวด
// =====================================================
async function loadProducts(categoryId) {

  console.log("🛍️ Loading products for category:", categoryId);

  const productSelect = document.getElementById("productSelect");

  if (!productSelect) {
    console.error("❌ productSelect element not found!");
    return;
  }

  productSelect.innerHTML = `<option value="">-- เลือกสินค้า --</option>`;

  if (!categoryId) {
    console.log("ℹ️ No category selected");
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id, name")
      .eq("category_id", categoryId)
      .order("name");

    if (error) {
      console.error("❌ Products query error:", error);
      productSelect.innerHTML = `<option value="">เกิดข้อผิดพลาด</option>`;
      return;
    }

    console.log("📊 Products data:", data);

    if (!data || data.length === 0) {
      console.warn("⚠️ No products found for this category");
      productSelect.innerHTML = `<option value="">-- ไม่มีสินค้าในหมวดนี้ --</option>`;
      return;
    }

    data.forEach(product => {
      const option = document.createElement("option");
      option.value = product.id;
      option.textContent = product.name;
      productSelect.appendChild(option);
    });

    console.log(`✅ Loaded ${data.length} products`);

  } catch (error) {
    console.error("❌ loadProducts error:", error);
  }
}


// =====================================================
// Dynamic Attribute System
// =====================================================
async function handleProductChange() {

  const productId = this.value;
  console.log("🔧 Product changed:", productId);

  const container = document.getElementById("dynamicAttributes");
  
  if (!container) {
    console.error("❌ dynamicAttributes container not found!");
    return;
  }

  container.innerHTML = "";

  if (!productId) {
    console.log("ℹ️ No product selected");
    return;
  }

  try {
    // 1️⃣ ดึง category_id
    const { data: product, error: productError } = await supabaseClient
      .from("products")
      .select("category_id")
      .eq("id", productId)
      .single();

    if (productError) {
      console.error("❌ Product query error:", productError);
      return;
    }

    if (!product) {
      console.warn("⚠️ Product not found");
      return;
    }

    console.log("📦 Product category_id:", product.category_id);

    // 2️⃣ โหลด attributes
    const { data: attributes, error: attrError } = await supabaseClient
      .from("attributes")
      .select("*")
      .eq("category_id", product.category_id)
      .order("name");

    if (attrError) {
      console.error("❌ Attributes query error:", attrError);
      return;
    }

    console.log("📊 Attributes data:", attributes);

    if (!attributes || attributes.length === 0) {
      console.log("ℹ️ No attributes for this category");
      return;
    }

    for (let attr of attributes) {

      console.log("➕ Adding attribute:", attr.name);

      const wrapper = document.createElement("div");
      wrapper.classList.add("form-group");

      const label = document.createElement("label");
      label.innerText = attr.name;
      wrapper.appendChild(label);

      if (attr.input_type === "select") {

        const select = document.createElement("select");
        select.dataset.attributeId = attr.id;
        select.classList.add("dynamic-field");

        const { data: options, error: optError } = await supabaseClient
          .from("attribute_options")
          .select("value")
          .eq("attribute_id", attr.id)
          .order("value");

        if (optError) {
          console.error("❌ Options query error:", optError);
        }

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

    console.log(`✅ Added ${attributes.length} dynamic attributes`);

  } catch (error) {
    console.error("❌ handleProductChange error:", error);
  }
}


// =====================================================
// เก็บค่า Dynamic Attributes
// =====================================================
function collectDynamicAttributes() {
  const fields = document.querySelectorAll(".dynamic-field");
  const attributes = {};

  fields.forEach(field => {
    const attrId = field.dataset.attributeId;
    const value = field.value;
    if (value) {
      attributes[attrId] = value;
    }
  });

  console.log("📋 Collected attributes:", attributes);
  return attributes;
}


// =====================================================
// โหลดรายงาน (Manual Join - ไม่ใช้ FK)
// =====================================================
async function loadReports() {

  console.log("📋 Loading reports...");

  const tbody = document.getElementById("reportBody");
  
  if (!tbody) {
    console.error("❌ reportBody element not found!");
    return;
  }

  tbody.innerHTML = "<tr><td colspan='6'>กำลังโหลด...</td></tr>";

  try {
    // 1️⃣ ดึงข้อมูล reports
    const { data: reports, error: reportError } = await supabaseClient
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (reportError) {
      console.error("❌ Reports query error:", reportError);
      tbody.innerHTML = `<tr><td colspan="6">เกิดข้อผิดพลาด: ${reportError.message}</td></tr>`;
      return;
    }

    console.log("📊 Reports data:", reports);

    if (!reports || reports.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6">ยังไม่มีข้อมูล</td></tr>`;
      return;
    }

    // 2️⃣ ดึงข้อมูลร้านค้าและสินค้าทั้งหมด
    const shopIds = [...new Set(reports.map(r => r.shop_id).filter(Boolean))];
    const productIds = [...new Set(reports.map(r => r.product_id).filter(Boolean))];

    let shopsMap = {};
    let productsMap = {};

    if (shopIds.length > 0) {
      const { data: shops } = await supabaseClient
        .from("shops")
        .select("id, shop_name")
        .in("id", shopIds);
      
      shopsMap = Object.fromEntries((shops || []).map(s => [s.id, s.shop_name]));
      console.log("🏪 Shops map:", shopsMap);
    }

    if (productIds.length > 0) {
      const { data: products } = await supabaseClient
        .from("products")
        .select("id, name")
        .in("id", productIds);
      
      productsMap = Object.fromEntries((products || []).map(p => [p.id, p.name]));
      console.log("🛍️ Products map:", productsMap);
    }

    // 3️⃣ แสดงผลในตาราง
    tbody.innerHTML = "";

    reports.forEach(report => {

      const row = document.createElement("tr");

      row.innerHTML = `
        <td>${formatDate(report.report_date || report.created_at)}</td>
        <td>${shopsMap[report.shop_id] || "-"}</td>
        <td>${productsMap[report.product_id] || "-"}</td>
        <td>${(report.quantity || 0).toLocaleString()}</td>
        <td>${report.status || "-"}</td>
        <td>
          <button onclick="viewReport('${report.id}')" class="btn-view">
            👁️ ดู
          </button>
          <button onclick="deleteReport('${report.id}')" class="btn-delete">
            🗑️ ลบ
          </button>
        </td>
      `;

      tbody.appendChild(row);
    });

    console.log(`✅ Displayed ${reports.length} reports`);

  } catch (error) {
    console.error("❌ loadReports error:", error);
  }
}


// =====================================================
// บันทึกข้อมูล
// =====================================================
async function saveReport() {

  console.log("💾 Saving report...");

  // 1️⃣ ดึงค่าจากฟอร์ม
  const reportDate = document.getElementById("reportDate")?.value;
  const shopId = document.getElementById("shopSelect")?.value;
  const productId = document.getElementById("productSelect")?.value;
  const source = document.getElementById("source")?.value;
  const status = document.getElementById("status")?.value;
  const amount = document.getElementById("amount")?.value;
  const followupDate = document.getElementById("followupDate")?.value;
  const note = document.getElementById("note")?.value;

  console.log("📝 Form data:", {
    reportDate, shopId, productId, source, status, amount, followupDate, note
  });

  // 2️⃣ Validate
  if (!reportDate) {
    alert("⚠️ กรุณาเลือกวันที่");
    return;
  }

  if (!shopId) {
    alert("⚠️ กรุณาเลือกร้านค้า");
    return;
  }

  if (!productId) {
    alert("⚠️ กรุณาเลือกสินค้า");
    return;
  }

  // 3️⃣ ดึง user
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) {
    alert("❌ กรุณาเข้าสู่ระบบ");
    return;
  }

  // 4️⃣ เก็บ dynamic attributes
  const dynamicAttrs = collectDynamicAttributes();

  // 5️⃣ บันทึกลง Supabase
  const reportData = {
    report_date: reportDate,
    shop_id: shopId,
    product_id: productId,
    source: source,
    status: status,
    quantity: amount ? parseFloat(amount) : 0,
    followup_date: followupDate || null,
    note: note,
    sale_id: user.id,
    attributes: dynamicAttrs
  };

  console.log("📤 Saving data:", reportData);

  const { data, error } = await supabaseClient
    .from("reports")
    .insert([reportData])
    .select();

  if (error) {
    console.error("❌ Save error:", error);
    alert("❌ บันทึกไม่สำเร็จ: " + error.message);
    return;
  }

  console.log("✅ Saved successfully:", data);
  alert("✅ บันทึกสำเร็จ");
  clearForm();
  loadReports();
}


// =====================================================
// ดูรายละเอียดรายงาน (Manual Join)
// =====================================================
async function viewReport(id) {
  
  console.log("👁️ Viewing report:", id);

  // ดึงข้อมูล report
  const { data: report, error } = await supabaseClient
    .from("reports")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("❌ View error:", error);
    alert("เกิดข้อผิดพลาด: " + error.message);
    return;
  }

  // ดึงข้อมูลร้านค้า
  let shopName = "-";
  if (report.shop_id) {
    const { data: shop } = await supabaseClient
      .from("shops")
      .select("shop_name")
      .eq("id", report.shop_id)
      .single();
    shopName = shop?.shop_name || "-";
  }

  // ดึงข้อมูลสินค้า
  let productName = "-";
  if (report.product_id) {
    const { data: product } = await supabaseClient
      .from("products")
      .select("name")
      .eq("id", report.product_id)
      .single();
    productName = product?.name || "-";
  }

  // ดึงข้อมูลผู้บันทึก
  let userName = "-";
  if (report.sale_id) {
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("display_name")
      .eq("id", report.sale_id)
      .single();
    userName = profile?.display_name || "-";
  }

  // แสดงข้อมูล
  let details = `
📋 รายละเอียดรายงาน

วันที่: ${formatDate(report.report_date)}
ร้านค้า: ${shopName}
สินค้า: ${productName}
ยอดสั่งซื้อ: ${(report.quantity || 0).toLocaleString()} บาท
แหล่งที่มา: ${report.source || "-"}
สถานะ: ${report.status || "-"}
วันที่ติดตาม: ${report.followup_date ? formatDate(report.followup_date) : "-"}
ผู้บันทึก: ${userName}
หมายเหตุ: ${report.note || "-"}
  `;

  if (report.attributes && Object.keys(report.attributes).length > 0) {
    details += "\n\nข้อมูลเพิ่มเติม:\n";
    for (let [key, value] of Object.entries(report.attributes)) {
      details += `- ${key}: ${value}\n`;
    }
  }

  alert(details);
}


// =====================================================
// ลบข้อมูล
// =====================================================
async function deleteReport(id) {

  if (!confirm("⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบรายงานนี้?")) return;

  console.log("🗑️ Deleting report:", id);

  const { error } = await supabaseClient
    .from("reports")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("❌ Delete error:", error);
    alert("❌ ลบไม่สำเร็จ: " + error.message);
    return;
  }

  console.log("✅ Deleted successfully");
  alert("✅ ลบสำเร็จ");
  loadReports();
}


// =====================================================
// Utilities
// =====================================================
function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function clearForm() {
  const dateInput = document.getElementById("reportDate");
  if (dateInput) dateInput.valueAsDate = new Date();
  
  document.getElementById("shopSelect").value = "";
  document.getElementById("categorySelect").value = "";
  document.getElementById("productSelect").value = "";
  document.getElementById("source").value = "Walk-in";
  document.getElementById("status").value = "เยี่ยมแล้ว";
  document.getElementById("amount").value = "";
  document.getElementById("followupDate").value = "";
  document.getElementById("note").value = "";
  clearDynamicAttributes();
  
  console.log("🧹 Form cleared");
}

function clearDynamicAttributes() {
  const container = document.getElementById("dynamicAttributes");
  if (container) {
    container.innerHTML = "";
  }
}