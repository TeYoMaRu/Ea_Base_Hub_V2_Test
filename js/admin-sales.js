async function loadSales() {

  const table = document.getElementById("salesTable");
  table.innerHTML = `<tr><td colspan="5">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, display_name, username")
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
      <td>-</td>
      <td>${count || 0}</td>
      <td>
        <a href="admin-shops.html?sale=${sale.id}">
          จัดการร้านค้า
        </a>
      </td>
    `;

    table.appendChild(tr);
  }
}

window.addEventListener("load", async () => {
  await protectAdmin();
  await loadSales();
});
