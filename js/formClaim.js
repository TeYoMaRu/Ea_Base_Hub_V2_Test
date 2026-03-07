/* =====================================================
   ⚠️ FORM CLAIM - JAVASCRIPT (แก้ไขแล้ว - เวอร์ชันสมบูรณ์)
   ไฟล์ JavaScript สำหรับจัดการฟอร์มแจ้งเคลมสินค้า
   ===================================================== */

/* =====================================================
   GLOBAL VARIABLES (ตัวแปร Global)
   ===================================================== */

let filesArray = [];              // เก็บไฟล์ที่อัปโหลด
const MAX_FILES = 10;              // จำนวนไฟล์สูงสุด
let editingIndex = null;           // ตำแหน่ง draft ที่กำลังแก้ไข
let drafts = [];                   // เก็บรายการ drafts
// ⚠️ ลบบรรทัดนี้ออก - ไม่ต้องประกาศซ้ำ
// let supabaseClient = null;      // จะใช้จาก window.supabaseClient แทน

/* =====================================================
   INITIALIZATION (เริ่มต้นระบบ)
   ===================================================== */

/**
 * รอให้ Supabase Client พร้อมใช้งาน
 */
async function waitForSupabase() {
  let attempts = 0;
  const maxAttempts = 50;
  
  while (!window.supabaseClient && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (window.supabaseClient) {
    console.log('✅ Supabase Client พร้อมใช้งาน');
    return true;
  } else {
    console.error('❌ ไม่สามารถโหลด Supabase Client');
    return false;
  }
}

/**
 * ฟังก์ชันเริ่มต้นเมื่อโหลดหน้าเว็บเสร็จ
 */
async function initializePage() {
  console.log('🔄 เริ่มต้นระบบ...');
  
  // รอ Supabase Client
  await waitForSupabase();
  
  // ตั้งค่าวันที่เริ่มต้น
  setDefaultDate();
  
  // ตั้งค่าตัวเลือกประเภทปัญหา
  setupClaimTypeSelector();
  
  // ตั้งค่าการอัปโหลดไฟล์
  setupMediaUpload();
  
  // โหลด drafts จาก localStorage
  loadDrafts();
  
  // แสดงรายการ drafts
  displayDrafts();
  
  console.log('✅ ระบบพร้อมใช้งาน');
}

// เรียกใช้เมื่อโหลดหน้าเว็บเสร็จ
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}


/* =====================================================
   DATE FUNCTIONS (ฟังก์ชันเกี่ยวกับวันที่)
   ===================================================== */

/**
 * ตั้งค่าวันที่แจ้งเคลมเป็นวันที่ปัจจุบัน
 */
function setDefaultDate() {
  const claimDateInput = document.getElementById('claimDate');
  
  if (!claimDateInput) {
    console.warn('⚠️ ไม่พบ element #claimDate');
    return;
  }
  
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  claimDateInput.value = dateString;
}


/* =====================================================
   CLAIM TYPE SELECTOR (ตัวเลือกประเภทปัญหา)
   ===================================================== */

/**
 * ตั้งค่าให้คลิกเลือกประเภทปัญหาได้
 */
function setupClaimTypeSelector() {
  const claimTypesContainer = document.getElementById('claimTypes');
  
  if (!claimTypesContainer) {
    console.warn('⚠️ ไม่พบ element #claimTypes');
    return;
  }
  
  const claimItems = claimTypesContainer.querySelectorAll('.claim-item');
  
  claimItems.forEach(function(item) {
    item.addEventListener('click', function() {
      this.classList.toggle('active');
    });
  });
}

/**
 * ดึงประเภทปัญหาที่เลือกทั้งหมด
 * @returns {Array} - Array ของข้อความประเภทปัญหาที่เลือก
 */
function getSelectedClaimTypes() {
  const selectedItems = document.querySelectorAll('.claim-item.active');
  const types = [];
  
  selectedItems.forEach(function(item) {
    types.push(item.textContent.trim());
  });
  
  return types;
}

/**
 * ล้างการเลือกประเภทปัญหาทั้งหมด
 */
