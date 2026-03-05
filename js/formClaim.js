/* =====================================================
   ⚠️ FORM CLAIM - JAVASCRIPT (แก้ไขแล้ว)
   ไฟล์ JavaScript สำหรับจัดการฟอร์มแจ้งเคลมสินค้า
   ===================================================== */



/* =====================================================
   DATE FUNCTIONS (ฟังก์ชันเกี่ยวกับวันที่)
   ===================================================== */

/**
 * ตั้งค่าวันที่แจ้งเคลมเป็นวันที่ปัจจุบัน
 */
function setDefaultDate() {
  // ดึง element ของ input date
  const claimDateInput = document.getElementById('claimDate');
  
  // 🔧 ตรวจสอบว่า element มีอยู่จริง
  if (!claimDateInput) {
    console.warn('⚠️ ไม่พบ element #claimDate');
    return;
  }
  
  // สร้างวันที่ปัจจุบัน
  const today = new Date();
  
  // แปลงเป็นรูปแบบ YYYY-MM-DD (รูปแบบที่ input date ใช้)
  const dateString = today.toISOString().split('T')[0];
  
  // ตั้งค่าให้ input
  claimDateInput.value = dateString;
}


/* =====================================================
   CLAIM TYPE SELECTOR (ตัวเลือกประเภทปัญหา)
   ===================================================== */

/**
 * ตั้งค่าให้คลิกเลือกประเภทปัญหาได้
 */
function setupClaimTypeSelector() {
  // ดึง container ของประเภทปัญหา
  const claimTypesContainer = document.getElementById('claimTypes');
  
  // 🔧 ตรวจสอบว่า element มีอยู่จริง
  if (!claimTypesContainer) {
    console.warn('⚠️ ไม่พบ element #claimTypes');
    return;
  }
  
  // ดึงช่องเลือกทั้งหมด
  const claimItems = claimTypesContainer.querySelectorAll('.claim-item');
  
  // เพิ่ม event listener ให้แต่ละช่อง
  claimItems.forEach(function(item) {
    item.addEventListener('click', function() {
      // สลับ class 'active' (ถ้ามีอยู่แล้วจะลบออก, ถ้าไม่มีจะเพิ่ม)
      this.classList.toggle('active');
    });
  });
}

/**
 * ดึงประเภทปัญหาที่เลือกทั้งหมด
 * @returns {Array} - Array ของข้อความประเภทปัญหาที่เลือก
 */
function getSelectedClaimTypes() {
  // ดึงช่องที่มี class 'active'
  const selectedItems = document.querySelectorAll('.claim-item.active');
  
  // แปลงเป็น array ของข้อความ
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
  // ล้างการเลือกเดิมก่อน
  clearClaimTypeSelection();
  
  // เลือกประเภทที่ระบุ
  const claimItems = document.querySelectorAll('.claim-item');
  claimItems.forEach(function(item) {
    if (types.includes(item.textContent.trim())) {
      item.classList.add('active');
    }
  });
}


/* =====================================================
   🔧 MEDIA UPLOAD SETUP (ตั้งค่าการอัปโหลดไฟล์)
   ===================================================== */

/**
 * ตั้งค่า event listener สำหรับการอัปโหลดรูปภาพ/วิดีโอ
 */
function setupMediaUpload() {
  
  // ดึง elements
  const input = document.getElementById('claimMedia');
  const grid = document.getElementById('uploadGrid');
  
  // 🔧 ตรวจสอบว่า elements มีอยู่จริง
  if (!input || !grid) {
    console.warn('⚠️ ไม่พบ element #claimMedia หรือ #uploadGrid');
    return;
  }
  
  // เพิ่ม event listener
  input.addEventListener('change', handleFileSelect);
  
  console.log('✅ Media upload setup สำเร็จ');
}

/**
 * จัดการเมื่อเลือกไฟล์
 * @param {Event} event - Change event จาก input file
 */
