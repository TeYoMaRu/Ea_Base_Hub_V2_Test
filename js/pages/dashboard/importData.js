// importData.js

// Global Variables
let transformedData = null;
let filteredData = null;
let fileName = null;
let visibleColumns = new Set();

// ========================================
// Initialization
// ========================================

(async function init() {
    try {
        console.log('🚀 Starting initialization...');
        
        // รอให้ Supabase พร้อม (ถ้ามี)
        if (typeof window.supabaseClient === 'undefined') {
            console.log('⚠️ Supabase client not loaded, checking...');
            let attempts = 0;
            while (typeof window.supabaseClient === 'undefined' && attempts < 50) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }
        }
        
        if (window.supabaseClient) {
            console.log('✅ Supabase client ready');
        } else {
            console.log('⚠️ Supabase client not available (continuing anyway)');
        }
        
        // ป้องกันหน้า (ถ้ามี protectPage)
        if (typeof protectPage === 'function') {
            console.log('🔒 Checking permissions...');
            await protectPage(['admin', 'manager']);
            console.log('✅ Permission check passed');
            
            // รอให้ currentUser พร้อม
            let userAttempts = 0;
            while (!window.currentUser && userAttempts < 50) {
                await new Promise(r => setTimeout(r, 100));
                userAttempts++;
            }
            
            if (window.currentUser) {
                console.log('✅ User ready:', window.currentUser.display_name);
            }
        } else {
            console.log('⚠️ protectPage not available (continuing anyway)');
        }
        
        // เริ่มต้นระบบ
        console.log('✅ Initializing upload features...');
        initUpload();
        console.log('✅ System ready!');
        
    } catch (error) {
        console.error('❌ Init error:', error);
        console.log('⚠️ Continuing with basic functionality...');
        // ถ้า auth ไม่มี ให้ใช้งานได้ปกติ
        initUpload();
    }
})();

// ========================================
// Event Listeners Setup
// ========================================

function initUpload() {
    console.log('📋 Setting up upload listeners...');
    
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    if (!uploadArea || !fileInput) {
        console.error('❌ Upload elements not found!');
        showAlert('ไม่พบองค์ประกอบสำหรับอัพโหลด กรุณารีเฟรชหน้า', 'error');
        return;
    }

    console.log('✅ Upload elements found');

    // Upload area click
    uploadArea.addEventListener('click', () => {
        console.log('🖱️ Upload area clicked');
        fileInput.click();
    });
    
    // Drag & Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        console.log('📂 File dropped');
        handleFile(e.dataTransfer.files[0]);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        console.log('📂 File selected');
        handleFile(e.target.files[0]);
    });

    // Button events
    const exportBtn = document.getElementById('exportBtn');
    const clearBtn = document.getElementById('clearBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const importToSupabaseBtn = document.getElementById('importToSupabaseBtn');

    if (exportBtn) exportBtn.addEventListener('click', exportCSV);
    if (clearBtn) clearBtn.addEventListener('click', clearData);
    if (clearFilterBtn) clearFilterBtn.addEventListener('click', clearFilters);
    if (importToSupabaseBtn) importToSupabaseBtn.addEventListener('click', importToSupabase);

    // Filter events
    const filterSales = document.getElementById('filterSales');
    const filterCustomer = document.getElementById('filterCustomer');
    const searchProduct = document.getElementById('searchProduct');

    if (filterSales) filterSales.addEventListener('change', applyFilters);
    if (filterCustomer) filterCustomer.addEventListener('change', applyFilters);
    if (searchProduct) searchProduct.addEventListener('input', applyFilters);

    console.log('✅ All event listeners attached');
}

// ========================================
// File Handling
// ========================================