function clearClaimTypeSelection() {
  const selectedItems = document.querySelectorAll('.claim-item.active');
  selectedItems.forEach(function(item) {
    item.classList.remove('active');
  });
}

/**
 * ตั้งค่าประเภทปัญหาที่เลือกไว้ (สำหรับตอนแก้ไข)
 * @param {Array} types - Array ของข้อความประเภทปัญหา
 */
function setClaimTypeSelection(types) {
  clearClaimTypeSelection();
  
  const claimItems = document.querySelectorAll('.claim-item');
  claimItems.forEach(function(item) {
    if (types.includes(item.textContent.trim())) {
      item.classList.add('active');
    }
  });
}


/* =====================================================
   MEDIA UPLOAD SETUP (ตั้งค่าการอัปโหลดไฟล์)
   ===================================================== */

/**
 * ตั้งค่า event listener สำหรับการอัปโหลดรูปภาพ/วิดีโอ
 */
function setupMediaUpload() {
  const imageInput = document.getElementById('imageInput');
  const videoInput = document.getElementById('videoInput');
  
  if (!imageInput || !videoInput) {
    console.warn('⚠️ ไม่พบ element #imageInput หรือ #videoInput');
    return;
  }
  
  imageInput.addEventListener('change', handleFileSelect);
  videoInput.addEventListener('change', handleFileSelect);
  
  console.log('✅ Media upload setup สำเร็จ');
}

/**
 * จัดการเมื่อเลือกไฟล์
 * @param {Event} event - Change event จาก input file
 */
function handleFileSelect(event) {
  const input = event.target;
  const files = Array.from(input.files);
  
  // ตรวจสอบว่าเป็น image หรือ video
  const isImage = input.id === 'imageInput';
  const grid = isImage ? document.getElementById('imageGrid') : document.getElementById('videoGrid');
  
  if (!grid) {
    console.error('❌ ไม่พบ grid element');
    return;
  }
  
  files.forEach(file => {
    // ตรวจสอบจำนวนไฟล์สูงสุด
    if (filesArray.length >= MAX_FILES) {
      alert(`⚠️ อัปโหลดได้ไม่เกิน ${MAX_FILES} ไฟล์`);
      return;
    }
    
    // ตรวจสอบประเภทไฟล์
    const expectedType = isImage ? 'image' : 'video';
    if (!file.type.startsWith(expectedType)) {
      alert(`⚠️ ไฟล์ "${file.name}" ไม่ใช่${isImage ? 'รูปภาพ' : 'วิดีโอ'}`);
      return;
    }
    
    // ตรวจสอบขนาดไฟล์ (สูงสุด 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`⚠️ ไฟล์ "${file.name}" มีขนาดเกิน 50MB`);
      return;
    }
    
    // เพิ่มไฟล์เข้า array
    filesArray.push(file);
    
    // สร้าง URL สำหรับ preview
    const url = URL.createObjectURL(file);
    
    // สร้าง preview element
    const previewBox = document.createElement('div');
    previewBox.className = 'preview-box';
    
    // สร้าง media element
    let media;
    if (isImage) {
      media = document.createElement('img');
      media.src = url;
      media.alt = file.name;
    } else {
      media = document.createElement('video');
      media.controls = true;
      const source = document.createElement('source');
      source.src = url;
      source.type = file.type;
      media.appendChild(source);
    }
    
    // สร้างปุ่มลบ
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.type = 'button';
    removeBtn.textContent = '×';
    
    removeBtn.onclick = () => {
      previewBox.remove();
      filesArray = filesArray.filter(f => f !== file);
      URL.revokeObjectURL(url);
      console.log(`🗑️ ลบไฟล์: ${file.name}`);
    };
    
    // ประกอบ preview box
    previewBox.appendChild(media);
    previewBox.appendChild(removeBtn);
    
    // แทรก box ก่อน upload box
    const uploadBox = grid.querySelector('.upload-box');
    if (uploadBox) {
      grid.insertBefore(previewBox, uploadBox);
    } else {
      grid.appendChild(previewBox);
    }
  });
  
  // รีเซ็ต input
  input.value = '';
}