function handleFileSelect(event) {
  
  const input = event.target;
  const grid = document.getElementById('uploadGrid');
  
  // แปลง FileList เป็น Array
  const files = Array.from(input.files);
  
  // วนลูปแต่ละไฟล์
  files.forEach(file => {
    
    // 🔧 ตรวจสอบจำนวนไฟล์สูงสุด
    if (filesArray.length >= MAX_FILES) {
      alert(`⚠️ อัปโหลดได้ไม่เกิน ${MAX_FILES} ไฟล์`);
      return;
    }
    
    // 🔧 ตรวจสอบประเภทไฟล์
    if (!file.type.startsWith('image') && !file.type.startsWith('video')) {
      alert(`⚠️ ไฟล์ "${file.name}" ไม่ใช่รูปภาพหรือวิดีโอ`);
      return;
    }
    
    // 🔧 ตรวจสอบขนาดไฟล์ (สูงสุด 50MB)
    const MAX_SIZE = 50 * 1024 * 1024; // 50MB
    if (file.size > MAX_SIZE) {
      alert(`⚠️ ไฟล์ "${file.name}" มีขนาดเกิน 50MB`);
      return;
    }
    
    // เพิ่มไฟล์เข้า array
    filesArray.push(file);
    
    // สร้าง URL สำหรับ preview
    const url = URL.createObjectURL(file);
    
    // สร้าง element สำหรับแสดง preview
    const box = document.createElement('div');
    box.className = 'preview-box';
    
    // สร้าง HTML ของ media
    let media = '';
    
    if (file.type.startsWith('image')) {
      media = `<img src="${url}" alt="${file.name}">`;
    } else if (file.type.startsWith('video')) {
      media = `
        <video controls>
          <source src="${url}" type="${file.type}">
        </video>
      `;
    }
    
    // สร้าง HTML ของ box
    box.innerHTML = `
      ${media}
      <button class="remove-btn" type="button">×</button>
    `;
    
    // จัดการปุ่มลบ
    box.querySelector('.remove-btn').onclick = () => {
      // ลบ element
      box.remove();
      
      // ลบไฟล์จาก array
      filesArray = filesArray.filter(f => f !== file);
      
      // 🔧 ปลดปล่อย URL object เพื่อประหยัด memory
      URL.revokeObjectURL(url);
      
      console.log(`🗑️ ลบไฟล์: ${file.name}`);
    };
    
    // แทรก box ไว้ด้านหน้าสุด (ก่อน upload box)
    grid.insertBefore(box, grid.firstElementChild);
    
  });
  
  // 🔧 รีเซ็ต input เพื่อให้เลือกไฟล์เดิมได้อีกครั้ง
  input.value = '';
  
}

/**
 * รีเซ็ตการอัปโหลดไฟล์ (ลบ preview ทั้งหมด)
 */
function resetMediaUpload() {
  
  // ล้าง array
  filesArray = [];
  
  // ดึง upload grid
  const grid = document.getElementById('uploadGrid');
  if (!grid) return;
  
  // ลบ preview boxes ทั้งหมด
  const previewBoxes = grid.querySelectorAll('.preview-box');
  previewBoxes.forEach(box => {
    // ดึง URL จาก img/video เพื่อ revoke
    const media = box.querySelector('img, video');
    if (media && media.src) {
      URL.revokeObjectURL(media.src);
    }
    box.remove();
  });
  
  // รีเซ็ต file input
  const input = document.getElementById('claimMedia');
  if (input) {
    input.value = '';
  }
  
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
    product: document.getElementById('product')?.value || '',        // ชื่อสินค้า
    claimDate: document.getElementById('claimDate')?.value || '',    // วันที่แจ้งเคลม
    qty: document.getElementById('qty')?.value || '',                // จำนวน/รุ่น
    buyDate: document.getElementById('buyDate')?.value || '',        // วันที่ซื้อ
    claimTypes: getSelectedClaimTypes(),                             // ประเภทปัญหา (array)
    detail: document.getElementById('detail')?.value || '',          // รายละเอียด
    status: 'draft',                                                 // สถานะ (draft หรือ submitted)
    createdAt: new Date().toISOString()                              // วันเวลาที่สร้าง
  };
}