async function handleFile(file) {
    console.log('📄 handleFile called with:', file);
    
    if (!file) {
        console.error('❌ No file provided');
        showAlert('ไม่ได้เลือกไฟล์', 'error');
        return;
    }

    fileName = file.name;
    console.log('📝 File name:', fileName);
    console.log('📏 File size:', file.size, 'bytes');
    console.log('🏷️ File type:', file.type);
    
    showAlert('กำลังอ่านไฟล์...', 'info');
    showProcessLog('info', '📂 เปิดไฟล์: ' + fileName);

    try {
        let rawData = null;

        // อ่าน Excel หรือ CSV
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            console.log('📊 Reading as Excel...');
            rawData = await readExcel(file);
        } else if (file.name.endsWith('.csv')) {
            console.log('📄 Reading as CSV...');
            rawData = await readCSV(file);
        } else {
            throw new Error('รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv');
        }

        console.log('✅ File read successfully, rows:', rawData.length);
        showProcessLog('success', '✅ อ่านไฟล์สำเร็จ: ' + rawData.length + ' แถว');

        // แปลงข้อมูล
        console.log('🔄 Transforming data...');
        transformedData = transformSalesReport(rawData);

        if (transformedData.length === 0) {
            throw new Error('ไม่พบข้อมูลที่สามารถแปลงได้');
        }

        console.log('✅ Data transformed:', transformedData.length, 'records');
        showProcessLog('success', '✅ แปลงข้อมูลสำเร็จ: ' + transformedData.length + ' รายการ');

        // ตั้งค่า column ที่แสดงทั้งหมดเป็นค่าเริ่มต้น
        visibleColumns = new Set(Object.keys(transformedData[0]));
        console.log('📋 Columns:', [...visibleColumns]);

        // เริ่มต้น filters
        console.log('🔍 Initializing filters...');
        initFilters();
        filteredData = [...transformedData];
        
        // แสดงผล
        console.log('🎨 Displaying preview...');
        showPreview();
        showAlert('✅ ประมวลผลสำเร็จ!', 'success');

    } catch (error) {
        console.error('❌ Process error:', error);
        showProcessLog('error', '❌ ข้อผิดพลาด: ' + error.message);
        showAlert('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');
    }
}

// ========================================
// File Readers
// ========================================

async function readExcel(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(firstSheet, {
                    header: 1,
                    defval: ''
                });
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function readCSV(file) {
    return new Promise(async (resolve, reject) => {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let text = null;

            // ลอง decode หลาย encoding
            for (const encoding of ['utf-8', 'iso-8859-11', 'tis-620', 'windows-874']) {
                try {
                    const decoder = new TextDecoder(encoding);
                    text = decoder.decode(uint8Array);
                    text = text.replace(/^\ufeff/, '').replace(/^\uFEFF/, '');
                    if (!text.includes('�') && text.length > 50) {
                        break;
                    }
                } catch (e) {
                    console.log('Failed encoding:', encoding);
                }
            }

            if (!text) {
                throw new Error('ไม่สามารถอ่านไฟล์ได้');
            }

            Papa.parse(text, {
                complete: (results) => resolve(results.data),
                error: reject
            });
        } catch (err) {
            reject(err);
        }
    });
}

// ========================================
// Data Transformation
// ========================================

