// =====================================================
// formClaim.js
// ไฟล์ JavaScript สำหรับหน้าแจ้งเคลมสินค้า
// ต้องโหลดหลังจาก supabaseClient.js, userService.js, auth.js
// =====================================================
import { sendLineNotify } from "/js/services/lineNotify.js";
// =====================================================
// 🔄 รอให้ Supabase Client พร้อม
// =====================================================
async function waitForSupabase() {
  let attempts = 0;
  const maxAttempts = 50;

  while (typeof supabaseClient === "undefined" && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    attempts++;
  }

  if (typeof supabaseClient === "undefined") {
    console.error("❌ Supabase client not available after waiting");
    return false;
  }

  console.log("✅ Supabase client is ready");
  return true;
}

// =====================================================
// 🚀 INITIALIZE PAGE
// =====================================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const isReady = await waitForSupabase();
    if (!isReady) {
      alert("ไม่สามารถเชื่อมต่อระบบได้");
      return;
    }

    await protectPage();

    setTodayDate();

    await loadCustomerList();
    await loadDrafts();

    setupEventListeners();
    setupMediaUpload();
    setupClaimTypes();
    setupModalOverlay(); // ป้องกัน click overlay ปิด modal
  } catch (error) {
    console.error("❌ Error initializing page:", error);
    alert("เกิดข้อผิดพลาดในการโหลดหน้า: " + error.message);
  }
});

// =====================================================
// 🛍️ OPEN PRODUCT MODAL
// เปิด modal และโหลดสินค้าในหมวดที่กดมา
// =====================================================
async function openProductModal(categoryId) {
  console.log("🛍️ open modal category =", categoryId);

  const modal = document.getElementById("productModal");
  if (!modal) {
    console.error("❌ productModal not found");
    return;
  }

  // แสดง modal
  modal.style.display = "flex";

  // เก็บ categoryId ไว้ใช้ (กรณีต้องการ back)
  modal._currentCategoryId = categoryId;

  // ป้องกัน click-outside ปิด modal ขณะที่กำลังเปิด
  // (ต้องรอ 1 frame ก่อน ไม่งั้น event เดิมจะ bubble มาปิดทันที)
  modal._readyToClose = false;
  setTimeout(() => {
    modal._readyToClose = true;
  }, 100);

  // แสดง step 1: รายการสินค้า
  await showProductList(categoryId);
}

// =====================================================
// 📋 STEP 1: แสดงรายการสินค้าในหมวด
// =====================================================
async function showProductList(categoryId) {
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = '<p class="modal-loading">⏳ กำลังโหลดสินค้า...</p>';

  try {
    const { data, error } = await supabaseClient
      .from("products")
      .select("id, name")
      .eq("category_id", categoryId)
      .order("name");

    if (error) throw error;

    if (!data || data.length === 0) {
      modalBody.innerHTML = '<p class="modal-empty">ไม่มีสินค้าในหมวดนี้</p>';
      return;
    }

    modalBody.innerHTML = `
      <p class="modal-step-label">เลือกสินค้า</p>
      <div class="modal-list" id="productListContainer"></div>`;

    const container = document.getElementById("productListContainer");
    data.forEach((product) => {
      const item = document.createElement("div");
      item.className = "modal-list-item";
      item.innerHTML = `<span>${product.name}</span><span class="modal-arrow">›</span>`;
      item.addEventListener("click", (e) => {
        e.stopPropagation(); // ป้องกัน bubble ขึ้น overlay
        showAttributeSelectors(product.id, product.name);
      });
      container.appendChild(item);
    });
  } catch (error) {
    console.error("❌ Error loading products:", error);
    modalBody.innerHTML = '<p class="modal-error">❌ โหลดสินค้าไม่สำเร็จ</p>';
  }
}