/**
 * ตรวจสอบความถูกต้องของข้อมูลฟอร์ม
 * @param {Object} data - ข้อมูลฟอร์ม
 * @returns {Object} - { valid: boolean, message: string }
 */
function validateFormData(data) {
  // ตรวจสอบชื่อสินค้า
  if (!data.product || data.product.trim() === '') {
    return { valid: false, message: 'กรุณาระบุชื่อสินค้า' };
  }
  
  // ตรวจสอบวันที่แจ้งเคลม
  if (!data.claimDate) {
    return { valid: false, message: 'กรุณาระบุวันที่แจ้งเคลม' };
  }
  
  // ตรวจสอบประเภทปัญหา
  if (data.claimTypes.length === 0) {
    return { valid: false, message: 'กรุณาเลือกประเภทปัญหาอย่างน้อย 1 รายการ' };
  }
  
  // ผ่านการตรวจสอบ
  return { valid: true, message: '' };
}

/**
 * ล้างข้อมูลในฟอร์ม
 */
function clearForm() {
  document.getElementById('product').value = '';
  document.getElementById('claimDate').value = '';
  document.getElementById('qty').value = '';
  document.getElementById('buyDate').value = '';
  document.getElementById('detail').value = '';
  
  // ล้างการเลือกประเภทปัญหา
  clearClaimTypeSelection();
  
  // 🔧 ล้างการอัปโหลดไฟล์
  resetMediaUpload();
  
  // ตั้งวันที่แจ้งเคลมเป็นวันปัจจุบันใหม่
  setDefaultDate();
  
  // รีเซ็ตสถานะการแก้ไข
  editingIndex = null;
}

/**
 * เติมข้อมูลเข้าฟอร์ม (สำหรับตอนแก้ไข)
 * @param {Object} data - ข้อมูลที่จะเติมลงฟอร์ม
 */
function fillForm(data) {
  document.getElementById('product').value = data.product || '';
  document.getElementById('claimDate').value = data.claimDate || '';
  document.getElementById('qty').value = data.qty || '';
  document.getElementById('buyDate').value = data.buyDate || '';
  document.getElementById('detail').value = data.detail || '';
  
  // ตั้งค่าประเภทปัญหาที่เลือก
  if (data.claimTypes && data.claimTypes.length > 0) {
    setClaimTypeSelection(data.claimTypes);
  }
}


/* =====================================================
   DRAFT MANAGEMENT (การจัดการ Draft)
   ===================================================== */

/**
 * บันทึก Draft
 * ถ้ากำลังแก้ไขอยู่จะอัพเดท, ถ้าไม่ใช่จะสร้างใหม่
 */
function saveDraft() {
  // ดึงข้อมูลจากฟอร์ม
  const data = getFormData();
  
  // ตรวจสอบความถูกต้อง
  const validation = validateFormData(data);
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  // ถ้ากำลังแก้ไขอยู่
  if (editingIndex !== null) {
    // อัพเดทข้อมูลในตำแหน่งเดิม
    drafts[editingIndex] = data;
    alert('✅ อัพเดท Draft สำเร็จ');
  } else {
    // เพิ่มข้อมูลใหม่
    drafts.push(data);
    alert('✅ บันทึก Draft สำเร็จ');
  }
  
  // บันทึกลง localStorage
  saveDraftsToStorage();
  
  // แสดงรายการใหม่
  displayDrafts();
  
  // ล้างฟอร์ม
  clearForm();
}

