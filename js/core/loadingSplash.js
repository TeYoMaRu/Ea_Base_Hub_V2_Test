/**
 * loading-overlay.js — Reusable Loading Overlay Popup
 *
 * วิธีใช้: ใส่ <script src="/js/core/loading-overlay.js"></script>
 *          ใน <head> หรือก่อน </body> ของทุกหน้าที่ต้องการ
 *
 * แล้วเรียกใช้ผ่าน:
 *   LoadingOverlay.show()                 → แสดง overlay (ข้อความ default)
 *   LoadingOverlay.show("กำลังบันทึก...") → แสดงพร้อมข้อความกำหนดเอง
 *   LoadingOverlay.hide()                 → ซ่อน overlay
 *   LoadingOverlay.redirect(url)          → แสดง แล้ว redirect หลัง 900ms
 */

const LoadingOverlay = (() => {
  // ============================================================
  // 1. Inject CSS
  // ============================================================
  const style = document.createElement("style");
  style.textContent = `
    #ea-loading-overlay {
      position: fixed;
      inset: 0;
      background: rgba(10, 40, 12, 0.65);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 99998;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }

    #ea-loading-overlay.show {
      opacity: 1;
      pointer-events: all;
    }

    /* popup box */
    .ea-overlay-box {
      background: #fff;
      border-radius: 24px;
      padding: 36px 52px 40px;
      text-align: center;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.2);
      transform: scale(0.8);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
      min-width: 230px;
    }

    #ea-loading-overlay.show .ea-overlay-box {
      transform: scale(1);
    }

    /* โลโก้ pop */
    .ea-overlay-logo {
      opacity: 0;
      transform: scale(0.5);
      transition:
        opacity   0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s,
        transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.05s;
    }

    #ea-loading-overlay.show .ea-overlay-logo {
      opacity: 1;
      transform: scale(1);
    }

    .ea-overlay-logo img {
      width: 68px;
      filter: drop-shadow(0 6px 16px rgba(76,175,80,0.28));
    }

    /* ชื่อระบบ */
    .ea-overlay-box h3 {
      font-family: "Kanit", "Segoe UI", sans-serif;
      font-size: 17px;
      font-weight: 600;
      color: #2e7d32;
      margin-top: 12px;
      margin-bottom: 3px;
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.35s ease 0.2s, transform 0.35s ease 0.2s;
    }

    #ea-loading-overlay.show .ea-overlay-box h3 {
      opacity: 1;
      transform: translateY(0);
    }

    /* ข้อความรอง */
    .ea-overlay-box p {
      font-family: "Kanit", "Segoe UI", sans-serif;
      font-size: 13px;
      color: #999;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.35s ease 0.28s, transform 0.35s ease 0.28s;
    }

    #ea-loading-overlay.show .ea-overlay-box p {
      opacity: 1;
      transform: translateY(0);
    }

    /* bouncing dots */
    .ea-overlay-dots {
      display: flex;
      gap: 7px;
      justify-content: center;
      margin-top: 20px;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.35s ease 0.36s, transform 0.35s ease 0.36s;
    }

    #ea-loading-overlay.show .ea-overlay-dots {
      opacity: 1;
      transform: translateY(0);
    }

    .ea-overlay-dots span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4CAF50;
      animation: eaOvDotBounce 1s ease-in-out infinite;
    }

    .ea-overlay-dots span:nth-child(2) { animation-delay: 0.15s; }
    .ea-overlay-dots span:nth-child(3) { animation-delay: 0.30s; }

    @keyframes eaOvDotBounce {
      0%, 100% { transform: translateY(0);    opacity: 0.45; }
      50%       { transform: translateY(-8px); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // ============================================================
  // 2. Inject HTML
  // ============================================================
  const overlay = document.createElement("div");
  overlay.id = "ea-loading-overlay";
  overlay.innerHTML = `
    <div class="ea-overlay-box">
      <div class="ea-overlay-logo">
        <img src="/assets/icons/icon-192.png" alt="EABaseHub">
      </div>
      <h3 id="ea-overlay-title">กำลังโหลด...</h3>
      <p id="ea-overlay-sub">กรุณารอสักครู่</p>
      <div class="ea-overlay-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  const inject = () => document.body.appendChild(overlay);
  if (document.body) inject();
  else document.addEventListener("DOMContentLoaded", inject);

  // ============================================================
  // 3. Public API
  // ============================================================
  return {
    /**
     * แสดง overlay
     * @param {string} title  - ข้อความหลัก (optional)
     * @param {string} sub    - ข้อความรอง (optional)
     */
    show(title = "กำลังโหลด...", sub = "กรุณารอสักครู่") {
      document.getElementById("ea-overlay-title").textContent = title;
      document.getElementById("ea-overlay-sub").textContent = sub;
      overlay.classList.add("show");
    },

    /** ซ่อน overlay */
    hide() {
      overlay.classList.remove("show");
    },

    /**
     * แสดง overlay แล้ว redirect หลัง delay
     * @param {string} url    - URL ปลายทาง
     * @param {string} title  - ข้อความหลัก (optional)
     * @param {number} delay  - หน่วง ms ก่อน redirect (default 900)
     */
    redirect(url, title = "กำลังเข้าสู่ระบบ...", delay = 900) {
      this.show(title);
      setTimeout(() => { window.location.href = url; }, delay);
    },
  };
})();