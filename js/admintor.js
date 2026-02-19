// ======================================
// โหลดผู้ใช้ทั้งหมด
// ======================================
async function loadUsers() {

  const table = document.getElementById("userTable");
  table.innerHTML = `<tr><td colspan="6">กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, username, display_name, role, status, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    table.innerHTML = `<tr><td colspan="6">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    return;
  }

  table.innerHTML = "";

  data.forEach(user => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.email}</td>
      <td>${user.username}</td>
      <td>${user.display_name || "-"}</td>
      <td>
  <span class="badge badge-role ${user.role}">
    ${user.role}
  </span>
</td>

<td>
  <span class="badge badge-status ${user.status}">
    ${user.status}
  </span>
</td>

<td>
  <span class="badge badge-edit"
        onclick="goEdit('${user.id}')">
    แก้ไข
  </span>
</td>

    `;

    table.appendChild(tr);
  });
}


function goEdit(id){
  window.location.href = `adminUserEdit.html?id=${id}`;
}



// ======================================
// เริ่มทำงานเมื่อหน้าโหลดเสร็จ
// ======================================
window.addEventListener("load", async () => {

  try {
    await protectAdmin();   // เช็คสิทธิ์ก่อน
    await loadUsers();      // แล้วค่อยโหลดข้อมูล
  } catch (err) {
    console.error(err);
  }

});
