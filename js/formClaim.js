// =====================================================
// formClaim.js
// ไฟล์ JavaScript สำหรับหน้าแจ้งเคลมสินค้า
// ต้องโหลดหลังจาก supabaseClient.js, userService.js, auth.js
// =====================================================

// =====================================================
// 🔄 รอให้ Supabase Client พร้อม (ถ้ายังไม่พร้อม)
// =====================================================
async function waitForSupabase() {
  let attempts = 0;
  const maxAttempts = 50; // รอสูงสุด 5 วินาที

  while (typeof supabaseClient === 'undefined' && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (typeof supabaseClient === 'undefined') {
    console.error('❌ Supabase client not available after waiting');
    return false;
  }

  console.log('✅ Supabase client is ready');
  return true;
}

// =====================================================
// 🚀 INITIALIZE PAGE
// =====================================================
document.addEventListener('DOMContentLoaded', async () => {
  try {

    // รอให้ Supabase พร้อม
    const isReady = await waitForSupabase();
    if (!isReady) {
      alert('ไม่สามารถเชื่อมต่อระบบได้');
      return;
    }

    // 🔒 ป้องกันหน้า - ต้อง login
    await protectPage();

    // 📅 ตั้งวันที่
    setTodayDate();

    // 📋 โหลดข้อมูล
    await loadCustomerList();
    await loadDrafts();

    // 🎯 Setup UI
    setupEventListeners();
    setupMediaUpload();
    setupClaimTypes();

  } catch (error) {
    console.error('❌ Error initializing page:', error);
    alert('เกิดข้อผิดพลาดในการโหลดหน้า: ' + error.message);
  }
});

// =====================================================
// 📅 SET TODAY DATE
// =====================================================
function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('claimDate').value = today;
  console.log('✅ Set today date:', today);
}

// =====================================================
// 🎯 SETUP EVENT LISTENERS
// =====================================================
function setupEventListeners() {
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  console.log('✅ Event listeners setup complete');
}

// =====================================================
// 📷 SETUP MEDIA UPLOAD
// =====================================================
function setupMediaUpload() {
  // Image upload
  const imageInput = document.getElementById('imageInput');
  if (imageInput) {
    imageInput.addEventListener('change', handleImageUpload);
    console.log('✅ Image upload setup complete');
  }

  // Video upload
  const videoInput = document.getElementById('videoInput');
  if (videoInput) {
    videoInput.addEventListener('change', handleVideoUpload);
    console.log('✅ Video upload setup complete');
  }
}

// =====================================================
// 📦 SETUP CLAIM TYPES
// =====================================================
function setupClaimTypes() {
  const claimItems = document.querySelectorAll('.claim-item');
  
  claimItems.forEach(item => {
    item.addEventListener('click', function() {
      this.classList.toggle('selected');
      console.log('Claim type toggled:', this.textContent);
    });
  });

  console.log('✅ Claim types setup complete');
}

// =====================================================
// 📋 LOAD SHOP LIST (ลูกค้า / ร้านค้า)
// =====================================================
async function loadCustomerList() {
  try {

    const selectElement = document.getElementById('customer');

    // ตรวจสอบว่ามี element หรือไม่
    if (!selectElement) {
      console.warn("⚠️ customer select element not found");
      return;
    }

    // แสดง loading option
    selectElement.innerHTML = '<option value="">กำลังโหลดร้านค้า...</option>';

    // ดึงรายการร้านค้าจาก Supabase
    const { data, error } = await supabaseClient
      .from('shops')
      .select('id, shop_name')
      .order('shop_name');

    if (error) throw error;

    // ล้าง options เดิม
    selectElement.innerHTML = '<option value="">-- เลือกร้านค้า / ลูกค้า --</option>';

    // ตรวจสอบว่ามีข้อมูลหรือไม่
    if (!data || data.length === 0) {
      console.warn("⚠️ No shops found");
      return;
    }

    // เพิ่ม options
    data.forEach(shop => {

      const option = document.createElement('option');

      option.value = shop.id;
      option.textContent = shop.shop_name;  // ← แก้ตรงนี้

      selectElement.appendChild(option);

    });

    console.log(`✅ Loaded ${data.length} shops`);

  } catch (error) {

    console.error('❌ Error loading shops:', error);

    const selectElement = document.getElementById('customer');

    if (selectElement) {
      selectElement.innerHTML = '<option value="">โหลดร้านค้าไม่สำเร็จ</option>';
    }

  }
}