// =====================================================
// 📦 STEP 2: แสดง Attributes ของสินค้าให้เลือกทีละตัว
// ใช้ attributes + attribute_options แทน product_variants
// =====================================================
async function showAttributeSelectors(productId, productName) {
  const modalBody = document.getElementById("modalBody");
  const modal = document.getElementById("productModal");

  modalBody.innerHTML =
    '<p class="modal-loading">⏳ กำลังโหลดข้อมูลสินค้า...</p>';

  modal._currentProductId = productId;
  modal._currentProductName = productName;

  // เก็บค่าที่เลือกแต่ละ attribute
  modal._selectedAttrs = {};

  try {
    // โหลด attributes ของ category นี้
    const categoryId = modal._currentCategoryId;

    const { data: attrs, error: attrErr } = await supabaseClient
      .from("attributes")
      .select("id, name, input_type, order_no")
      .eq("category_id", categoryId)
      .order("order_no");

    if (attrErr) throw attrErr;

    // ถ้าไม่มี attribute → ยืนยันตรงๆ
    if (!attrs || attrs.length === 0) {
      document.getElementById("product").value = productName;
      showConfirmStep(productName, {});
      return;
    }

    // render
    modalBody.innerHTML = "";

    // back button
    const backBtn = document.createElement("button");
    backBtn.className = "modal-back-btn";
    backBtn.textContent = "‹ ย้อนกลับ";
    backBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showProductList(categoryId);
    });
    modalBody.appendChild(backBtn);

    // label สินค้า
    const label = document.createElement("p");
    label.className = "modal-step-label";
    label.innerHTML = `เลือกสเปค: <strong>${productName}</strong>`;
    modalBody.appendChild(label);

    // สร้าง selector แต่ละ attribute
    const attrContainer = document.createElement("div");
    attrContainer.className = "modal-attr-selectors";
    attrContainer.id = "attrSelectorsContainer";
    modalBody.appendChild(attrContainer);

    // โหลด options ของทุก attribute พร้อมกัน
    const optionPromises = attrs.map((attr) =>
      supabaseClient
        .from("attribute_options")
        .select("id, value")
        .eq("attribute_id", attr.id)
        .order("value"),
    );

    const optionResults = await Promise.all(optionPromises);

    attrs.forEach((attr, idx) => {
      const options = optionResults[idx].data || [];

      const group = document.createElement("div");
      group.className = "modal-attr-group";

      const attrLabel = document.createElement("p");
      attrLabel.className = "modal-attr-label";
      attrLabel.textContent = attr.name;
      group.appendChild(attrLabel);

      if (options.length === 0) {
        // ไม่มี option → ให้พิมพ์เอง
        const input = document.createElement("input");
        input.type = "text";
        input.className = "modal-attr-input";
        input.placeholder = `ระบุ${attr.name}`;
        input.addEventListener("input", (e) => {
          e.stopPropagation();
          modal._selectedAttrs[attr.name] = e.target.value;
          updateProductInput();
        });
        group.appendChild(input);
      } else {
        // มี options → แสดงเป็น chip ให้เลือก
        const chipWrap = document.createElement("div");
        chipWrap.className = "modal-chip-wrap";

        options.forEach((opt) => {
          const chip = document.createElement("div");
          chip.className = "modal-chip";
          chip.textContent = opt.value;
          chip.addEventListener("click", (e) => {
            e.stopPropagation();
            // deselect chip เดิมใน group นี้
            chipWrap
              .querySelectorAll(".modal-chip")
              .forEach((c) => c.classList.remove("selected"));
            chip.classList.add("selected");
            modal._selectedAttrs[attr.name] = opt.value;
            updateProductInput();
          });
          chipWrap.appendChild(chip);
        });

        group.appendChild(chipWrap);
      }

      attrContainer.appendChild(group);
    });

    // ปุ่มยืนยัน
    const confirmBtn = document.createElement("button");
    confirmBtn.className = "modal-confirm-btn";
    confirmBtn.id = "modalConfirmBtn";
    confirmBtn.textContent = "✅ ยืนยันเลือกสินค้านี้";
    confirmBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeProductModal();
    });
    modalBody.appendChild(confirmBtn);

    // อัปเดต input สินค้าจาก attrs ที่เลือก
    function updateProductInput() {
      const attrParts = Object.values(modal._selectedAttrs).filter(Boolean);
      const fullName =
        attrParts.length > 0
          ? `${productName} ${attrParts.join(" ")}`
          : productName;
      document.getElementById("product").value = fullName;
    }

    // ตั้งค่าเริ่มต้น
    document.getElementById("product").value = productName;
  } catch (error) {
    console.error("❌ Error loading attributes:", error);
    modalBody.innerHTML = '<p class="modal-error">❌ โหลดข้อมูลไม่สำเร็จ</p>';
  }
}