function transformSalesReport(rows) {
    const transformed = [];
    let currentSales = { name: null, phone: null, code: null };
    let currentCustomer = { name: null, code: null };

    showProcessLog('info', '🔄 กำลังแปลงข้อมูล...');

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const firstCol = String(row[0] || '').trim();

        // ข้าม header และ separator
        if (firstCol.includes('---') || firstCol.includes('===') ||
            firstCol.includes('รายการสินค้า') || firstCol === '' ||
            firstCol.includes('Ea') || firstCol.includes('หน้า') ||
            firstCol.includes('รายงาน') || firstCol.includes('วันที่') ||
            firstCol.includes('รหัส')) {
            continue;
        }

        // ตรวจจับ พนักงานขาย - แยกชื่อ เบอร์ รหัส
        // รูปแบบ: "คุณกิตติพงษ์0818093946 /ก-02" หรือ "  บริษัท 02-4497756-8 /A-01"
        const salesMatch = firstCol.match(/^[\s]*(.*?)(\d{10})[\s]*\/([A-Z0-9ก-ฮอ\-]+)$/);
        if (salesMatch) {
            currentSales = {
                name: salesMatch[1].trim()
                    .replace(/^บริษัท\s*/, '')
                    .replace(/^\d{2}-\d{7}-\d\s*/, ''),
                phone: salesMatch[2],
                code: salesMatch[3]
            };
            currentCustomer = { name: null, code: null };
            showProcessLog('info', `  👤 พนักงาน: ${currentSales.name} (${currentSales.phone}) [${currentSales.code}]`);
            continue;
        }

        // ตรวจจับ ลูกค้า - มีช่องว่างข้างหน้า
        const customerMatch = firstCol.match(/^[\s]{2,}(.+?)\/([ก-ฮ\w0-9]+)$/);
        if (customerMatch) {
            currentCustomer = {
                name: customerMatch[1].trim(),
                code: customerMatch[2]
            };
            showProcessLog('info', `    🏪 ลูกค้า: ${currentCustomer.name} [${currentCustomer.code}]`);
            continue;
        }

        // ข้ามแถวรวม
        if (firstCol.includes('รวมลูกค้า') || firstCol.includes('รวมพนักงาน') ||
            firstCol.includes('รวมทั้งหมด') || firstCol.includes('-------------')) {
            continue;
        }

        // แถวข้อมูลสินค้า
        if (currentSales.code && row.length > 5) {
            // ตรวจสอบว่ามีตัวเลข
            const hasNumeric = row.slice(1).some(cell => {
                const val = String(cell || '').replace(/,/g, '').replace(/\s/g, '');
                return !isNaN(val) && val !== '';
            });

            if (hasNumeric) {
                const product = firstCol.replace(/^[\s]+/, '');
                const productMatch = product.match(/^(.+?)\/([^\s\/]+)$/);

                transformed.push({
                    sales_name: currentSales.name || '',
                    sales_phone: currentSales.phone || '',
                    sales_code: currentSales.code || '',
                    customer_name: currentCustomer.name || '',
                    customer_code: currentCustomer.code || '',
                    product_name: productMatch ? productMatch[1].trim() : product,
                    product_code: productMatch ? productMatch[2] : '',
                    qty_cash: parseFloat(String(row[4] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    qty_credit: parseFloat(String(row[5] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    qty_free: parseFloat(String(row[6] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    qty_return: parseFloat(String(row[7] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    qty_net: parseFloat(String(row[9] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    unit: String(row[10] || '').trim(),
                    amount_cash: parseFloat(String(row[11] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    amount_credit: parseFloat(String(row[12] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    amount_net: parseFloat(String(row[14] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    cost: parseFloat(String(row[15] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    profit: parseFloat(String(row[17] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0,
                    profit_percent: parseFloat(String(row[18] || '0').replace(/,/g, '').replace(/\s/g, '')) || 0
                });
            }
        }
    }

    return transformed;
}

// ========================================
// Filters
// ========================================

function initFilters() {
    // สร้าง dropdown สำหรับ filter
    const salesSet = new Set(transformedData.map(r => r.sales_code).filter(Boolean));
    const customerSet = new Set(transformedData.map(r => r.customer_code).filter(Boolean));

    const salesSelect = document.getElementById('filterSales');
    const customerSelect = document.getElementById('filterCustomer');

    salesSelect.innerHTML = '<option value="">-- ทุกพนักงาน --</option>';
    customerSelect.innerHTML = '<option value="">-- ทุกลูกค้า --</option>';

    [...salesSet].sort().forEach(code => {
        const name = transformedData.find(r => r.sales_code === code)?.sales_name || '';
        salesSelect.innerHTML += `<option value="${code}">${name} [${code}]</option>`;
    });

    [...customerSet].sort().forEach(code => {
        const name = transformedData.find(r => r.customer_code === code)?.customer_name || '';
        customerSelect.innerHTML += `<option value="${code}">${name} [${code}]</option>`;
    });

    // สร้าง column checkboxes
    const columns = Object.keys(transformedData[0]);
    const columnCheckboxes = document.getElementById('columnCheckboxes');
    columnCheckboxes.innerHTML = columns.map(col => `
        <label>
            <input type="checkbox" value="${col}" ${visibleColumns.has(col) ? 'checked' : ''}>
            ${col}
        </label>
    `).join('');

    // Event listener สำหรับ checkbox
    columnCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                visibleColumns.add(e.target.value);
            } else {
                visibleColumns.delete(e.target.value);
            }
            showPreview();
        });
    });
}

function applyFilters() {
    const salesFilter = document.getElementById('filterSales').value;
    const customerFilter = document.getElementById('filterCustomer').value;
    const productSearch = document.getElementById('searchProduct').value.toLowerCase();

    filteredData = transformedData.filter(row => {
        if (salesFilter && row.sales_code !== salesFilter) return false;
        if (customerFilter && row.customer_code !== customerFilter) return false;
        if (productSearch && !row.product_name.toLowerCase().includes(productSearch)) return false;
        return true;
    });

    showPreview();
}

function clearFilters() {
    document.getElementById('filterSales').value = '';
    document.getElementById('filterCustomer').value = '';
    document.getElementById('searchProduct').value = '';
    filteredData = [...transformedData];
    showPreview();
}

// ========================================
// Display
// ========================================

function showPreview() {
    if (!filteredData || filteredData.length === 0) {
        showAlert('❌ ไม่มีข้อมูลที่ตรงกับ filter', 'error');
        return;
    }

    document.getElementById('previewCard').classList.remove('hidden');

    // Stats
    const stats = [
        { label: 'รายการทั้งหมด', value: transformedData.length, icon: 'summarize' },
        { label: 'รายการที่แสดง', value: filteredData.length, icon: 'filter_list' },
        { label: 'พนักงาน', value: new Set(filteredData.map(r => r.sales_code)).size, icon: 'person' },
        { label: 'ลูกค้า', value: new Set(filteredData.map(r => r.customer_code).filter(Boolean)).size, icon: 'store' },
        {
            label: 'ยอดรวม',
            value: filteredData.reduce((sum, r) => sum + r.amount_net, 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }),
            icon: 'attach_money'
        },
        {
            label: 'กำไรรวม',
            value: filteredData.reduce((sum, r) => sum + r.profit, 0).toLocaleString('th-TH', { maximumFractionDigits: 2 }),
            icon: 'trending_up'
        }
    ];

    document.getElementById('statsGrid').innerHTML = stats.map(s => `
        <div class="stat-card">
            <div class="stat-label">
                <span class="material-icons" style="font-size: 0.9rem; margin-right: 0.2rem;">${s.icon}</span>
                ${s.label}
            </div>
            <div class="stat-value">${s.value}</div>
        </div>
    `).join('');

    // Update counts
    document.getElementById('displayCount').textContent = filteredData.length.toLocaleString();
    document.getElementById('totalCount').textContent = transformedData.length.toLocaleString();

    // Table
    const columns = [...visibleColumns];
    const thead = document.getElementById('tableHead');
    const tbody = document.getElementById('tableBody');

    thead.innerHTML = '<tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr>';
    
    tbody.innerHTML = filteredData.slice(0, 100).map(row =>
        '<tr>' + columns.map(c => {
            let val = row[c];
            if (typeof val === 'number' && !c.includes('code')) {
                val = val.toLocaleString('th-TH', { maximumFractionDigits: 2 });
            }
            return `<td>${val !== null && val !== undefined ? val : '-'}</td>`;
        }).join('') + '</tr>'
    ).join('');

    if (filteredData.length > 100) {
        tbody.innerHTML += `<tr><td colspan="${columns.length}" style="text-align:center; color:#666; padding:1rem;">แสดง 100 รายการแรก จาก ${filteredData.length} รายการ</td></tr>`;
    }

    document.getElementById('previewCard').scrollIntoView({ behavior: 'smooth' });
}

// ========================================
// Import to Supabase
// ========================================

async function importToSupabase() {
    console.log('🔵 importToSupabase() called');
    
    // ตรวจสอบข้อมูล
    console.log('📊 transformedData:', transformedData);
    console.log('📏 transformedData.length:', transformedData?.length);
    
    if (!transformedData || transformedData.length === 0) {
        console.error('❌ No data to import');
        showAlert('❌ ไม่มีข้อมูลให้บันทึก กรุณาอัพโหลดไฟล์ก่อน', 'error');
        return;
    }

    // ✅ แก้ไข: ตรวจสอบ supabaseClient แทน supabase
    console.log('🔍 Checking Supabase client...');
    console.log('window.supabaseClient:', window.supabaseClient);
    
    if (!window.supabaseClient) {
        console.error('❌ Supabase client not available');
        showAlert('❌ ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณารีเฟรชหน้า', 'error');
        return;
    }

    console.log('✅ Supabase client is available');

    // ยืนยันการบันทึก
    const confirmMsg = `ต้องการบันทึกข้อมูล ${transformedData.length} รายการ ลง Supabase ใช่หรือไม่?`;
    console.log('❓ Asking for confirmation...');
    
    if (!confirm(confirmMsg)) {
        console.log('⏹️ User cancelled');
        return;
    }

    console.log('✅ User confirmed');

    // ปิดปุ่ม
    const importBtn = document.getElementById('importToSupabaseBtn');
    if (!importBtn) {
        console.error('❌ Button not found: importToSupabaseBtn');
        showAlert('❌ ไม่พบปุ่ม Import', 'error');
        return;
    }

    importBtn.disabled = true;
    importBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> กำลังบันทึก...';

    showProcessLog('info', '🔄 เริ่มบันทึกข้อมูลลง Supabase...');
    console.log('📤 Starting import process...');

    try {
        // เตรียมข้อมูล
        console.log('📦 Preparing data...');
        
        const dataToInsert = transformedData.map((row, index) => {
            if (index === 0) {
                console.log('📝 Sample row:', row);
            }
            
            return {
                sales_name: row.sales_name || '',
                sales_phone: row.sales_phone || '',
                sales_code: row.sales_code || '',
                customer_name: row.customer_name || '',
                customer_code: row.customer_code || '',
                product_name: row.product_name || '',
                product_code: row.product_code || '',
                qty_cash: row.qty_cash || 0,
                qty_credit: row.qty_credit || 0,
                qty_free: row.qty_free || 0,
                qty_return: row.qty_return || 0,
                qty_net: row.qty_net || 0,
                unit: row.unit || '',
                amount_cash: row.amount_cash || 0,
                amount_credit: row.amount_credit || 0,
                amount_net: row.amount_net || 0,
                cost: row.cost || 0,
                profit: row.profit || 0,
                profit_percent: row.profit_percent || 0,
                import_by: window.currentUser?.display_name || window.currentUser?.email || 'Unknown',
                import_filename: fileName || 'unknown.csv'
            };
        });

        console.log('✅ Data prepared:', dataToInsert.length, 'records');
        console.log('📝 First record to insert:', dataToInsert[0]);

        // แบ่งเป็น batch
        const batchSize = 100;
        let totalInserted = 0;

        console.log('🔢 Total batches:', Math.ceil(dataToInsert.length / batchSize));

        for (let i = 0; i < dataToInsert.length; i += batchSize) {
            const batch = dataToInsert.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(dataToInsert.length / batchSize);
            
            console.log(`📤 Batch ${batchNumber}/${totalBatches}: Inserting ${batch.length} records...`);
            showProcessLog('info', `📤 กำลังบันทึก ${i + 1}-${Math.min(i + batchSize, dataToInsert.length)} จาก ${dataToInsert.length}...`);

            try {
                // ✅ แก้ไข: ใช้ window.supabaseClient แทน window.supabase
                const { data, error } = await window.supabaseClient
                    .from('sales_data')
                    .insert(batch);

                if (error) {
                    console.error('❌ Supabase insert error:', error);
                    console.error('Error details:', {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    throw new Error(`บันทึกล้มเหลว: ${error.message}`);
                }

                totalInserted += batch.length;
                console.log(`✅ Batch ${batchNumber} inserted successfully`);
                showProcessLog('success', `✅ บันทึกสำเร็จ ${totalInserted} รายการ`);
                
            } catch (batchError) {
                console.error('❌ Batch error:', batchError);
                throw batchError;
            }
        }

        console.log('🎉 Import completed:', totalInserted, 'records');
        showProcessLog('success', `🎉 บันทึกข้อมูลทั้งหมดสำเร็จ! (${totalInserted} รายการ)`);
        showAlert(`✅ บันทึกข้อมูลลง Supabase สำเร็จ! (${totalInserted} รายการ)`, 'success');

        // รีเซ็ตปุ่ม
        importBtn.disabled = false;
        importBtn.innerHTML = '<span class="material-icons">cloud_upload</span> บันทึกลง Supabase';

    } catch (error) {
        console.error('💥 Import error:', error);
        console.error('Error stack:', error.stack);
        
        showProcessLog('error', '❌ เกิดข้อผิดพลาด: ' + error.message);
        showAlert('❌ เกิดข้อผิดพลาด: ' + error.message, 'error');

        // รีเซ็ตปุ่ม
        importBtn.disabled = false;
        importBtn.innerHTML = '<span class="material-icons">cloud_upload</span> บันทึกลง Supabase';
    }
}

// ========================================
// Export & Clear
// ========================================

function exportCSV() {
    if (!filteredData) return;

    // Export เฉพาะ column ที่เลือก
    const columns = [...visibleColumns];
    const dataToExport = filteredData.map(row => {
        const obj = {};
        columns.forEach(col => obj[col] = row[col]);
        return obj;
    });

    const csv = Papa.unparse(dataToExport);
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName.replace(/\.[^.]+$/, '_transformed.csv');
    link.click();
    
    showAlert('✅ Export สำเร็จ! (' + filteredData.length + ' รายการ)', 'success');
}

function clearData() {
    if (confirm('ต้องการล้างข้อมูลใช่หรือไม่?')) {
        transformedData = null;
        filteredData = null;
        fileName = null;
        visibleColumns = new Set();
        
        document.getElementById('fileInput').value = '';
        document.getElementById('previewCard').classList.add('hidden');
        document.getElementById('processCard').classList.add('hidden');
        document.getElementById('processLog').innerHTML = '';
        document.getElementById('alert').className = 'alert';
    }
}

// ========================================
// UI Helpers
// ========================================

function showAlert(msg, type) {
    const alert = document.getElementById('alert');
    alert.textContent = msg;
    alert.className = `alert show ${type}`;
}

function showProcessLog(type, msg) {
    document.getElementById('processCard').classList.remove('hidden');
    const log = document.getElementById('processLog');
    const div = document.createElement('div');
    div.className = type;
    div.textContent = msg;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}