// =====================================================
// 📷 HANDLE IMAGE UPLOAD
// =====================================================
function handleImageUpload(e) {
  const files = Array.from(e.target.files);
  const imageGrid = document.getElementById('imageGrid');

  files.forEach(file => {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      
      reader.onload = function(event) {
        // สร้าง preview box
        const previewBox = document.createElement('div');
        previewBox.className = 'upload-box preview';
        
        // สร้าง img element
        const img = document.createElement('img');
        img.src = event.target.result;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        
        // สร้างปุ่มลบ
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '✖';
        deleteBtn.className = 'delete-btn';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '5px';
        deleteBtn.style.right = '5px';
        deleteBtn.style.background = 'rgba(255, 0, 0, 0.8)';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '25px';
        deleteBtn.style.height = '25px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = () => previewBox.remove();
        
        previewBox.style.position = 'relative';
        previewBox.appendChild(img);
        previewBox.appendChild(deleteBtn);
        
        // เพิ่ม preview ก่อน upload box
        const uploadBox = imageGrid.querySelector('label.upload-box');
        imageGrid.insertBefore(previewBox, uploadBox);
      };
      
      reader.readAsDataURL(file);
    }
  });

  console.log(`✅ Uploaded ${files.length} image(s)`);
}

// =====================================================
// 🎥 HANDLE VIDEO UPLOAD
// =====================================================
function handleVideoUpload(e) {
  const files = Array.from(e.target.files);
  const videoGrid = document.getElementById('videoGrid');

  files.forEach(file => {
    if (file.type.startsWith('video/')) {
      const reader = new FileReader();
      
      reader.onload = function(event) {
        // สร้าง preview box
        const previewBox = document.createElement('div');
        previewBox.className = 'upload-box preview';
        
        // สร้าง video element
        const video = document.createElement('video');
        video.src = event.target.result;
        video.controls = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
        video.style.borderRadius = '8px';
        
        // สร้างปุ่มลบ
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '✖';
        deleteBtn.className = 'delete-btn';
        deleteBtn.style.position = 'absolute';
        deleteBtn.style.top = '5px';
        deleteBtn.style.right = '5px';
        deleteBtn.style.background = 'rgba(255, 0, 0, 0.8)';
        deleteBtn.style.color = 'white';
        deleteBtn.style.border = 'none';
        deleteBtn.style.borderRadius = '50%';
        deleteBtn.style.width = '25px';
        deleteBtn.style.height = '25px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.onclick = () => previewBox.remove();
        
        previewBox.style.position = 'relative';
        previewBox.appendChild(video);
        previewBox.appendChild(deleteBtn);
        
        // เพิ่ม preview ก่อน upload box
        const uploadBox = videoGrid.querySelector('label.upload-box');
        videoGrid.insertBefore(previewBox, uploadBox);
      };
      
      reader.readAsDataURL(file);
    }
  });

  console.log(`✅ Uploaded ${files.length} video(s)`);
}

// =====================================================
// 💾 SAVE DRAFT
// =====================================================
async function saveDraft() {
  try {
    console.log('💾 Saving draft...');

    // ตรวจสอบข้อมูลที่จำเป็น
    const claimDate = document.getElementById('claimDate').value;
    const customer = document.getElementById('customer').value;
    const product = document.getElementById('product').value;
    const qty = document.getElementById('qty').value;

    if (!claimDate || !customer || !product || !qty) {
      alert('⚠️ กรุณากรอกข้อมูลที่จำเป็น (วันที่, ลูกค้า, สินค้า, จำนวน)');
      return;
    }

    // รวบรวมข้อมูล claim types ที่เลือก
    const selectedTypes = [];
    document.querySelectorAll('.claim-item.selected').forEach(item => {
      selectedTypes.push(item.textContent);
    });

    // สร้าง draft object
    const draftData = {
      user_id: getUserData('id'),
      emp_name: getUserData('display_name'),
      area: getUserData('area'),
      claim_date: claimDate,
      customer_id: customer,
      buy_date: document.getElementById('buyDate').value || null,
      mfg_date: document.getElementById('mfgDate').value || null,
      product: product,
      qty: qty,
      claim_types: selectedTypes,
      detail: document.getElementById('detail').value || '',
      status: 'draft',
      created_at: new Date().toISOString()
    };

    // บันทึกลง database
    const { data, error } = await supabaseClient
      .from('claims')
      .insert([draftData])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Draft saved:', data);
    alert('✅ บันทึก Draft สำเร็จ!');

    // โหลด drafts ใหม่
    await loadDrafts();

    // ล้างฟอร์ม (ถ้าต้องการ)
    // clearForm();

  } catch (error) {
    console.error('❌ Error saving draft:', error);
    alert('❌ เกิดข้อผิดพลาดในการบันทึก: ' + error.message);
  }
}