/**
 * รีเซ็ตการอัปโหลดไฟล์ (ลบ preview ทั้งหมด)
 */
function resetMediaUpload() {
  filesArray = [];
  
  const imageGrid = document.getElementById('imageGrid');
  const videoGrid = document.getElementById('videoGrid');
  
  [imageGrid, videoGrid].forEach(grid => {
    if (!grid) return;
    
    const previewBoxes = grid.querySelectorAll('.preview-box');
    previewBoxes.forEach(box => {
      const media = box.querySelector('img, video');
      if (media && media.src) {
        URL.revokeObjectURL(media.src);
      }
      box.remove();
    });
  });
  
  // รีเซ็ต file inputs
  const imageInput = document.getElementById('imageInput');
  const videoInput = document.getElementById('videoInput');
  
  if (imageInput) imageInput.value = '';
  if (videoInput) videoInput.value = '';
  
  console.log('✅ รีเซ็ตการอัปโหลดไฟล์สำเร็จ');
}


/* =====================================================
   FORM DATA FUNCTIONS (ฟังก์ชันจัดการข้อมูลฟอร์ม)
   ===================================================== */

/**
 * ดึงข้อมูลจากฟอร์มทั้งหมด
 * @returns {Object} - Object ที่มีข้อมูลทั้งหมดในฟอร์ม
 */
function getFormData() {
  return {
    product: document.getElementById('product')?.value || '',
    claimDate: document.getElementById('claimDate')?.value || '',
    qty: document.getElementById('qty')?.value || '',
    buyDate: document.getElementById('buyDate')?.value || '',
    claimTypes: getSelectedClaimTypes(),
    detail: document.getElementById('detail')?.value || '',
    status: 'draft',
    createdAt: new Date().toISOString()
  };
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลฟอร์ม
 * @param {Object} data - ข้อมูลฟอร์ม
 * @returns {Object} - { valid: boolean, message: string }
 */
function validateFormData(data) {
  if (!data.product || data.product.trim() === '') {
    return { valid: false, message: 'กรุณาระบุชื่อสินค้า' };
  }
  
  if (!data.claimDate) {
    return { valid: false, message: 'กรุณาระบุวันที่แจ้งเคลม' };
  }
  
  if (data.claimTypes.length === 0) {
    return { valid: false, message: 'กรุณาเลือกประเภทปัญหาอย่างน้อย 1 รายการ' };
  }
  
  return { valid: true, message: '' };
}

/**
 * ล้างข้อมูลในฟอร์ม
 */
function clearForm() {
  const fields = ['product', 'claimDate', 'qty', 'buyDate', 'detail'];
  fields.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.value = '';
  });
  
  clearClaimTypeSelection();
  resetMediaUpload();
  setDefaultDate();
  editingIndex = null;
}

/**
 * เติมข้อมูลเข้าฟอร์ม (สำหรับตอนแก้ไข)
 * @param {Object} data - ข้อมูลที่จะเติมลงฟอร์ม
 */
function fillForm(data) {
  const fields = {
    product: data.product,
    claimDate: data.claimDate,
    qty: data.qty,
    buyDate: data.buyDate,
    detail: data.detail
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.value = value || '';
  });
  
  if (data.claimTypes && data.claimTypes.length > 0) {
    setClaimTypeSelection(data.claimTypes);
  }
}


/* =====================================================
   UPLOAD CLAIM MEDIA TO SUPABASE
   ===================================================== */

/**
 * อัปโหลดไฟล์หลายไฟล์ไปยัง Supabase Storage bucket "claim-media"
 * @param {Array<File>} files - Array ของ File objects
 * @returns {Promise<Array<string>>} - Array ของ URL สาธารณะ
 */
