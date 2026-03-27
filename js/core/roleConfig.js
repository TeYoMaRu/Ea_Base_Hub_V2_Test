// ======================================================
// roleConfig.js
// กำหนดสิทธิ์และหน้า default ของแต่ละ role
// โหลดไฟล์นี้ก่อน auth.js ทุกหน้า
// ======================================================

const ROLE_CONFIG = {

  // -------------------------------------------------------
  // ADMIN — เข้าได้ทุกหน้า
  // -------------------------------------------------------
  admin: {
    defaultPage: '/pages/admin/adminDashboard.html',
    allowedPages: [
      '/pages/admin/adminDashboard.html',
      '/pages/admin/admintor.html',
      '/pages/admin/adminSales.html',
      '/pages/admin/adminShops.html',
      '/pages/admin/adminUsers.html',
      '/pages/manager/managerDashboard.html',
      '/pages/manager/reportManager.html',
      '/pages/qc/qcDashboard.html',
      '/pages/executive/executiveDashboard.html',
      '/pages/sales/salesDashboard.html',
      '/pages/sales/salesReport.html',
      // ✅ เพิ่มหน้าใหม่ตรงนี้
    ]
  },

  // -------------------------------------------------------
  // MANAGER — ดูรายงานและ dashboard ของตัวเอง
  // -------------------------------------------------------
  manager: {
    defaultPage: '/pages/dashboard/managerDashboard.html',
    allowedPages: [
      '/pages/dashboard/managerDashboard.html',
      '/pages/reports/reportTracker.html',
      // ✅ เพิ่มหน้าใหม่ตรงนี้
    ]
  },

  // -------------------------------------------------------
  // ADMIN QC — จัดการ QC dashboard
  // -------------------------------------------------------
  adminQc: {
    defaultPage: '/pages/qc/qcDashboard.html',
    allowedPages: [
      '/pages/qc/qcDashboard.html',
      // ✅ เพิ่มหน้าใหม่ตรงนี้
    ]
  },

  // -------------------------------------------------------
  // EXECUTIVE — ดู dashboard ภาพรวมและรายงาน
  // -------------------------------------------------------
  executive: {
    defaultPage: '/pages/executive/executiveDashboard.html',
    allowedPages: [
      '/pages/executive/executiveDashboard.html',
      '/pages/manager/reportManager.html',
      // ✅ เพิ่มหน้าใหม่ตรงนี้
    ]
  },

  // -------------------------------------------------------
  // SALES — หน้า sales ของตัวเอง
  // -------------------------------------------------------
  sales: {
    defaultPage: '/pages/sales/salesDashboard.html',
    allowedPages: [
      '/pages/sales/salesDashboard.html',
      '/pages/sales/salesReport.html',
      // ✅ เพิ่มหน้าใหม่ตรงนี้
    ]
  }

};

// ======================================================
// 🔧 HELPER FUNCTIONS
// ======================================================

/**
 * ดึง config ของ role นั้น
 * @param {string} role
 * @returns {object|null}
 */
function getRoleConfig(role) {
  return ROLE_CONFIG[role] || null;
}

/**
 * หน้า default ของ role นั้น
 * @param {string} role
 * @returns {string}
 */
function getDefaultPage(role) {
  return ROLE_CONFIG[role]?.defaultPage || '/pages/auth/login.html';
}

/**
 * เช็คว่า role นั้นเข้าหน้านี้ได้ไหม
 * @param {string} role
 * @param {string} path — window.location.pathname
 * @returns {boolean}
 */
function canAccessPage(role, path) {
  const config = ROLE_CONFIG[role];
  if (!config) return false;
  // admin เข้าได้ทุกหน้า
  if (role === 'admin') return true;
  return config.allowedPages.some(p => path.includes(p));
}

console.log('✅ roleConfig.js loaded');