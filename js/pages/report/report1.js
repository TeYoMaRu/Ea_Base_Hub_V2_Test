// =====================================================
// report.js
// =====================================================

// 🌐 GLOBAL STATE
let reports = [];
let shopsMap = {};
let productsMap = {};
let currentEditId = null;


// =====================================================
// 🚀 INIT PAGE
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

  try {

    await protectPage(["admin","sales","manager","user"]);
    await initUserService();

    await initializePageData();

    setupEventListeners();
    setDefaultDate();

  } catch (error) {

    console.error("Page init error:", error);

  }

});


// =====================================================
// 📦 LOAD PAGE DATA
// =====================================================
async function initializePageData(){

  await loadShops();
  await loadCategories();
  await loadReports();

}


// =====================================================
// 🎯 EVENT LISTENERS
// =====================================================
function setupEventListeners(){

  const category = document.getElementById("categorySelect");
  const product = document.getElementById("productSelect");
  const saveBtn = document.getElementById("saveReportBtn");

  if(category){

    category.addEventListener("change", e => {

      loadProducts(e.target.value);
      clearDynamicAttributes();

    });

  }

  if(product){

    product.addEventListener("change", handleProductChange);

  }

  if(saveBtn){

    saveBtn.addEventListener("click", saveReport);

  }

}


// =====================================================
// 🏪 LOAD SHOPS
// =====================================================
async function loadShops(){

  const shopSelect = document.getElementById("shopSelect");

  if(!shopSelect) return;

  const {data,error} = await supabaseClient
    .from("shops")
    .select("id,shop_name")
    .eq("status","Active")
    .order("shop_name");

  if(error){

    console.error(error);
    return;

  }

  shopsMap = Object.fromEntries(data.map(s=>[s.id,s.shop_name]));

  shopSelect.innerHTML = `<option value="">-- เลือกร้านค้า --</option>`;

  data.forEach(shop=>{

    const option = document.createElement("option");

    option.value = shop.id;
    option.textContent = shop.shop_name;

    shopSelect.appendChild(option);

  });

}


// =====================================================
// 📂 LOAD CATEGORIES
// =====================================================
async function loadCategories(){

  const select = document.getElementById("categorySelect");
  if(!select) return;

  const {data,error} = await supabaseClient
    .from("categories")
    .select("id,name")
    .order("name");

  if(error){

    console.error(error);
    return;

  }

  select.innerHTML = `<option value="">-- เลือกหมวดสินค้า --</option>`;

  data.forEach(cat=>{

    const option = document.createElement("option");

    option.value = cat.id;
    option.textContent = cat.name;

    select.appendChild(option);

  });

}


// =====================================================
// 🛍️ LOAD PRODUCTS
// =====================================================
async function loadProducts(categoryId){

  const select = document.getElementById("productSelect");

  if(!select) return;

  select.innerHTML = `<option value="">-- เลือกสินค้า --</option>`;

  if(!categoryId) return;

  const {data,error} = await supabaseClient
    .from("products")
    .select("id,name")
    .eq("category_id",categoryId)
    .order("name");

  if(error){

    console.error(error);
    return;

  }

  data.forEach(p=>{

    productsMap[p.id] = p.name;

    const option = document.createElement("option");

    option.value = p.id;
    option.textContent = p.name;

    select.appendChild(option);

  });

}


// =====================================================
// 🧩 HANDLE PRODUCT CHANGE
// =====================================================
async function handleProductChange(){

  const productId = this.value;

  const container = document.getElementById("dynamicAttributes");

  if(!container) return;

  container.innerHTML = "";

  if(!productId) return;

  try{

    const {data:product} = await supabaseClient
      .from("products")
      .select("category_id")
      .eq("id",productId)
      .single();

    if(!product) return;

    const {data:attributes} = await supabaseClient
      .from("attributes")
      .select("*")
      .eq("category_id",product.category_id)
      .order("order_no");

    attributes?.forEach(attr=>{

      const wrapper = document.createElement("div");
      wrapper.classList.add("form-group");

      const label = document.createElement("label");
      label.textContent = attr.name;

      const input = document.createElement("input");

      input.type = attr.input_type === "number" ? "number" : "text";
      input.dataset.attributeId = attr.id;
      input.classList.add("dynamic-field");

      wrapper.appendChild(label);
      wrapper.appendChild(input);

      container.appendChild(wrapper);

    });

  }catch(err){

    console.error(err);

  }

}


