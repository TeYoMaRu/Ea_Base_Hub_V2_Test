// ============================================================
// admin-users.js
// หน้า Admin สำหรับจัดการผู้ใช้งาน
// pattern โค้ดเหมือนกับ admin-sales.js
//
// หน้าที่หลักของไฟล์นี้
// - โหลดข้อมูลผู้ใช้จาก Supabase
// - แสดงตารางผู้ใช้
// - filter / search
// - แก้ไขผู้ใช้
// - เปลี่ยนสถานะ Active / Inactive
// - ลบผู้ใช้
// ============================================================



// ============================================================
// GLOBAL VARIABLES
// ตัวแปรที่ใช้ทั้งไฟล์
// ============================================================

// เก็บข้อมูล user ทั้งหมดที่โหลดจาก database
let allUsersData = [];

// เก็บ id ของ user ที่กำลังจะลบ
let deleteTargetId = null;



// ============================================================
// protectAdmin()
// ตรวจสอบสิทธิ์ว่า user ที่เข้าหน้านี้เป็น admin หรือไม่
// ============================================================

async function protectAdmin() {

  // เรียก function จาก auth.js
  // ตรวจสอบ role ของ user
  await protectPage(["admin"]);

  // init service สำหรับ user
  if (typeof initUserService === "function")
    await initUserService();

  // ปุ่ม logout
  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn)
    logoutBtn.addEventListener("click", logout);
}



// ============================================================
// goHome()
// ปุ่มกลับหน้าหลัก
// ============================================================

function goHome() {

  window.location.href = "/pages/admin/admintor.html";

}



// ============================================================
// loadUsers()
// โหลดข้อมูลผู้ใช้จาก Supabase
// ============================================================

async function loadUsers() {

  const tbody = document.getElementById("userTable");

  // แสดง loading state
  tbody.innerHTML =
  `<tr>
     <td colspan="6" class="state-cell">
       ⏳ กำลังโหลด...
     </td>
   </tr>`;


  // query ตาราง profiles
  const { data, error } = await supabaseClient
    .from("profiles")
    .select(
      "id, email, username, display_name, role, status, area, created_at"
    )
    .order("created_at", { ascending: false });


  // ถ้าเกิด error
  if (error) {

    console.error("loadUsers error:", error);

    tbody.innerHTML =
    `<tr>
       <td colspan="6" class="state-cell" style="color:#ef4444">
         ❌ โหลดข้อมูลไม่สำเร็จ
       </td>
     </tr>`;

    return;
  }


  // เก็บข้อมูลไว้ใน global
  allUsersData = data || [];

  // อัปเดต stat chips
  updateStats(allUsersData);

  // render ตาราง
  renderUsers(allUsersData);

}



// ============================================================
// updateStats()
// อัปเดตตัวเลขใน stats bar
// ============================================================

function updateStats(data) {

  document.getElementById("countAll").textContent
    = data.length;

  document.getElementById("countAdmin").textContent
    = data.filter(u => u.role === "admin").length;

  document.getElementById("countManager").textContent
    = data.filter(u => u.role === "manager").length;

  document.getElementById("countSales").textContent
    = data.filter(u => u.role === "sales").length;

  document.getElementById("countUser").textContent
    = data.filter(u => u.role === "user").length;

  document.getElementById("countInactive").textContent
    = data.filter(
        u => (u.status || "").toLowerCase() !== "active"
      ).length;

}



// ============================================================
// renderUsers()
// สร้าง HTML ตารางผู้ใช้
// ============================================================