// =====================================================
// ❌ CLOSE PRODUCT MODAL
// =====================================================
function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (modal) {
    modal.style.display = "none";
    modal._readyToClose = false;
  }
}

// =====================================================
// 🖱️ SETUP MODAL OVERLAY CLICK
// คลิกพื้นที่นอก modal-content → ปิด modal
// =====================================================
function setupModalOverlay() {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  modal.addEventListener("click", function (e) {
    if (e.target === modal && modal._readyToClose) {
      closeProductModal();
    }
  });
}

// =====================================================
// 🔤 ESCAPE ATTRIBUTE
// ป้องกัน single quote ใน inline onclick string
// =====================================================
function escapeAttr(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// =====================================================
// 📅 SET TODAY DATE
// =====================================================
function setTodayDate() {
  const today = new Date().toISOString().split("T")[0];
  document.getElementById("claimDate").value = today;
  console.log("✅ Set today date:", today);
}

// =====================================================
// 🎯 SETUP EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }
  console.log("✅ Event listeners setup complete");
}

// =====================================================
// 📷 SETUP MEDIA UPLOAD
// =====================================================
function setupMediaUpload() {
  const imageInput = document.getElementById("imageInput");
  if (imageInput) {
    imageInput.addEventListener("change", handleImageUpload);
  }

  const videoInput = document.getElementById("videoInput");
  if (videoInput) {
    videoInput.addEventListener("change", handleVideoUpload);
  }

  console.log("✅ Media upload setup complete");
}

// =====================================================
// 📦 SETUP CLAIM TYPES
// =====================================================
function setupClaimTypes() {
  document.querySelectorAll(".claim-item").forEach((item) => {
    item.addEventListener("click", function () {
      this.classList.toggle("selected");
    });
  });
  console.log("✅ Claim types setup complete");
}

// =====================================================
// 📋 LOAD SHOP LIST
// =====================================================
async function loadCustomerList() {
  try {
    const selectElement = document.getElementById("customer");
    if (!selectElement) return;

    selectElement.innerHTML = '<option value="">กำลังโหลดร้านค้า...</option>';

    const { data, error } = await supabaseClient
      .from("shops")
      .select("id, shop_name")
      .order("shop_name");

    if (error) throw error;

    selectElement.innerHTML =
      '<option value="">-- เลือกร้านค้า / ลูกค้า --</option>';

    if (!data || data.length === 0) return;

    data.forEach((shop) => {
      const option = document.createElement("option");
      option.value = shop.shop_name; // ใช้ชื่อร้านค้าเป็น value ตรงๆ (column claims.customer = text)
      option.textContent = shop.shop_name;
      selectElement.appendChild(option);
    });

    console.log(`✅ Loaded ${data.length} shops`);
  } catch (error) {
    console.error("❌ Error loading shops:", error);
    const sel = document.getElementById("customer");
    if (sel) sel.innerHTML = '<option value="">โหลดร้านค้าไม่สำเร็จ</option>';
  }
}