// =====================================================
// 📊 LOAD REPORTS
// =====================================================
async function loadReports(){

  const tbody = document.getElementById("reportBody");

  if(!tbody) return;

  tbody.innerHTML = "<tr><td colspan='5'>กำลังโหลด...</td></tr>";

  const {data,error} = await supabaseClient
    .from("reports")
    .select("*")
    .order("created_at",{ascending:false});

  if(error){

    console.error(error);
    return;

  }

  reports = data || [];

  renderReports();

}


// =====================================================
// 🎨 RENDER TABLE
// =====================================================
function renderReports(){

  const tbody = document.getElementById("reportBody");

  if(!tbody) return;

  tbody.innerHTML = "";

  reports.forEach(report=>{

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${formatDate(report.report_date || report.created_at)}</td>
      <td>${shopsMap[report.shop_id] || "-"}</td>
      <td>${report.status || "-"}</td>
      <td>${escapeHtml(report.note || "-")}</td>
      <td>
        <button onclick="handleDelete('${report.id}')">🗑️</button>
      </td>
    `;

    tbody.appendChild(row);

  });

}


// =====================================================
// 💾 SAVE REPORT
// =====================================================
async function saveReport(){

  const reportDate = document.getElementById("reportDate")?.value;
  const shopId = document.getElementById("shopSelect")?.value;
  const productId = document.getElementById("productSelect")?.value;
  const status = document.getElementById("status")?.value;
  const quantity = parseFloat(document.getElementById("amount")?.value||0);

  if(!reportDate || !shopId || !productId || !status || quantity<=0){

    alert("❌ กรุณากรอกข้อมูลให้ครบ");
    return;

  }

  const userId = getUserData("id");

  const reportData = {

    report_date: reportDate,
    shop_id: shopId,
    product_id: productId,
    status,
    quantity,
    note: document.getElementById("note")?.value || null,
    sale_id: userId,
    created_at: new Date().toISOString()

  };

  const {error} = await supabaseClient
    .from("reports")
    .insert([reportData]);

  if(error){

    console.error(error);
    alert("❌ บันทึกไม่สำเร็จ");
    return;

  }

  alert("✅ บันทึกสำเร็จ");

  clearForm();
  loadReports();

}


// =====================================================
// 🗑️ DELETE REPORT
// =====================================================
async function handleDelete(id){

  if(!confirm("ต้องการลบใช่หรือไม่")) return;

  const {error} = await supabaseClient
    .from("reports")
    .delete()
    .eq("id",id);

  if(error){

    console.error(error);
    alert("❌ ลบไม่สำเร็จ");
    return;

  }

  reports = reports.filter(r=>r.id!==id);

  renderReports();

}


// =====================================================
// 📅 DEFAULT DATE
// =====================================================
function setDefaultDate(){

  const input = document.getElementById("reportDate");

  if(input){

    input.valueAsDate = new Date();

  }

}


// =====================================================
// 🧹 CLEAR FORM
// =====================================================
function clearForm(){

  document.getElementById("reportDate").valueAsDate = new Date();
  document.getElementById("shopSelect").value="";
  document.getElementById("categorySelect").value="";
  document.getElementById("productSelect").value="";
  document.getElementById("status").value="";
  document.getElementById("amount").value="";
  document.getElementById("note").value="";

}


// =====================================================
// 🛠️ HELPERS
// =====================================================
function formatDate(date){

  if(!date) return "-";

  return new Date(date).toLocaleDateString("th-TH",{
    year:"numeric",
    month:"long",
    day:"numeric"
  });

}


function escapeHtml(text){

  const div = document.createElement("div");
  div.textContent = text;

  return div.innerHTML;

}