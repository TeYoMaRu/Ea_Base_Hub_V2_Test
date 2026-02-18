// ===========================================
// โหลดข้อมูลผู้ใช้งานทั้งหมด
// ===========================================

async function loadUsers() {

  // ดึงข้อมูลจากตาราง profiles
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Load user error:", error);
    return;
  }

  const table = document.getElementById("userTable");
  table.innerHTML = ""; // ล้างข้อมูลเดิมก่อน

  // วนลูปสร้างแถวในตาราง
  data.forEach(user => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${user.email}</td>
      <td>${user.username}</td>
      <td>${user.display_name || "-"}</td>
      <td>${user.role}</td>
      <td>${user.status || "Active"}</td>
      <td>
        <a href="adminUserEdit.html?id=${user.id}">
          แก้ไข
        </a>
      </td>
    `;

    table.appendChild(tr);
  });
}


// ===========================================
// เรียกใช้งานทันทีเมื่อโหลดหน้าเว็บ
// ===========================================

(async () => {
  await protectAdmin();
  await loadUsers();
})();