async function uploadClaimMedia(files) {
  const urls = [];
  
  if (!files || files.length === 0) {
    console.warn('⚠️ ไม่มีไฟล์สำหรับอัปโหลด');
    return urls;
  }
  
  // ใช้ window.supabaseClient แทน
  if (!window.supabaseClient) {
    console.error('❌ ไม่พบ Supabase Client');
    throw new Error('Supabase client is required');
  }
  
  for (const file of files) {
    if (!file || !(file instanceof File)) {
      console.warn('⚠️ พบ item ที่ไม่ใช่ File object - ข้าม:', file);
      continue;
    }
    
    // สร้าง path ตามประเภทไฟล์
    const folder = file.type.startsWith('image') ? 'images' : 'videos';
    const fileName = `${folder}/${Date.now()}_${file.name}`;
    
    try {
      const { data: uploadData, error: uploadError } = await window.supabaseClient
        .storage
        .from('claim-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error(`❌ อัปโหลด "${file.name}" ล้มเหลว:`, uploadError.message);
        continue;
      }
      
      if (!uploadData || !uploadData.path) {
        console.error(`❌ ไม่ได้รับ path จาก upload สำหรับ "${file.name}"`);
        continue;
      }
      
      const { data: urlData } = window.supabaseClient
        .storage
        .from('claim-media')
        .getPublicUrl(uploadData.path);
      
      if (!urlData || !urlData.publicUrl) {
        console.error(`❌ ไม่ได้รับ public URL สำหรับ "${file.name}"`);
        continue;
      }
      
      urls.push(urlData.publicUrl);
      console.log(`✅ อัปโหลดสำเร็จ: ${file.name}`);
      
    } catch (error) {
      console.error(`❌ เกิดข้อผิดพลาดขณะอัปโหลด "${file.name}":`, error);
      continue;
    }
  }
  
  console.log(`📊 สรุป: อัปโหลดสำเร็จ ${urls.length}/${files.length} ไฟล์`);
  
  return urls;
}


/* =====================================================
   DRAFT MANAGEMENT (การจัดการ Draft)
   ===================================================== */

/**
 * บันทึก Draft
 */
function saveDraft() {
  const data = getFormData();
  
  const validation = validateFormData(data);
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  if (editingIndex !== null) {
    drafts[editingIndex] = data;
    alert('✅ อัพเดท Draft สำเร็จ');
  } else {
    drafts.push(data);
    alert('✅ บันทึก Draft สำเร็จ');
  }
  
  saveDraftsToStorage();
  displayDrafts();
  clearForm();
}

/**
 * ส่งเคลมพร้อมอัปโหลดไฟล์
 */
async function submitClaim() {
  const data = getFormData();
  
  const validation = validateFormData(data);
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  if (filesArray.length === 0) {
    alert('⚠️ กรุณาแนบรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์');
    return;
  }
  
  if (!window.supabaseClient) {
    alert('❌ ระบบยังไม่พร้อม - กรุณารีเฟรชหน้าเว็บ');
    console.error('❌ Supabase Client ไม่พร้อม');
    return;
  }
  
  if (!confirm('คุณต้องการส่งเคลมนี้ใช่หรือไม่?')) {
    return;
  }
  
  // แสดง loading
  const submitBtn = event?.target;
  const originalText = submitBtn?.textContent;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ กำลังอัปโหลด...';
  }
  
  try {
    console.log('🔄 กำลังอัปโหลดไฟล์...');
    const mediaUrls = await uploadClaimMedia(filesArray);
    
    if (mediaUrls.length === 0) {
      throw new Error('ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
    }
    
    data.mediaUrls = mediaUrls;
    data.status = 'submitted';
    
    console.log('💾 กำลังบันทึกข้อมูลเคลม...');
    
    // บันทึกลงฐานข้อมูล
    const { error: insertError } = await window.supabaseClient
      .from('claims')
      .insert({
        product: data.product,
        claim_date: data.claimDate,
        qty: data.qty,
        buy_date: data.buyDate,
        claim_types: data.claimTypes,
        detail: data.detail,
        media_urls: data.mediaUrls,
        status: data.status,
        created_at: data.createdAt
      });
    
    if (insertError) {
      throw new Error(`ไม่สามารถบันทึกข้อมูลได้: ${insertError.message}`);
    }
    
    alert('✅ ส่งเคลมสำเร็จ!\n\n' +
          'สินค้า: ' + data.product + '\n' +
          'วันที่: ' + data.claimDate + '\n' +
          'ไฟล์แนบ: ' + mediaUrls.length + ' ไฟล์');
    
    if (editingIndex !== null) {
      deleteDraft(editingIndex);
    }
    
    clearForm();
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText || '▶️ ส่งเคลม';
    }
  }
}