// =====================================================
// 📷 HANDLE IMAGE UPLOAD
// =====================================================
function handleImageUpload(e) {
  const files = Array.from(e.target.files);
  const imageGrid = document.getElementById("imageGrid");

  files.forEach((file) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const previewBox = document.createElement("div");
      previewBox.className = "upload-box preview";
      previewBox.style.position = "relative";
      previewBox._file = file; // เก็บ file object ไว้สำหรับ upload

      const img = document.createElement("img");
      img.src = event.target.result;
      img.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:8px;";

      previewBox.appendChild(img);
      previewBox.appendChild(createDeleteButton(() => previewBox.remove()));

      const uploadBox = imageGrid.querySelector("label.upload-box");
      imageGrid.insertBefore(previewBox, uploadBox);
    };
    reader.readAsDataURL(file);
  });
}

// =====================================================
// 🎥 HANDLE VIDEO UPLOAD
// =====================================================
function handleVideoUpload(e) {
  const files = Array.from(e.target.files);
  const videoGrid = document.getElementById("videoGrid");

  files.forEach((file) => {
    if (!file.type.startsWith("video/")) return;

    const reader = new FileReader();
    reader.onload = function (event) {
      const previewBox = document.createElement("div");
      previewBox.className = "upload-box preview";
      previewBox.style.position = "relative";
      previewBox._file = file; // เก็บ file object ไว้สำหรับ upload

      const video = document.createElement("video");
      video.src = event.target.result;
      video.controls = true;
      video.style.cssText =
        "width:100%;height:100%;object-fit:cover;border-radius:8px;";

      previewBox.appendChild(video);
      previewBox.appendChild(createDeleteButton(() => previewBox.remove()));

      const uploadBox = videoGrid.querySelector("label.upload-box");
      videoGrid.insertBefore(previewBox, uploadBox);
    };
    reader.readAsDataURL(file);
  });
}

// =====================================================
// 🔘 สร้างปุ่มลบ preview
// =====================================================
function createDeleteButton(onClickFn) {
  const btn = document.createElement("button");
  btn.innerHTML = "✖";
  btn.style.cssText = `
    position:absolute; top:5px; right:5px;
    background:rgba(255,0,0,0.8); color:white;
    border:none; border-radius:50%;
    width:25px; height:25px; cursor:pointer; z-index:10;
  `;
  btn.onclick = onClickFn;
  return btn;
}

// =====================================================
// 🧩 GET SELECTED CLAIM TYPES
// =====================================================
function getSelectedClaimTypes() {
  const types = [];
  document.querySelectorAll(".claim-item.selected").forEach((item) => {
    types.push(item.textContent.trim());
  });
  return types;
}