// =====================================================
// 📄 LOAD DRAFTS
// =====================================================
async function loadDrafts() {
  try {
    const userId = getUserData('id');
    if (!userId) {
      console.log('⚠️ User ID not available yet');
      return;
    }

    // ดึง drafts จาก database
    const { data, error } = await supabaseClient
      .from('claims')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const draftBody = document.getElementById('draftBody');
    
    if (!data || data.length === 0) {
      draftBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #94a3b8;">ยังไม่มี Draft</td></tr>';
      console.log('ℹ️ No drafts found');
      return;
    }

    // สร้าง rows
    draftBody.innerHTML = '';
    data.forEach(draft => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${formatDate(draft.claim_date)}</td>
        <td>${draft.product}</td>
        <td><span class="status-badge draft">Draft</span></td>
        <td>
          <button class="btn-icon" onclick="editDraft('${draft.id}')" title="แก้ไข">
            ✏️
          </button>
          <button class="btn-icon" onclick="deleteDraft('${draft.id}')" title="ลบ">
            🗑️
          </button>
        </td>
      `;
      draftBody.appendChild(row);
    });

    console.log(`✅ Loaded ${data.length} draft(s)`);

  } catch (error) {
    console.error('❌ Error loading drafts:', error);
    // ไม่ต้อง alert เพราะอาจยังไม่มีตาราง claims
  }
}

// =====================================================
// ✏️ EDIT DRAFT
// =====================================================
async function editDraft(draftId) {
  try {
    console.log('✏️ Editing draft:', draftId);

    // ดึงข้อมูล draft
    const { data, error } = await supabaseClient
      .from('claims')
      .select('*')
      .eq('id', draftId)
      .single();

    if (error) throw error;

    // เติมข้อมูลลงฟอร์ม
    document.getElementById('claimDate').value = data.claim_date || '';
    document.getElementById('customer').value = data.customer_id || '';
    document.getElementById('buyDate').value = data.buy_date || '';
    document.getElementById('mfgDate').value = data.mfg_date || '';
    document.getElementById('product').value = data.product || '';
    document.getElementById('qty').value = data.qty || '';
    document.getElementById('detail').value = data.detail || '';

    // เลือก claim types
    if (data.claim_types && Array.isArray(data.claim_types)) {
      document.querySelectorAll('.claim-item').forEach(item => {
        if (data.claim_types.includes(item.textContent)) {
          item.classList.add('selected');
        }
      });
    }

    // Scroll ขึ้นบน
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // เก็บ draft ID ไว้สำหรับการอัพเดท
    window.currentDraftId = draftId;

    console.log('✅ Draft loaded for editing');
    alert('โหลดข้อมูล Draft สำเร็จ กรุณาแก้ไขและบันทึกใหม่');

  } catch (error) {
    console.error('❌ Error editing draft:', error);
    alert('❌ ไม่สามารถโหลด Draft ได้');
  }
}

// =====================================================
// 🗑️ DELETE DRAFT
// =====================================================
async function deleteDraft(draftId) {
  try {
    if (!confirm('ต้องการลบ Draft นี้หรือไม่?')) {
      return;
    }

    console.log('🗑️ Deleting draft:', draftId);

    const { error } = await supabaseClient
      .from('claims')
      .delete()
      .eq('id', draftId);

    if (error) throw error;

    console.log('✅ Draft deleted');
    alert('✅ ลบ Draft สำเร็จ');

    // โหลด drafts ใหม่
    await loadDrafts();

  } catch (error) {
    console.error('❌ Error deleting draft:', error);
    alert('❌ ไม่สามารถลบ Draft ได้');
  }
}

// =====================================================
// ✏️ SUBMIT EDIT (อัพเดท Draft ที่มีอยู่)
// =====================================================
async function submitEdit() {
  try {
    if (!window.currentDraftId) {
      alert('⚠️ กรุณาเลือก Draft ที่ต้องการแก้ไขก่อน');
      return;
    }

    console.log('✏️ Updating draft:', window.currentDraftId);

    // ตรวจสอบข้อมูลที่จำเป็น
    const claimDate = document.getElementById('claimDate').value;
    const customer = document.getElementById('customer').value;
    const product = document.getElementById('product').value;
    const qty = document.getElementById('qty').value;

    if (!claimDate || !customer || !product || !qty) {
      alert('⚠️ กรุณากรอกข้อมูลที่จำเป็น');
      return;
    }

    // รวบรวมข้อมูล claim types
    const selectedTypes = [];
    document.querySelectorAll('.claim-item.selected').forEach(item => {
      selectedTypes.push(item.textContent);
    });

    // อัพเดทข้อมูล
    const { error } = await supabaseClient
      .from('claims')
      .update({
        claim_date: claimDate,
        customer_id: customer,
        buy_date: document.getElementById('buyDate').value || null,
        mfg_date: document.getElementById('mfgDate').value || null,
        product: product,
        qty: qty,
        claim_types: selectedTypes,
        detail: document.getElementById('detail').value || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', window.currentDraftId);

    if (error) throw error;

    console.log('✅ Draft updated');
    alert('✅ อัพเดท Draft สำเร็จ!');

    // ล้าง currentDraftId
    window.currentDraftId = null;

    // โหลด drafts ใหม่
    await loadDrafts();

    // ล้างฟอร์ม
    clearForm();

  } catch (error) {
    console.error('❌ Error updating draft:', error);
    alert('❌ เกิดข้อผิดพลาดในการอัพเดท: ' + error.message);
  }
}

// =====================================================
// ✅ SUBMIT CLAIM (ส่งเคลมจริง)
// =====================================================
async function submitClaim() {
  try {
    console.log('✅ Submitting claim...');

    // ตรวจสอบข้อมูลที่จำเป็น
    const claimDate = document.getElementById('claimDate').value;
    const customer = document.getElementById('customer').value;
    const product = document.getElementById('product').value;
    const qty = document.getElementById('qty').value;

    if (!claimDate || !customer || !product || !qty) {
      alert('⚠️ กรุณากรอกข้อมูลที่จำเป็น (วันที่, ลูกค้า, สินค้า, จำนวน)');
      return;
    }

    // ตรวจสอบว่ามีรูปภาพหรือวิดีโอหรือไม่
    const hasImages = document.querySelectorAll('#imageGrid .preview').length > 0;
    const hasVideos = document.querySelectorAll('#videoGrid .preview').length > 0;

    if (!hasImages && !hasVideos) {
      alert('⚠️ กรุณาแนบรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์');
      return;
    }

    if (!confirm('ยืนยันการส่งเคลม?')) {
      return;
    }

    // รวบรวมข้อมูล claim types
    const selectedTypes = [];
    document.querySelectorAll('.claim-item.selected').forEach(item => {
      selectedTypes.push(item.textContent);
    });

    if (selectedTypes.length === 0) {
      alert('⚠️ กรุณาเลือกประเภทปัญหา');
      return;
    }

    // สร้าง claim object
    const claimData = {
      user_id: getUserData('id'),
      emp_name: document.getElementById('empName').value,
      area: document.getElementById('area').value,
      claim_date: claimDate,
      customer_id: customer,
      buy_date: document.getElementById('buyDate').value || null,
      mfg_date: document.getElementById('mfgDate').value || null,
      product: product,
      qty: qty,
      claim_types: selectedTypes,
      detail: document.getElementById('detail').value || '',
      status: 'submitted',
      created_at: new Date().toISOString()
    };

    // บันทึกลง database
    const { data, error } = await supabaseClient
      .from('claims')
      .insert([claimData])
      .select()
      .single();

    if (error) throw error;

    console.log('✅ Claim submitted:', data);
    alert('✅ ส่งเคลมสำเร็จ!');

    // ล้างฟอร์ม
    clearForm();

    // โหลด drafts ใหม่ (ถ้ามี)
    await loadDrafts();

  } catch (error) {
    console.error('❌ Error submitting claim:', error);
    alert('❌ เกิดข้อผิดพลาดในการส่งเคลม: ' + error.message);
  }
}

// =====================================================
// 🧹 CLEAR FORM
// =====================================================
function clearForm() {
  // ล้างข้อมูลฟอร์ม (ยกเว้น empName และ area)
  document.getElementById('claimDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('customer').value = '';
  document.getElementById('buyDate').value = '';
  document.getElementById('mfgDate').value = '';
  document.getElementById('product').value = '';
  document.getElementById('qty').value = '';
  document.getElementById('detail').value = '';

  // ล้างการเลือก claim types
  document.querySelectorAll('.claim-item.selected').forEach(item => {
    item.classList.remove('selected');
  });

  // ล้างรูปภาพ/วิดีโอ previews
  document.querySelectorAll('#imageGrid .preview, #videoGrid .preview').forEach(preview => {
    preview.remove();
  });

  // ล้าง currentDraftId
  window.currentDraftId = null;

  console.log('✅ Form cleared');
}

// =====================================================
// 📅 FORMAT DATE (แปลงวันที่เป็นรูปแบบไทย)
// =====================================================
function formatDate(dateString) {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}

console.log('✅ formClaim.js loaded');