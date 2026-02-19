async function loadSales() {
  const table = document.getElementById("salesTable");
  table.innerHTML = `<tr><td colspan="5">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, username, area")
    .eq("role", "sales")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    table.innerHTML = `<tr><td colspan="5">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    return;
  }

  table.innerHTML = "";

  for (const sale of data) {
    const { count } = await supabaseClient
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("sale_id", sale.id);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${sale.username}</td>
      <td>${sale.display_name || "-"}</td>

    <td>
  <span class="badge badge-area">
    ${sale.area || "ยังไม่ระบุ"}
  </span>
</td>

<td>
  <span class="badge badge-count">
    ${count || 0} ร้าน
  </span>
</td>

<td>
  <span class="badge badge-action"
        onclick="goManage('${sale.id}')">
    จัดการร้านค้า
  </span>
</td>

    `;

    table.appendChild(tr);
  }
}

window.addEventListener("load", async () => {
  await protectAdmin();
  await loadSales();
});

function editArea(element, saleId) {
  const currentValue = element.innerText === "-" ? "" : element.innerText;

  element.innerHTML = `
    <input type="text"
           class="area-input"
           value="${currentValue}"
           onblur="saveArea(this, '${saleId}')"
           onkeydown="if(event.key==='Enter') this.blur()"
           autofocus>
  `;
}

async function saveArea(input, saleId) {
  const newValue = input.value.trim();

  const { error } = await supabaseClient
    .from("profiles")
    .update({ area: newValue })
    .eq("id", saleId);

  if (error) {
    alert("บันทึกไม่สำเร็จ");
    console.error(error);
    return;
  }

  input.parentElement.innerHTML = `
    <span class="area-text"
          onclick="editArea(this, '${saleId}')">
          ${newValue || "-"}
    </span>
  `;
}

function goManage(id) {
  window.location.href = `admin-shops.html?sale=${id}`;
}