/**
 * ส่งเคลม (แบบไม่มีไฟล์)
 * ⚠️ ใช้ submitClaimWithMedia() แทนถ้าต้องการอัปโหลดไฟล์
 */
function submitClaim() {
  // ดึงข้อมูลจากฟอร์ม
  const data = getFormData();
  
  // ตรวจสอบความถูกต้อง
  const validation = validateFormData(data);
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  // เปลี่ยนสถานะเป็น submitted
  data.status = 'submitted';
  
  // ยืนยันการส่ง
  if (!confirm('คุณต้องการส่งเคลมนี้ใช่หรือไม่?')) {
    return;
  }
  
  // ในระบบจริง: ส่งข้อมูลไปยัง Google Apps Script หรือ API
  console.log('ส่งข้อมูลเคลม:', data);
  
  // TODO: เรียก API หรือ Google Apps Script
  // google.script.run.withSuccessHandler(onSuccess).submitClaim(data);
  
  // สำหรับตัวอย่าง: แสดง alert และล้างฟอร์ม
  alert('✅ ส่งเคลมสำเร็จ!\n\nสินค้า: ' + data.product + '\nวันที่: ' + data.claimDate);
  
  // ถ้ากำลังแก้ไข draft ให้ลบ draft นั้นออก
  if (editingIndex !== null) {
    deleteDraft(editingIndex);
  }
  
  // ล้างฟอร์ม
  clearForm();
}


/* =====================================================
   🔧 UPLOAD CLAIM MEDIA TO SUPABASE
   ฟังก์ชันอัปโหลดไฟล์ไปยัง Supabase Storage
   ===================================================== */

/**
 * อัปโหลดไฟล์หลายไฟล์ไปยัง Supabase Storage bucket "claim-media"
 * 
 * @param {Array<File>} files - Array ของ File objects ที่ต้องการอัปโหลด
 * @param {Object} client - Supabase client instance
 * @returns {Promise<Array<string>>} - Array ของ URL สาธารณะของไฟล์ที่อัปโหลดสำเร็จ
 */
