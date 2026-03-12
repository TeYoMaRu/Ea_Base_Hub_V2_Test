// ============================================================
// admin-users.js
// จัดการผู้ใช้งาน — pattern เดียวกับ admin-sales.js
// ============================================================

// ── ตัวแปร global ──────────────────────────────────────────
let allUsersData = [];
let deleteTargetId = null;

// ── protectAdmin ────────────────────────────────────────────
async function protectAdmin() {
  await protectPage(["admin"]);
  if (typeof initUserService === "function") await initUserService();
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);
}

function goHome() { window.location.href = "/pages/admin/admintor.html"; }

// ── loadUsers — โหลดผู้ใช้ทั้งหมด ──────────────────────────
async function loadUsers() {
  const tbody = document.getElementById("userTable");
  tbody.innerHTML = `<tr><td colspan="6" class="state-cell">⏳ กำลังโหลด...</td></tr>`;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, email, username, display_name, role, status, area, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("loadUsers error:", error);
    tbody.innerHTML = `<tr><td colspan="6" class="state-cell" style="color:#ef4444">❌ โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    return;
  }

  allUsersData = data || [];
  updateStats(allUsersData);
  renderUsers(allUsersData);
}

// ── updateStats — อัปเดต chips สถิติ ───────────────────────
function updateStats(data) {
  document.getElementById("countAll").textContent      = data.length;
  document.getElementById("countAdmin").textContent    = data.filter(u => u.role === "admin").length;
  document.getElementById("countManager").textContent  = data.filter(u => u.role === "manager").length;
  document.getElementById("countSales").textContent    = data.filter(u => u.role === "sales").length;
  document.getElementById("countUser").textContent     = data.filter(u => u.role === "user").length;
  document.getElementById("countInactive").textContent = data.filter(u => (u.status || "").toLowerCase() !== "active").length;
}

// ── renderUsers — วาดตาราง ──────────────────────────────────
function renderUsers(data) {
  const tbody = document.getElementById("userTable");
  tbody.innerHTML = "";

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="state-cell">ไม่พบผู้ใช้งาน</td></tr>`;
    return;
  }

  data.forEach((user, i) => {
    const tr = document.createElement("tr");
    tr.className = "fade-row";
    tr.style.animationDelay = `${i * 0.03}s`;
    tr.dataset.id = user.id;

    const isActive = (user.status || "").toLowerCase() === "active";

    tr.innerHTML = `
      <td><span class="email-text">${escapeHtml(user.email || "-")}</span></td>

      <td><span class="username-chip">${escapeHtml(user.username || "-")}</span></td>

      <td><span class="display-name">${escapeHtml(user.display_name || "-")}</span></td>

      <td>${roleBadge(user.role)}</td>

      <td>
        <span class="status-badge ${isActive ? "status-active" : "status-inactive"}">
          ${isActive ? "✅ Active" : "🚫 Inactive"}
        </span>
      </td>

      <td>
        <div class="action-group">
          <button class="btn-icon btn-edit"
                  onclick="openEditModal('${user.id}')">
            <span class="material-symbols-outlined">edit</span>แก้ไข
          </button>

          <button class="btn-icon ${isActive ? "btn-toggle-inactive" : "btn-toggle-active"}"
                  onclick="toggleStatus('${user.id}', '${isActive ? "Inactive" : "Active"}')">
            <span class="material-symbols-outlined">${isActive ? "block" : "check_circle"}</span>
            ${isActive ? "ระงับ" : "เปิดใช้"}
          </button>

          <button class="btn-icon btn-del"
                  onclick="openDeleteModal('${user.id}', '${escapeAttr(user.email || user.username || "")}')">
            <span class="material-symbols-outlined">delete</span>ลบ
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ── roleBadge — สร้าง HTML badge ตาม role ──────────────────
function roleBadge(role) {
  const map = {
    admin:   { cls: "role-admin",   icon: "shield",              label: "Admin"   },
    manager: { cls: "role-manager", icon: "supervisor_account",  label: "Manager" },
    sales:   { cls: "role-sales",   icon: "badge",               label: "Sales"   },
    user:    { cls: "role-user",    icon: "person",              label: "User"    },
  };
  const r = map[role] || { cls: "role-user", icon: "person", label: role || "?" };
  return `<span class="role-badge ${r.cls}">
    <span class="material-symbols-outlined">${r.icon}</span>${r.label}
  </span>`;
}

// ── filterUsers — กรองจาก search + dropdown ────────────────
function filterUsers() {
  const keyword    = document.getElementById("searchUser").value.trim().toLowerCase();
  const roleFilter = document.getElementById("filterRole").value;
  const stFilter   = document.getElementById("filterStatus").value;

  const filtered = allUsersData.filter(u => {
    const matchText = !keyword ||
      (u.email        || "").toLowerCase().includes(keyword) ||
      (u.username     || "").toLowerCase().includes(keyword) ||
      (u.display_name || "").toLowerCase().includes(keyword);

    const matchRole   = !roleFilter || u.role === roleFilter;
    const matchStatus = !stFilter   || (u.status || "") === stFilter;

    return matchText && matchRole && matchStatus;
  });

  renderUsers(filtered);
}

// ── toggleStatus — สลับ Active / Inactive ทันที ────────────
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

  // อัปเดต local data แล้ว re-render
  const user = allUsersData.find(u => u.id === userId);
  if (user) user.status = newStatus;

  updateStats(allUsersData);
  filterUsers(); // re-render ตามที่ filter อยู่
}

// ── Edit Modal ──────────────────────────────────────────────
function openEditModal(userId) {
  const user = allUsersData.find(u => u.id === userId);
  if (!user) return;

  document.getElementById("editUserId").value      = user.id;
  document.getElementById("editUsername").value    = user.username    || "";
  document.getElementById("editDisplayName").value = user.display_name || "";
  document.getElementById("editRole").value        = user.role        || "user";
  document.getElementById("editStatus").value      = user.status      || "Active";
  document.getElementById("editArea").value        = user.area        || "";

  // แสดง email ใน info strip
  document.getElementById("modalUserInfo").innerHTML = `
    <span class="material-symbols-outlined">account_circle</span>
    <div>
      <div style="font-weight:600;color:#1e293b">${escapeHtml(user.display_name || user.username || "-")}</div>
      <div>${escapeHtml(user.email || "-")}</div>
    </div>`;

  document.getElementById("editModal").style.display = "flex";
}

function closeEditModal() {
  document.getElementById("editModal").style.display = "none";
}

// ── saveUser — บันทึกการแก้ไข ───────────────────────────────
async function saveUser() {
  const id          = document.getElementById("editUserId").value;
  const username    = document.getElementById("editUsername").value.trim();
  const displayName = document.getElementById("editDisplayName").value.trim();
  const role        = document.getElementById("editRole").value;
  const status      = document.getElementById("editStatus").value;
  const area        = document.getElementById("editArea").value.trim();

  const btn = document.getElementById("saveBtn");
  btn.disabled = true;

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      username:     username     || null,
      display_name: displayName  || null,
      role,
      status,
      area:         area         || null,
    })
    .eq("id", id);

  btn.disabled = false;

  if (error) {
    alert("บันทึกไม่สำเร็จ");
    console.error(error);
    return;
  }

  // อัปเดต local data
  const user = allUsersData.find(u => u.id === id);
  if (user) {
    user.username     = username     || null;
    user.display_name = displayName  || null;
    user.role         = role;
    user.status       = status;
    user.area         = area         || null;
  }

  closeEditModal();
  updateStats(allUsersData);
  filterUsers();
}

// ── Delete Modal ────────────────────────────────────────────
function openDeleteModal(userId, label) {
  deleteTargetId = userId;
  document.getElementById("deleteUserLabel").textContent = label;
  document.getElementById("deleteModal").style.display = "flex";
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById("deleteModal").style.display = "none";
}

async function confirmDelete() {
  if (!deleteTargetId) return;

  const { error } = await supabaseClient
    .from("profiles")
    .delete()
    .eq("id", deleteTargetId);

  if (error) {
    alert("ลบไม่สำเร็จ");
    console.error(error);
    return;
  }

  // ลบออกจาก local
  allUsersData = allUsersData.filter(u => u.id !== deleteTargetId);
  closeDeleteModal();
  updateStats(allUsersData);
  filterUsers();
}

// ── ปิด modal เมื่อกดนอก ────────────────────────────────────
document.addEventListener("click", (e) => {
  if (e.target.id === "editModal")   closeEditModal();
  if (e.target.id === "deleteModal") closeDeleteModal();
});

// ── escape helpers ──────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeAttr(str) {
  return String(str).replace(/'/g, "\\'").replace(/"/g, "&quot;");
}

// ── เริ่มต้น ────────────────────────────────────────────────
window.addEventListener("load", async () => {
  await protectAdmin();
  await loadUsers();
});