function renderUsers(data) {

  const tbody = document.getElementById("userTable");

  // reset ตาราง
  tbody.innerHTML = "";


  // ถ้าไม่มีข้อมูล
  if (data.length === 0) {

    tbody.innerHTML =
      `<tr>
         <td colspan="6" class="state-cell">
           ไม่พบผู้ใช้งาน
         </td>
       </tr>`;

    return;
  }


  // loop user
  data.forEach((user, i) => {

    const tr = document.createElement("tr");

    // animation row
    tr.className = "fade-row";
    tr.style.animationDelay = `${i * 0.03}s`;

    // เก็บ id
    tr.dataset.id = user.id;

    // ตรวจสอบสถานะ
    const isActive =
      (user.status || "").toLowerCase() === "active";


    // HTML row
    tr.innerHTML = `

      <!-- EMAIL -->
      <td>
        <span class="email-text">
          ${escapeHtml(user.email || "-")}
        </span>
      </td>


      <!-- USERNAME -->
      <td>
        <span class="username-chip">
          ${escapeHtml(user.username || "-")}
        </span>
      </td>


      <!-- DISPLAY NAME -->
      <td>
        <span class="display-name">
          ${escapeHtml(user.display_name || "-")}
        </span>
      </td>


      <!-- ROLE -->
      <td>
        ${roleBadge(user.role)}
      </td>


      <!-- STATUS -->
      <td>
        <span class="status-badge
          ${isActive ? "status-active" : "status-inactive"}">

          ${isActive ? "✅ Active" : "🚫 Inactive"}

        </span>
      </td>


      <!-- ACTION BUTTONS -->
      <td>

        <div class="action-group">

          <!-- EDIT -->
          <button class="btn-icon btn-edit"
                  onclick="openEditModal('${user.id}')">

            <span class="material-symbols-outlined">
              edit
            </span>

            แก้ไข

          </button>


          <!-- TOGGLE STATUS -->
          <button class="btn-icon
            ${isActive ? "btn-toggle-inactive" : "btn-toggle-active"}"

            onclick="toggleStatus(
              '${user.id}',
              '${isActive ? "Inactive" : "Active"}'
            )">

            <span class="material-symbols-outlined">
              ${isActive ? "block" : "check_circle"}
            </span>

            ${isActive ? "ระงับ" : "เปิดใช้"}

          </button>


          <!-- DELETE -->
          <button class="btn-icon btn-del"

            onclick="openDeleteModal(
              '${user.id}',
              '${escapeAttr(user.email || user.username || "")}'
            )">

            <span class="material-symbols-outlined">
              delete
            </span>

            ลบ

          </button>

        </div>

      </td>

    `;

    tbody.appendChild(tr);

  });

}



// ============================================================
// roleBadge()
// สร้าง badge สำหรับ role
// ============================================================

function roleBadge(role) {

  const map = {

    admin: {
      cls: "role-admin",
      icon: "shield",
      label: "Admin"
    },

    manager: {
      cls: "role-manager",
      icon: "supervisor_account",
      label: "Manager"
    },

    sales: {
      cls: "role-sales",
      icon: "badge",
      label: "Sales"
    },

    user: {
      cls: "role-user",
      icon: "person",
      label: "User"
    },

  };

  const r =
    map[role] ||
    { cls: "role-user", icon: "person", label: role || "?" };


  return `
    <span class="role-badge ${r.cls}">
      <span class="material-symbols-outlined">
        ${r.icon}
      </span>
      ${r.label}
    </span>
  `;
}



// ============================================================
// filterUsers()
// ค้นหา + filter role + filter status
// ============================================================

function filterUsers() {

  const keyword =
    document.getElementById("searchUser")
      .value.trim().toLowerCase();

  const roleFilter =
    document.getElementById("filterRole").value;

  const stFilter =
    document.getElementById("filterStatus").value;


  const filtered = allUsersData.filter(u => {

    // search
    const matchText =
      !keyword ||
      (u.email        || "").toLowerCase().includes(keyword) ||
      (u.username     || "").toLowerCase().includes(keyword) ||
      (u.display_name || "").toLowerCase().includes(keyword);

    // role
    const matchRole =
      !roleFilter || u.role === roleFilter;

    // status
    const matchStatus =
      !stFilter || (u.status || "") === stFilter;

    return matchText && matchRole && matchStatus;

  });

  renderUsers(filtered);

}



// ============================================================
// toggleStatus()
// เปลี่ยนสถานะ Active / Inactive
// ============================================================

async function toggleStatus(userId, newStatus) {

  const { error } = await supabaseClient
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", userId);

  if (error) {

    alert("เปลี่ยนสถานะไม่สำเร็จ");
    console.error(error);

    return;
  }


  // อัปเดต local data
  const user = allUsersData.find(u => u.id === userId);

  if (user)
    user.status = newStatus;

  updateStats(allUsersData);

  filterUsers();

}