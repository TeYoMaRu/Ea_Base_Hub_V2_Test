// =====================================================
// report.js
// หน้ารายงานเยี่ยมร้านค้า
// ใช้ร่วมกับ:
// - core/supabaseClient.js
// - core/auth.js
// =====================================================



// =====================================================
// เมื่อหน้าโหลดเสร็จ
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

  // 🔐 ป้องกันหน้า (อนุญาตเฉพาะ role ที่กำหนด)
  // ถ้าคุณอยากให้ทุก role เข้าได้หมด
  // ให้ใส่ role ทั้งหมดของระบบ
  await protectPage(["admin", "sales", "manager", "user"]);

  // โหลดข้อมูลผู้ใช้งาน
  await loadUserInfo();

  // โหลดข้อมูลรายงาน
  await loadReports();

   loadShops();
  loadCategories();

  document.getElementById("categorySelect")
    .addEventListener("change", (e) => {
      loadProducts(e.target.value);
    });

});



// =====================================================
// โหลดชื่อผู้ใช้จาก table profiles (display_name)
// =====================================================
async function loadUserInfo() {

  // ดึง session ปัจจุบัน
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) return;

  // ดึง display_name จาก profiles
  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("display_name")
    .eq("id", session.user.id)
    .single();

  if (error) {
    console.error("โหลด display_name ไม่สำเร็จ:", error);
    return;
  }

  const userNameElement = document.querySelector(".user-name");

  // ถ้ามี display_name ให้ใช้
  if (profile?.display_name) {
    userNameElement.textContent = profile.display_name;
  } 
  // fallback เผื่อไม่มีค่า
  else {
    userNameElement.textContent = session.user.email;
  }
}




// =====================================================
// โหลดข้อมูลรายงานจาก Supabase
// =====================================================
async function loadReports() {

  const tbody = document.getElementById("reportBody");

  // เคลียร์ตารางก่อน
  tbody.innerHTML = "";

  // ดึงข้อมูลจาก table reports
  const { data, error } = await supabaseClient
    .from("reports")
    .select(`
      id,
      created_at,
      quantity,
      note,
      product_variants (
        length,
        width,
        thickness,
        color,
        brand
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("โหลดรายงานไม่สำเร็จ:", error);
    return;
  }

  // ถ้าไม่มีข้อมูล
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">ยังไม่มีข้อมูล</td>
      </tr>
    `;
    return;
  }

  // วนลูปสร้างแถว
  data.forEach(report => {

    const variant = report.product_variants;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatDate(report.created_at)}</td>
      <td>-</td>
      <td>
        ${variant?.length || "-"} x
        ${variant?.width || "-"} x
        ${variant?.thickness || "-"} /
        ${variant?.color || "-"} /
        ${variant?.brand || "-"}
      </td>
      <td>${report.quantity || 0}</td>
      <td>-</td>
      <td>
        <button onclick="deleteReport('${report.id}')">
          ลบ
        </button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

// ==========================================
// โหลดร้านค้า
// ==========================================
async function loadShops() {

  const shopSelect = document.getElementById("shopSelect");

  const { data, error } = await supabaseClient
    .from("shops")
    .select("id, shop_name")
    .eq("status", "Active")
    .order("shop_name");

  if (error) {
    console.error("โหลดร้านค้าไม่สำเร็จ:", error);
    return;
  }

  shopSelect.innerHTML = `<option value="">-- เลือกร้านค้า --</option>`;

  data.forEach(shop => {
    const option = document.createElement("option");
    option.value = shop.id;
    option.textContent = shop.shop_name;
    shopSelect.appendChild(option);
  });
}


// ==========================================
// โหลดหมวดสินค้า
// ==========================================
async function loadCategories() {

  const categorySelect = document.getElementById("categorySelect");

  const { data, error } = await supabaseClient
    .from("categories")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("โหลดหมวดไม่สำเร็จ:", error);
    return;
  }

  categorySelect.innerHTML = `<option value="">-- เลือกหมวด --</option>`;

  data.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.name;
    categorySelect.appendChild(option);
  });
}