/* =====================================================
   DRAFT TABLE (ตารางแสดง Draft)
   ===================================================== */

/**
 * แสดงรายการ draft ในตาราง
 */
function displayDrafts() {
  const tbody = document.getElementById('draftBody');
  
  if (!tbody) {
    console.warn('⚠️ ไม่พบ element #draftBody');
    return;
  }
  
  tbody.innerHTML = '';
  
  if (drafts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">ยังไม่มีรายการ Draft</td></tr>';
    return;
  }
  
  drafts.forEach(function(draft, index) {
    const tr = document.createElement('tr');
    const displayDate = formatDate(draft.claimDate);
    
    tr.innerHTML = `
      <td>${displayDate}</td>
      <td>${draft.product}</td>
      <td><span style="background:#fff3cd; padding:2px 8px; border-radius:4px; font-size:11px;">Draft</span></td>
      <td>
        <button class="btn-small btn-edit" onclick="editDraft(${index})">✏️ แก้ไข</button>
        <button class="btn-small btn-delete" onclick="deleteDraft(${index})">🗑️ ลบ</button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
}

/**
 * แก้ไข draft
 */
function editDraft(index) {
  editingIndex = index;
  const draft = drafts[index];
  fillForm(draft);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  alert('📝 กำลังแก้ไข Draft\nกรุณาแก้ไขข้อมูลแล้วกด "Save Draft" อีกครั้ง');
}

/**
 * ลบ draft
 */
function deleteDraft(index) {
  if (!confirm('คุณต้องการลบ Draft นี้ใช่หรือไม่?')) {
    return;
  }
  
  drafts.splice(index, 1);
  saveDraftsToStorage();
  displayDrafts();
  
  if (editingIndex === index) {
    editingIndex = null;
    clearForm();
  }
  
  alert('✅ ลบ Draft สำเร็จ');
}


/* =====================================================
   LOCAL STORAGE (บันทึกข้อมูลในเบราว์เซอร์)
   ===================================================== */

/**
 * บันทึก drafts ลง localStorage
 */
function saveDraftsToStorage() {
  try {
    const jsonString = JSON.stringify(drafts);
    localStorage.setItem('claimDrafts', jsonString);
  } catch (error) {
    console.error('❌ ไม่สามารถบันทึก drafts:', error);
  }
}

/**
 * โหลด drafts จาก localStorage
 */
function loadDrafts() {
  const jsonString = localStorage.getItem('claimDrafts');
  
  if (jsonString) {
    try {
      drafts = JSON.parse(jsonString);
    } catch (error) {
      console.error('❌ ไม่สามารถโหลด drafts:', error);
      drafts = [];
    }
  }
}


/* =====================================================
   UTILITY FUNCTIONS (ฟังก์ชันช่วยเหลือ)
   ===================================================== */

/**
 * แปลงวันที่ให้อ่านง่าย
 */
function formatDate(dateString) {
  if (!dateString) return '-';
  
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}


/* =====================================================
   DEBUG FUNCTIONS (สำหรับทดสอบ)
   ===================================================== */

/**
 * ล้างข้อมูล drafts ทั้งหมด
 */
function clearAllDrafts() {
  if (confirm('⚠️ คุณต้องการลบ Draft ทั้งหมดใช่หรือไม่?')) {
    drafts = [];
    saveDraftsToStorage();
    displayDrafts();
    clearForm();
    alert('✅ ลบ Draft ทั้งหมดสำเร็จ');
  }
}

/**
 * แสดงข้อมูล drafts ใน console
 */
function showDrafts() {
  console.log('📋 Drafts:', drafts);
  return drafts;
}