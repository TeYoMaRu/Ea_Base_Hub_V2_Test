// =====================================================
// userService.js
// บริการจัดการข้อมูล User แบบรวมศูนย์
// ใช้ร่วมกันได้ทุกหน้า
// =====================================================

// =====================================================
// 🌐 GLOBAL USER DATA
// =====================================================
window.currentUser = {
  id: null,
  email: null,
  full_name: null,
  display_name: null,
  zone: null,
  position: null,
  department: null,
  phone: null,
  role: null,
  created_at: null,
  updated_at: null
};

// =====================================================
// 📥 LOAD USER DATA
// =====================================================
async function loadCurrentUser() {
  try {
    console.log("🔄 Loading user data...");

    // 1️⃣ ดึง session ปัจจุบัน
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
    
    if (sessionError) {
      console.error("❌ Session error:", sessionError);
      return null;
    }

    if (!session) {
      console.error("❌ No active session");
      return null;
    }

    // 2️⃣ ดึงข้อมูล User จาก profiles table
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileError) {
      console.error("❌ Profile error:", profileError);
      return null;
    }

    // 3️⃣ เก็บข้อมูลใน global variable
    window.currentUser = {
      id: session.user.id,
      email: session.user.email,
      full_name: profile?.full_name || null,
      display_name: profile?.display_name || profile?.full_name || session.user.email,
      zone: profile?.zone || null,
      position: profile?.position || null,
      department: profile?.department || null,
      phone: profile?.phone || null,
      role: profile?.role || "user",
      created_at: profile?.created_at || null,
      updated_at: profile?.updated_at || null,
      // เพิ่มฟิลด์อื่นๆ ตามที่มีใน profiles table
      address: profile?.address || null,
      manager_id: profile?.manager_id || null,
      status: profile?.status || "active"
    };

    console.log("✅ User data loaded:", window.currentUser);
    return window.currentUser;

  } catch (error) {
    console.error("❌ loadCurrentUser error:", error);
    return null;
  }
}

// =====================================================
// 🔄 AUTO-FILL USER DATA TO FORM
// =====================================================
function autoFillUserData(config = {}) {
  /**
   * Auto-fill ข้อมูล User ลงในฟอร์ม
   * 
   * config = {
   *   full_name: "empName",        // element ID สำหรับชื่อเต็ม
   *   display_name: "userName",    // element ID สำหรับชื่อแสดง
   *   zone: "zone",                // element ID สำหรับเขต
   *   position: "position",        // element ID สำหรับตำแหน่ง
   *   department: "dept",          // element ID สำหรับแผนก
   *   phone: "phone",              // element ID สำหรับเบอร์โทร
   *   email: "email",              // element ID สำหรับอีเมล
   *   readonly: ["full_name", "email"] // ฟิลด์ที่ต้องการให้ readonly
   * }
   */

  if (!window.currentUser || !window.currentUser.id) {
    console.warn("⚠️ User data not loaded yet");
    return;
  }

  const user = window.currentUser;
  const readonlyFields = config.readonly || [];

  // Mapping ระหว่าง user field กับ element ID
  const fieldMappings = {
    full_name: config.full_name,
    display_name: config.display_name,
    zone: config.zone,
    position: config.position,
    department: config.department,
    phone: config.phone,
    email: config.email,
    address: config.address
  };

  // วนลูปเติมข้อมูล
  Object.keys(fieldMappings).forEach(userField => {
    const elementId = fieldMappings[userField];
    
    if (elementId) {
      const element = document.getElementById(elementId);
      
      if (element && user[userField]) {
        element.value = user[userField];

        // ตั้งค่า readonly ถ้าระบุไว้
        if (readonlyFields.includes(userField)) {
          element.readOnly = true;
          element.style.background = "#f1f5f9";
          element.style.color = "#64748b";
          element.style.cursor = "not-allowed";
        }
      }
    }
  });

  console.log("✅ Auto-filled user data to form");
}

// =====================================================
// 👤 UPDATE USER NAME IN HEADER
// =====================================================
function updateUserNameDisplay(selector = ".user-name") {
  if (!window.currentUser || !window.currentUser.id) {
    return;
  }

  const userNameElements = document.querySelectorAll(selector);
  
  userNameElements.forEach(element => {
    element.textContent = window.currentUser.display_name;
  });

  console.log("✅ User name updated in header");
}