// =====================================================
// 📤 UPLOAD MEDIA FILES
// อัปโหลดไฟล์รูปภาพและวิดีโอขึ้น Supabase Storage
// bucket: claim-media / images, claim-media / videos
// คืนค่า: array of public URL
// =====================================================
async function uploadMediaFiles(claimId) {
  const urls = [];

  // รวบรวม file objects จาก preview elements
  // (เก็บ file ไว้ใน dataset ของ previewBox)
  const imagePreviews = document.querySelectorAll("#imageGrid .preview");
  const videoPreviews = document.querySelectorAll("#videoGrid .preview");

  // อัปโหลดรูปภาพ
  for (let i = 0; i < imagePreviews.length; i++) {
    const file = imagePreviews[i]._file;
    if (!file) continue;

    const ext = file.name.split(".").pop();
    const filePath = `images/${claimId}_${i}_${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from("claim-media")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error("❌ Upload image error:", error);
      continue;
    }

    const { data: urlData } = supabaseClient.storage
      .from("claim-media")
      .getPublicUrl(filePath);

    urls.push(urlData.publicUrl);
    console.log("✅ Image uploaded:", urlData.publicUrl);
  }

  // อัปโหลดวิดีโอ
  for (let i = 0; i < videoPreviews.length; i++) {
    const file = videoPreviews[i]._file;
    if (!file) continue;

    const ext = file.name.split(".").pop();
    const filePath = `videos/${claimId}_${i}_${Date.now()}.${ext}`;

    const { error } = await supabaseClient.storage
      .from("claim-media")
      .upload(filePath, file, { upsert: true });

    if (error) {
      console.error("❌ Upload video error:", error);
      continue;
    }

    const { data: urlData } = supabaseClient.storage
      .from("claim-media")
      .getPublicUrl(filePath);

    urls.push(urlData.publicUrl);
    console.log("✅ Video uploaded:", urlData.publicUrl);
  }

  return urls;
}

// =====================================================
// 💾 SAVE DRAFT
// =====================================================
async function saveDraft() {
  try {
    const claimDate = document.getElementById("claimDate").value;
    const customer = document.getElementById("customer").value;
    const product = document.getElementById("product").value;
    const qty = document.getElementById("qty").value;

    if (!claimDate || !customer || !product || !qty) {
      alert("⚠️ กรุณากรอกข้อมูลที่จำเป็น (วันที่, ลูกค้า, สินค้า, จำนวน)");
      return;
    }

    const draftData = {
      user_id: getUserData("id"),
      emp_name: getUserData("display_name"),
      area: getUserData("area"),
      claim_date: claimDate,
      customer: document.getElementById("customer").value,
      buy_date: document.getElementById("buyDate").value || null,
      mfg_date: document.getElementById("mfgDate").value || null,
      product: product,
      qty: qty,
      claim_types: getSelectedClaimTypes(),
      detail: document.getElementById("detail").value || "",
      status: "draft",
      created_at: new Date().toISOString(),
    };

    // insert draft ก่อนเพื่อได้ claim id
    const { data, error } = await supabaseClient
      .from("claims")
      .insert([draftData])
      .select()
      .single();

    if (error) throw error;

    // อัปโหลดไฟล์ (ถ้ามี) แล้วอัปเดต media_urls
    const mediaUrls = await uploadMediaFiles(data.id);
    if (mediaUrls.length > 0) {
      await supabaseClient
        .from("claims")
        .update({ media_urls: mediaUrls })
        .eq("id", data.id);
    }

    alert("✅ บันทึก Draft สำเร็จ!");
    await loadDrafts();
  } catch (error) {
    console.error("❌ Error saving draft:", error);
    alert("❌ เกิดข้อผิดพลาดในการบันทึก: " + error.message);
  }
}

// =====================================================
// 📄 LOAD DRAFTS
// =====================================================
async function loadDrafts() {
  try {
    const userId = getUserData("id");
    if (!userId) return;

    const { data, error } = await supabaseClient
      .from("claims")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const draftBody = document.getElementById("draftBody");

    if (!data || data.length === 0) {
      draftBody.innerHTML =
        '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">ยังไม่มี Draft</td></tr>';
      return;
    }

    draftBody.innerHTML = "";
    data.forEach((draft) => {
      const row = document.createElement("tr");

      // แสดงรูปภาพ thumbnail ถ้ามี
      const thumbHtml =
        draft.media_urls && draft.media_urls.length > 0
          ? `<div class="draft-thumbs">
             ${draft.media_urls
               .slice(0, 3)
               .map((url) =>
                 url.match(/\.(mp4|mov|avi|webm)$/i)
                   ? `<div class="draft-thumb video-thumb">🎥</div>`
                   : `<img class="draft-thumb" src="${url}" onerror="this.style.display='none'">`,
               )
               .join("")}
             ${draft.media_urls.length > 3 ? `<div class="draft-thumb more-thumb">+${draft.media_urls.length - 3}</div>` : ""}
           </div>`
          : `<span class="draft-no-media">ไม่มีไฟล์</span>`;

      // claim_types
      const typesHtml =
        draft.claim_types && draft.claim_types.length > 0
          ? draft.claim_types
              .map((t) => `<span class="draft-type-tag">${t}</span>`)
              .join("")
          : '<span style="color:#94a3b8;font-size:0.8rem;">-</span>';

      row.innerHTML = `
        <td>
          <div class="draft-date">${formatDate(draft.claim_date)}</div>
          <div class="draft-customer">${draft.customer || "-"}</div>
        </td>
        <td>
          <div class="draft-product">${draft.product}</div>
          <div class="draft-qty">${draft.qty || ""}</div>
          <div class="draft-types">${typesHtml}</div>
        </td>
        <td>${thumbHtml}</td>
        <td>
          <div class="draft-actions">
            <button class="btn-draft-edit" onclick="editDraft('${draft.id}')" title="แก้ไข">
              ✏️ แก้ไข
            </button>
            <button class="btn-draft-del" onclick="deleteDraft('${draft.id}')" title="ลบ">
              🗑️
            </button>
          </div>
        </td>`;
      draftBody.appendChild(row);
    });

    console.log(`✅ Loaded ${data.length} draft(s)`);
  } catch (error) {
    console.error("❌ Error loading drafts:", error);
  }
}

// =====================================================
// ✏️ EDIT DRAFT
// =====================================================
async function editDraft(draftId) {
  try {
    const { data, error } = await supabaseClient
      .from("claims")
      .select("*")
      .eq("id", draftId)
      .single();

    if (error) throw error;

    document.getElementById("claimDate").value = data.claim_date || "";
    document.getElementById("customer").value = data.customer || "";
    document.getElementById("buyDate").value = data.buy_date || "";
    document.getElementById("mfgDate").value = data.mfg_date || "";
    document.getElementById("product").value = data.product || "";
    document.getElementById("qty").value = data.qty || "";
    document.getElementById("detail").value = data.detail || "";

    if (data.claim_types && Array.isArray(data.claim_types)) {
      document.querySelectorAll(".claim-item").forEach((item) => {
        item.classList.toggle(
          "selected",
          data.claim_types.includes(item.textContent.trim()),
        );
      });
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    window.currentDraftId = draftId;

    alert('โหลดข้อมูล Draft สำเร็จ กรุณาแก้ไขแล้วกดปุ่ม "แก้ไข"');
  } catch (error) {
    console.error("❌ Error editing draft:", error);
    alert("❌ ไม่สามารถโหลด Draft ได้");
  }
}

// =====================================================
// 🗑️ DELETE DRAFT
// =====================================================
async function deleteDraft(draftId) {
  try {
    if (!confirm("ต้องการลบ Draft นี้หรือไม่?")) return;

    const { error } = await supabaseClient
      .from("claims")
      .delete()
      .eq("id", draftId);

    if (error) throw error;

    alert("✅ ลบ Draft สำเร็จ");
    await loadDrafts();
  } catch (error) {
    console.error("❌ Error deleting draft:", error);
    alert("❌ ไม่สามารถลบ Draft ได้");
  }
}

// =====================================================
// ✏️ SUBMIT EDIT
// =====================================================
async function submitEdit() {
  try {
    if (!window.currentDraftId) {
      alert("⚠️ กรุณาเลือก Draft ที่ต้องการแก้ไขก่อน (กดปุ่ม ✏️ ในตาราง)");
      return;
    }

    const claimDate = document.getElementById("claimDate").value;
    const customer = document.getElementById("customer").value;
    const product = document.getElementById("product").value;
    const qty = document.getElementById("qty").value;

    if (!claimDate || !customer || !product || !qty) {
      alert("⚠️ กรุณากรอกข้อมูลที่จำเป็น");
      return;
    }

    const { error } = await supabaseClient
      .from("claims")
      .update({
        claim_date: claimDate,
        customer: document.getElementById("customer").value,
        buy_date: document.getElementById("buyDate").value || null,
        mfg_date: document.getElementById("mfgDate").value || null,
        product: product,
        qty: qty,
        claim_types: getSelectedClaimTypes(),
        detail: document.getElementById("detail").value || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", window.currentDraftId);

    if (error) throw error;

    alert("✅ อัพเดท Draft สำเร็จ!");
    window.currentDraftId = null;
    await loadDrafts();
    clearForm();
  } catch (error) {
    console.error("❌ Error updating draft:", error);
    alert("❌ เกิดข้อผิดพลาดในการอัพเดท: " + error.message);
  }
}

// =====================================================
// ✅ SUBMIT CLAIM
// =====================================================
async function submitClaim() {
  try {
    const claimDate = document.getElementById("claimDate").value;
    const customer = document.getElementById("customer").value;
    const product = document.getElementById("product").value;
    const qty = document.getElementById("qty").value;

    if (!claimDate || !customer || !product || !qty) {
      alert("⚠️ กรุณากรอกข้อมูลที่จำเป็น (วันที่, ลูกค้า, สินค้า, จำนวน)");
      return;
    }

    const hasImages =
      document.querySelectorAll("#imageGrid .preview").length > 0;
    const hasVideos =
      document.querySelectorAll("#videoGrid .preview").length > 0;

    if (!hasImages && !hasVideos) {
      alert("⚠️ กรุณาแนบรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์");
      return;
    }

    const selectedTypes = getSelectedClaimTypes();
    if (selectedTypes.length === 0) {
      alert("⚠️ กรุณาเลือกประเภทปัญหา");
      return;
    }

    if (!confirm("ยืนยันการส่งเคลม?")) return;

    const claimData = {
      user_id: getUserData("id"),
      emp_name: getUserData("display_name"),
      area: getUserData("area"),
      claim_date: claimDate,
      customer: document.getElementById("customer").value,
      buy_date: document.getElementById("buyDate").value || null,
      mfg_date: document.getElementById("mfgDate").value || null,
      product: product,
      qty: qty,
      claim_types: selectedTypes,
      detail: document.getElementById("detail").value || "",
      status: "submitted",
      created_at: new Date().toISOString(),
    };

    // insert claim ก่อนเพื่อได้ id สำหรับ upload
    const { data, error } = await supabaseClient
      .from("claims")
      .insert([claimData])
      .select()
      .single();

    if (error) throw error;

    // อัปโหลดไฟล์และบันทึก media_urls
    const mediaUrls = await uploadMediaFiles(data.id);
    if (mediaUrls.length > 0) {
      await supabaseClient
        .from("claims")
        .update({ media_urls: mediaUrls })
        .eq("id", data.id);
      console.log(`✅ Uploaded ${mediaUrls.length} file(s)`);
    }

    alert("✅ ส่งเคลมสำเร็จ!");

    await sendLineNotify({
      shop: customer,
      product: product,
      qty: qty,
      sales: getUserData("display_name"),
    });

    clearForm();
    await loadDrafts();
  } catch (error) {
    console.error("❌ Error submitting claim:", error);
    alert("❌ เกิดข้อผิดพลาดในการส่งเคลม: " + error.message);
  }
}

// =====================================================
// 🧹 CLEAR FORM
// =====================================================
function clearForm() {
  document.getElementById("claimDate").value = new Date()
    .toISOString()
    .split("T")[0];
  document.getElementById("customer").value = "";
  document.getElementById("buyDate").value = "";
  document.getElementById("mfgDate").value = "";
  document.getElementById("product").value = "";
  document.getElementById("qty").value = "";
  document.getElementById("detail").value = "";

  document.querySelectorAll(".claim-item.selected").forEach((item) => {
    item.classList.remove("selected");
  });

  document
    .querySelectorAll("#imageGrid .preview, #videoGrid .preview")
    .forEach((p) => {
      p.remove();
    });

  window.currentDraftId = null;
  console.log("✅ Form cleared");
}

// =====================================================
// 📅 FORMAT DATE
// =====================================================
function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

console.log("✅ formClaim.js loaded");
