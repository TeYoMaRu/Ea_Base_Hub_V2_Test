// =====================================================
// reports.ui.js
// จัดการ DOM และการแสดงผล (UI Layer)
// =====================================================

// =====================================================
// INIT PAGE
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {

       await protectPage(["admin", "sales", "manager", "user"]);

  // โหลด dropdown / data ต่าง ๆ ก่อน
  await loadReportsUI();


  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get("id");
  // if (reportId) {
  //   const { data, error } = await supabaseClient
  //     .from("reports")
  //     .select("*")
  //     .eq("id", reportId)
  //     .single();

  //   if (data) {
  //     document.getElementById("note").value = data.note || "";
  //     document.getElementById("quantity").value = data.quantity || 0;

  //     // ถ้ามี field อื่น ก็ใส่เพิ่มตรงนี้
  //   }
  // }

  if (reportId) {
    const data = await getReportById(reportId);

    if (data) {
      //     document.getElementById("note").value = data.note || "";
      //     document.getElementById("quantity").value = data.quantity || 0;
      document.getElementById("reportDate").value = data.report_date || "";

      // รอ 1 tick ให้ dropdown render เสร็จ
      setTimeout(() => {
      document.getElementById("shopSelect").value = data.shop_id || "";
        document.getElementById("productSelect").value = data.product_id || "";
        document.getElementById("status").value = data.status || "";
        document.getElementById("source").value = data.source || "";
        document.getElementById("amount").value = data.amount || "";
        document.getElementById("followupDate").value = data.followup_date || "";
        document.getElementById("note").value = data.note || "";
      }, 0);

    }
  }


  await protectPage(["admin", "sales", "manager", "user"]);
  await loadReportsUI();
});

// =====================================================
// โหลดตารางรายงาน
// =====================================================
async function loadReportsUI() {
  const tbody = document.getElementById("reportBody");
  if (!tbody) return;

  tbody.innerHTML = "<tr><td colspan='6'>กำลังโหลด...</td></tr>";

  try {
    // 1️⃣ ดึงข้อมูลรายงานจาก service
    const reports = await fetchReports();

    if (!reports.length) {
      tbody.innerHTML = "<tr><td colspan='6'>ยังไม่มีข้อมูล</td></tr>";
      return;
    }

    // 2️⃣ เตรียม id สำหรับ join
    const shopIds = [...new Set(reports.map((r) => r.shop_id).filter(Boolean))];
    const productIds = [
      ...new Set(reports.map((r) => r.product_id).filter(Boolean)),
    ];

    const shops = await fetchShopsByIds(shopIds);
    const products = await fetchProductsByIds(productIds);

    const shopsMap = Object.fromEntries(shops.map((s) => [s.id, s.shop_name]));
    const productsMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

    tbody.innerHTML = "";

    // 3️⃣ Render ตาราง
    for (const report of reports) {
      let specText = "";

      if (report.attributes && Object.keys(report.attributes).length > 0) {
        const attributeIds = Object.keys(report.attributes);
        const attrData = await fetchAttributesByIds(attributeIds);

        const attrMap = Object.fromEntries(attrData.map((a) => [a.id, a.name]));

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
        <td class="detail-text" title="${report.note || "-"}">
            ${report.note || "-"}
            </td> 
        <td>
          ${productsMap[report.product_id] || "-"}
          ${specText}
        </td>
        
        <td class="action-buttons">
  <button class="btn-view" onclick="handleView('${report.id}')">👁️</button>
  <button class="btn-edit" onclick="handleEdit('${report.id}')">✏️</button>
  <button class="btn-delete" onclick="handleDelete('${report.id}')">🗑️</button>
</td>
      `;

      tbody.appendChild(row);
    }
  } catch (error) {
    console.error("❌ loadReportsUI error:", error);
  }
}

// =====================================================
// DELETE HANDLER
// =====================================================
async function handleDelete(id) {
  if (!confirm("ลบรายการนี้หรือไม่?")) return;

  await removeReport(id);
  loadReportsUI();
}

function handleEdit(id) {
  window.location.href = `report.html?id=${id}`;
}

// =====================================================
// FORMAT DATE
// =====================================================
function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("th-TH");
}

// =====================================================
// SAVE REPORT (Create / Update)
// =====================================================
async function saveReport() {
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get("id");

  const payload = {
    report_date: document.getElementById("reportDate").value,
    shop_id: document.getElementById("shopSelect").value,
    product_id: document.getElementById("productSelect").value,
    status: document.getElementById("status").value,
    source: document.getElementById("source").value,
    amount: document.getElementById("amount").value,
    followup_date: document.getElementById("followupDate").value,
    note: document.getElementById("note").value,
  };

  try {
    if (reportId) {
      await updateReport(reportId, payload);
      alert("✅ แก้ไขสำเร็จ");
    } else {
      await insertReport(payload);
      alert("✅ บันทึกสำเร็จ");
    }

    window.location.href = "report.html";
  } catch (error) {
    console.error("❌ saveReport error:", error);
    alert("เกิดข้อผิดพลาด");
  }
}

// =====================================================
// SUBMIT FORM (Create / Update)
// =====================================================
const reportForm = document.getElementById("reportForm");

if (reportForm) {
  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const urlParams = new URLSearchParams(window.location.search);
    const reportId = urlParams.get("id");

    const noteValue = document.getElementById("note").value;
    const qtyValue = document.getElementById("quantity").value;

    const payload = {
      note: noteValue,
      quantity: qtyValue,
    };

    try {
      if (reportId) {
        await updateReport(reportId, payload);
        alert("✅ แก้ไขสำเร็จ");
      } else {
        await insertReport(payload);
        alert("✅ บันทึกสำเร็จ");
      }

      window.location.href = "reports.html";
    } catch (error) {
      console.error("❌ save error:", error);
      alert("เกิดข้อผิดพลาด");
    }
  });
}