async function uploadClaimMedia(files, client) {
  
  const urls = [];
  
  // Validation
  if (!files || files.length === 0) {
    console.warn('⚠️ ไม่มีไฟล์สำหรับอัปโหลด');
    return urls;
  }
  
  if (!client) {
    console.error('❌ ไม่พบ Supabase Client');
    throw new Error('Supabase client is required');
  }
  
  // วนลูปอัปโหลดแต่ละไฟล์
  for (const file of files) {
    
    if (!file || !(file instanceof File)) {
      console.warn('⚠️ พบ item ที่ไม่ใช่ File object - ข้าม:', file);
      continue;
    }
    
    const fileName = `${Date.now()}_${file.name}`;
    
    try {
      
      // อัปโหลดไฟล์
      const { data: uploadData, error: uploadError } = await client
        .storage
        .from('claim-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        console.error(`❌ อัปโหลดไฟล์ "${file.name}" ล้มเหลว:`, uploadError.message);
        continue;
      }
      
      if (!uploadData || !uploadData.path) {
        console.error(`❌ ไม่ได้รับ path จาก upload สำหรับไฟล์ "${file.name}"`);
        continue;
      }
      
      // ดึง public URL
      const { data: urlData } = client
        .storage
        .from('claim-media')
        .getPublicUrl(uploadData.path);
      
      if (!urlData || !urlData.publicUrl) {
        console.error(`❌ ไม่ได้รับ public URL สำหรับไฟล์ "${file.name}"`);
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
  
  if (urls.length === 0 && files.length > 0) {
    console.warn('⚠️ ไม่มีไฟล์ใดที่อัปโหลดสำเร็จ');
  }
  
  return urls;
}


/* =====================================================
   🔧 SUBMIT CLAIM WITH MEDIA
   บันทึกข้อมูลเคลมพร้อมอัปโหลดไฟล์
   ===================================================== */

/**
 * ส่งเคลมพร้อมอัปโหลดรูปภาพ/วิดีโอ
 */
async function submitClaimWithMedia() {
  
  // ดึงข้อมูลฟอร์ม
  const data = getFormData();
  
  // ตรวจสอบความถูกต้อง
  const validation = validateFormData(data);
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  // 🔧 ตรวจสอบว่ามีไฟล์หรือไม่
  if (filesArray.length === 0) {
    alert('⚠️ กรุณาแนบรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์');
    return;
  }
  
  // 🔧 ตรวจสอบว่ามี Supabase Client
  if (!supabaseClient) {
    alert('❌ ระบบยังไม่พร้อม - กรุณารีเฟรชหน้าเว็บ');
    console.error('❌ Supabase Client ไม่พร้อม');
    return;
  }
  
  // ยืนยันการส่ง
  if (!confirm('คุณต้องการส่งเคลมนี้ใช่หรือไม่?')) {
    return;
  }
  
  // 🔧 แสดง loading indicator
  const submitBtn = event?.target;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ กำลังอัปโหลด...';
  }
  
  try {
    
    // 📤 อัปโหลดไฟล์ไปยัง Supabase Storage
    console.log('🔄 กำลังอัปโหลดไฟล์...');
    const mediaUrls = await uploadClaimMedia(filesArray, supabaseClient);
    
    // ตรวจสอบว่าอัปโหลดสำเร็จหรือไม่
    if (mediaUrls.length === 0) {
      throw new Error('ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง');
    }
    
    // เพิ่ม URLs เข้าไปใน data
    data.mediaUrls = mediaUrls;
    data.status = 'submitted';
    
    // 💾 บันทึกข้อมูลเคลมลงฐานข้อมูล
    console.log('💾 กำลังบันทึกข้อมูลเคลม...');
    
    // TODO: เรียก API หรือ Google Apps Script เพื่อบันทึกข้อมูล
    // const result = await saveClaimToDatabase(data);
    
    // แสดงความสำเร็จ
    alert('✅ ส่งเคลมสำเร็จ!\n\n' +
          'สินค้า: ' + data.product + '\n' +
          'วันที่: ' + data.claimDate + '\n' +
          'ไฟล์แนบ: ' + mediaUrls.length + ' ไฟล์');
    
    // ถ้ากำลังแก้ไข draft ให้ลบ draft นั้นออก
    if (editingIndex !== null) {
      deleteDraft(editingIndex);
    }
    
    // ล้างฟอร์มและรีเซ็ต
    clearForm();
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error);
    alert('❌ เกิดข้อผิดพลาด: ' + error.message);
  } finally {
    // 🔧 รีเซ็ต loading indicator
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '▶️ ส่งเคลม';
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
  
  // ล้างตารางเดิม
  tbody.innerHTML = '';
  
  // ถ้าไม่มี draft
  if (drafts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#999;">ยังไม่มีรายการ Draft</td></tr>';
    return;
  }
  
  // วนลูปสร้างแถวในตาราง
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
 * @param {number} index - ตำแหน่งของ draft ใน array
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
 * @param {number} index - ตำแหน่งของ draft ใน array
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
      console.error('Error loading drafts:', error);
      drafts = [];
    }
  }
}


/* =====================================================
   UTILITY FUNCTIONS (ฟังก์ชันช่วยเหลือ)
   ===================================================== */

/**
 * แปลงวันที่ให้อ่านง่าย
 * @param {string} dateString - วันที่ในรูปแบบ YYYY-MM-DD
 * @returns {string} - วันที่ในรูปแบบ DD/MM/YYYY
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
 * ล้างข้อมูล drafts ทั้งหมด (สำหรับทดสอบ)
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
 * แสดงข้อมูล drafts ใน console (สำหรับ debug)
 */
function showDrafts() {
  console.log('📋 Drafts:', drafts);
  return drafts;
}