// =====================================================
// 📋 GET USER DATA
// =====================================================
function getUserData(field = null) {
  /**
   * ดึงข้อมูล User
   * 
   * @param {string} field - ชื่อฟิลด์ที่ต้องการ (ถ้าไม่ระบุจะ return ทั้งหมด)
   * @returns {any} - ข้อมูลที่ต้องการ
   * 
   * ตัวอย่าง:
   * getUserData("full_name")  → "สมชาย ใจดี"
   * getUserData("zone")       → "กรุงเทพฯ"
   * getUserData()             → { id: "...", full_name: "...", ... }
   */

  if (!window.currentUser || !window.currentUser.id) {
    console.warn("⚠️ User data not available");
    return null;
  }

  if (field) {
    return window.currentUser[field];
  }

  return window.currentUser;
}

// =====================================================
// 🔐 CHECK USER PERMISSION
// =====================================================
function checkUserPermission(allowedRoles = []) {
  /**
   * ตรวจสอบสิทธิ์ของ User
   * 
   * @param {array} allowedRoles - roles ที่อนุญาต เช่น ["admin", "manager"]
   * @returns {boolean} - true ถ้ามีสิทธิ์
   */

  if (!window.currentUser || !window.currentUser.id) {
    return false;
  }

  if (allowedRoles.length === 0) {
    return true; // ถ้าไม่ระบุ role = อนุญาตทุกคน
  }

  return allowedRoles.includes(window.currentUser.role);
}

// =====================================================
// 🎨 SHOW/HIDE ELEMENTS BY PERMISSION
// =====================================================
function applyPermissionBasedUI() {
  /**
   * แสดง/ซ่อน elements ตาม role ของ user
   * 
   * ใช้ data-require-role attribute ใน HTML:
   * <button data-require-role="admin,manager">ปุ่มสำหรับ Admin/Manager</button>
   * <div data-require-role="admin">เฉพาะ Admin</div>
   */

  const elementsWithRole = document.querySelectorAll("[data-require-role]");

  elementsWithRole.forEach(element => {
    const requiredRoles = element.dataset.requireRole.split(",").map(r => r.trim());
    const hasPermission = checkUserPermission(requiredRoles);

    if (!hasPermission) {
      element.style.display = "none";
    }
  });

  console.log("✅ Permission-based UI applied");
}

// =====================================================
// 🔄 REFRESH USER DATA
// =====================================================
async function refreshUserData() {
  /**
   * โหลดข้อมูล User ใหม่
   * ใช้เมื่อมีการอัพเดทข้อมูล profile
   */

  await loadCurrentUser();
  updateUserNameDisplay();
  console.log("✅ User data refreshed");
}

// =====================================================
// 📝 UPDATE USER PROFILE
// =====================================================
async function updateUserProfile(updates = {}) {
  /**
   * อัพเดทข้อมูล profile ของ User
   * 
   * @param {object} updates - ข้อมูลที่ต้องการอัพเดท
   * @returns {boolean} - true ถ้าสำเร็จ
   * 
   * ตัวอย่าง:
   * updateUserProfile({ zone: "ภาคเหนือ", phone: "081-234-5678" })
   */

  try {
    if (!window.currentUser || !window.currentUser.id) {
      throw new Error("User not loaded");
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq("id", window.currentUser.id);

    if (error) throw error;

    // Refresh ข้อมูลหลังอัพเดท
    await refreshUserData();

    console.log("✅ Profile updated successfully");
    return true;

  } catch (error) {
    console.error("❌ updateUserProfile error:", error);
    return false;
  }
}

// =====================================================
// 🚀 INITIALIZE USER SERVICE
// =====================================================
async function initUserService() {
  /**
   * เริ่มต้น User Service
   * ควรเรียกใช้ทุกหน้าใน DOMContentLoaded
   */

  try {
    // โหลดข้อมูล User
    await loadCurrentUser();

    // อัพเดทชื่อใน header
    updateUserNameDisplay();

    // ใช้งาน permission-based UI
    applyPermissionBasedUI();

    console.log("✅ User service initialized");
    return true;

  } catch (error) {
    console.error("❌ initUserService error:", error);
    return false;
  }
}

// =====================================================
// 📦 EXPORT (ถ้าใช้ ES6 modules)
// =====================================================
// export {
//   loadCurrentUser,
//   autoFillUserData,
//   updateUserNameDisplay,
//   getUserData,
//   checkUserPermission,
//   applyPermissionBasedUI,
//   refreshUserData,
//   updateUserProfile,
//   initUserService
// };

console.log("✅ userService.js loaded");