// ==========================================
// โหลดสินค้าตามหมวด
// ==========================================
async function loadProducts(categoryId) {

  const productSelect = document.getElementById("productSelect");
  productSelect.innerHTML = `<option value="">-- เลือกสินค้า --</option>`;

  if (!categoryId) return;

  const { data, error } = await supabaseClient
    .from("products")
    .select("id, name")
    .eq("category_id", categoryId)
    .order("name");

  if (error) {
    console.error("โหลดสินค้าไม่สำเร็จ:", error);
    return;
  }

  data.forEach(product => {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    productSelect.appendChild(option);
  });
}


// =====================================================
// บันทึกรายงานใหม่
// =====================================================
async function saveReport() {

  // ดึงค่าจาก input
  const reportDate = document.getElementById("reportDate").value;
  const amount = document.getElementById("amount").value;
  const note = document.getElementById("note").value;

  // ดึง user ปัจจุบัน
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (!user) {
    alert("กรุณาเข้าสู่ระบบ");
    return;
  }

  // บันทึกลง table reports
  const { error } = await supabaseClient
    .from("reports")
    .insert([
      {
        quantity: amount || 0,
        note: note,
        sale_id: user.id
      }
    ]);

  if (error) {
    console.error("บันทึกไม่สำเร็จ:", error);
    alert("บันทึกไม่สำเร็จ");
    return;
  }

  alert("บันทึกสำเร็จ");

  // โหลดข้อมูลใหม่
  await loadReports();

  // เคลียร์ฟอร์ม
  clearForm();
}




// =====================================================
// ลบรายงาน
// =====================================================
async function deleteReport(id) {

  const confirmDelete = confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?");

  if (!confirmDelete) return;

  const { error } = await supabaseClient
    .from("reports")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("ลบไม่สำเร็จ:", error);
    alert("ลบไม่สำเร็จ");
    return;
  }

  // โหลดใหม่
  await loadReports();
}




// =====================================================
// ฟังก์ชันช่วยจัดรูปแบบวันที่
// =====================================================
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString("th-TH");
}




// =====================================================
// เคลียร์ฟอร์มหลังบันทึก
// =====================================================
function clearForm() {
  document.getElementById("reportDate").value = "";
  document.getElementById("amount").value = "";
  document.getElementById("note").value = "";
}


// ===============================
// โหลด Attributes ตามสินค้า
// ===============================

const productSelect = document.getElementById("productSelect");
const dynamicContainer = document.getElementById("dynamicAttributes");

productSelect.addEventListener("change", async () => {
  const productId = productSelect.value;
  dynamicContainer.innerHTML = "";

  if (!productId) return;

  // 1️⃣ ดึง category_id ของสินค้า
  const { data: product } = await supabaseClient
    .from("products")
    .select("category_id")
    .eq("id", productId)
    .single();

  if (!product) return;

  // 2️⃣ ดึง attributes ของหมวดนั้น
  const { data: attributes } = await supabaseClient
    .from("attributes")
    .select("*")
    .eq("category_id", product.category_id);

  if (!attributes) return;

  // 3️⃣ สร้าง input ตาม input_type
  for (let attr of attributes) {
    const wrapper = document.createElement("div");
    wrapper.classList.add("form-group");

    const label = document.createElement("label");
    label.innerText = attr.name;

    wrapper.appendChild(label);

    // ถ้าเป็น dropdown
    if (attr.input_type === "select") {
      const select = document.createElement("select");
      select.dataset.attributeId = attr.id;

      const { data: options } = await supabaseClient
        .from("attribute_options")
        .select("*")
        .eq("attribute_id", attr.id);

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "-- เลือก --";
      select.appendChild(defaultOption);

      if (options) {
        options.forEach(opt => {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.value;
          select.appendChild(option);
        });
      }

      wrapper.appendChild(select);

    } else {
      // text หรือ number
      const input = document.createElement("input");
      input.type = attr.input_type === "number" ? "number" : "text";
      input.dataset.attributeId = attr.id;

      wrapper.appendChild(input);
    }

    dynamicContainer.appendChild(wrapper);
  }
});