// importData.js

// Global Variables
let transformedData = null;
let filteredData = null;
let fileName = null;
let reportDate = null; // ✅ เพิ่ม: เก็บวันที่ของข้อมูล
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

        // ✅ ดึงวันที่ของข้อมูลจากไฟล์
        reportDate = extractReportDate(rawData);
        console.log('📅 Report date extracted:', reportDate);

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

/**
 * ดึงวันที่ของข้อมูลจากไฟล์รายงาน
 * รูปแบบ: "กันตรา 20 ก.พ. 2569 ถึง 20 ก.พ. 2569"
 * ไม่ใช่: "วันที่: 21/02/69" (วันที่สร้างไฟล์)
 */
function extractReportDate(rows) {
    console.log('🗓️ Extracting report date from file...');
    
    // ลอง parsing จาก 10 แถวแรก
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        
        // ตรวจสอบทุกคอลัมน์ในแถว
        for (let colIndex = 0; colIndex < Math.min(5, row.length); colIndex++) {
            const cellValue = String(row[colIndex] || '').trim();
            
            // ข้ามคอลัมน์ที่มี "วันที่:" (นี่คือวันที่สร้างไฟล์ ไม่ต้องการ)
            if (cellValue.includes('วันที่:') || cellValue.includes('วันที่ :')) {
                console.log(`⏭️ Skipping file creation date: "${cellValue}"`);
                continue;
            }
            
            // รูปแบบที่ต้องการ: "20 ก.พ. 2569" หรือ "ถึง 20 ก.พ. 2569"
            // Pattern: ตัวเลข 1-2 หลัก + เดือนไทย + ปี พ.ศ. 4 หลัก
            const dateMatch = cellValue.match(/(\d{1,2})\s*([ก-ฮ]\s*\.?\s*[ก-ฮ]\s*\.?)\s*(\d{4})/);
            
            if (dateMatch) {
                const day = dateMatch[1].padStart(2, '0');
                const thaiMonth = dateMatch[2].replace(/\s/g, '').replace(/\./g, '');
                const buddhistYear = dateMatch[3];
                
                // ตรวจสอบว่าเป็นปี พ.ศ. จริง (2500-2600)
                const yearInt = parseInt(buddhistYear);
                if (yearInt < 2500 || yearInt > 2600) {
                    continue;
                }
                
                // แปลงเดือนไทยเป็นตัวเลข
                const monthMap = {
                    'มค': '01', 'กพ': '02', 'มีค': '03', 'เมย': '04',
                    'พค': '05', 'มิย': '06', 'กค': '07', 'สค': '08',
                    'กย': '09', 'ตค': '10', 'พย': '11', 'ธค': '12',
                    // รองรับเต็ม
                    'มกราคม': '01', 'กุมภาพันธ์': '02', 'มีนาคม': '03',
                    'เมษายน': '04', 'พฤษภาคม': '05', 'มิถุนายน': '06',
                    'กรกฎาคม': '07', 'สิงหาคม': '08', 'กันยายน': '09',
                    'ตุลาคม': '10', 'พฤศจิกายน': '11', 'ธันวาคม': '12'
                };
                
                const month = monthMap[thaiMonth];
                if (!month) {
                    console.log(`⚠️ Unknown month: "${thaiMonth}"`);
                    continue;
                }
                
                // แปลง พ.ศ. เป็น ค.ศ.
                const year = String(yearInt - 543);
                
                const reportDate = `${year}-${month}-${day}`;
                console.log(`✅ Found report date: ${reportDate} (from "${cellValue}" at row ${i+1}, col ${colIndex+1})`);
                showProcessLog('success', `📅 วันที่ของข้อมูล: ${day}/${month}/${year}`);
                
                return reportDate;
            }
        }
    }
    
    // ถ้าหาไม่เจอ ใช้วันที่ปัจจุบัน
    const today = new Date().toISOString().split('T')[0];
    console.log(`⚠️ Could not extract report date from file, using today: ${today}`);
    showProcessLog('warning', `⚠️ ไม่พบวันที่ในไฟล์ ใช้วันที่ปัจจุบัน: ${today}`);
    
    return today;
}

/**
 * ฟังก์ชันทำความสะอาดชื่อ - ตัดคำที่ไม่เกี่ยวข้องออก
 */
function cleanCellName(name) {
    if (!name) return name;
    
    return name
        .replace(/^รวมยอดของ\s+/g, '')   // ตัด "รวมยอดของ "
        .replace(/^ยอดรวมของ\s+/g, '')   // ตัด "ยอดรวมของ "
        .replace(/^รวมของ\s+/g, '')      // ตัด "รวมของ "
        .replace(/^ของ\s+/g, '')         // ตัด "ของ "
        .trim();
}

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
        // รูปแบบ: "คุณกิตติพงษ์0818093946 /ก-02" หรือ "  บริษัท 02-4497756-8 /A-01" หรือ "รวมยอดของ คุณฐาปนี0999145651 /ง-01"
        const salesMatch = firstCol.match(/^[\s]*(.*?)(\d{10})[\s]*\/([A-Z0-9ก-ฮอ\-]+)$/);
        if (salesMatch) {
            let rawName = salesMatch[1].trim()
                .replace(/^บริษัท\s*/, '')
                .replace(/^\d{2}-\d{7}-\d\s*/, '');
            
            // ✅ ทำความสะอาดชื่อ - ตัดคำที่ไม่เกี่ยวข้อง
            rawName = cleanCellName(rawName);
            
            currentSales = {
                name: rawName,
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
            let rawCustomerName = customerMatch[1].trim();
            
            // ✅ ทำความสะอาดชื่อลูกค้าด้วย
            rawCustomerName = cleanCellName(rawCustomerName);
            
            currentCustomer = {
                name: rawCustomerName,
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

/**
 * ตรวจสอบข้อมูลซ้ำในฐานข้อมูล (ตาม report_date)
 */
async function checkDuplicateData(date) {
    try {
        const { data, error, count } = await window.supabaseClient
            .from('sales_data')
            .select('id', { count: 'exact', head: true })
            .eq('report_date', date);

        if (error) throw error;
        
        return count || 0;
    } catch (error) {
        console.error('Error checking duplicates:', error);
        return 0;
    }
}

/**
 * แสดง Dialog เลือกวิธีการ Import
 */
async function showImportOptionsDialog() {
    return new Promise((resolve) => {
        // สร้าง modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            font-family: 'Kanit', sans-serif;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
                <h2 style="margin: 0 0 1rem 0; color: #3a7d44; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="material-icons">help_outline</span>
                    เลือกวิธีการนำเข้าข้อมูล
                </h2>
                <p style="color: #666; margin-bottom: 1.5rem;">
                    พบข้อมูลในฐานข้อมูลแล้ว กรุณาเลือกวิธีการที่ต้องการ:
                </p>
                
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <button id="optionAdd" style="
                        padding: 1rem;
                        border: 2px solid #3a7d44;
                        background: white;
                        border-radius: 8px;
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#f0f8f0'" onmouseout="this.style.background='white'">
                        <div style="font-weight: 600; color: #3a7d44; margin-bottom: 0.3rem;">
                            ➕ เพิ่มข้อมูลใหม่
                        </div>
                        <div style="font-size: 0.9rem; color: #666;">
                            เก็บข้อมูลเก่าไว้ทั้งหมด + เพิ่มข้อมูลใหม่เข้าไป (อาจซ้ำได้)
                        </div>
                    </button>

                    <button id="optionReplace" style="
                        padding: 1rem;
                        border: 2px solid #ff9800;
                        background: white;
                        border-radius: 8px;
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#fff8f0'" onmouseout="this.style.background='white'">
                        <div style="font-weight: 600; color: #ff9800; margin-bottom: 0.3rem;">
                            🔄 แทนที่ข้อมูลวันนี้
                        </div>
                        <div style="font-size: 0.9rem; color: #666;">
                            ลบข้อมูลเก่าวันที่ "<b>${reportDate || 'ไม่ระบุ'}</b>" + เพิ่มข้อมูลใหม่
                        </div>
                    </button>

                    <button id="optionDeleteAll" style="
                        padding: 1rem;
                        border: 2px solid #f44336;
                        background: white;
                        border-radius: 8px;
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='#fff0f0'" onmouseout="this.style.background='white'">
                        <div style="font-weight: 600; color: #f44336; margin-bottom: 0.3rem;">
                            🗑️ ลบทั้งหมดแล้วเริ่มใหม่
                        </div>
                        <div style="font-size: 0.9rem; color: #666;">
                            ลบข้อมูลทั้งหมดในตาราง sales_data + เพิ่มข้อมูลใหม่ (ระวัง!)
                        </div>
                    </button>

                    <button id="optionCancel" style="
                        padding: 0.8rem;
                        border: 1px solid #ccc;
                        background: white;
                        border-radius: 8px;
                        cursor: pointer;
                        color: #666;
                        margin-top: 0.5rem;
                    ">
                        ❌ ยกเลิก
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Event listeners
        document.getElementById('optionAdd').onclick = () => {
            document.body.removeChild(modal);
            resolve('add');
        };
        document.getElementById('optionReplace').onclick = () => {
            document.body.removeChild(modal);
            resolve('replace');
        };
        document.getElementById('optionDeleteAll').onclick = () => {
            const confirmDelete = confirm('⚠️ คุณแน่ใจหรือไม่? การลบข้อมูลทั้งหมดไม่สามารถกู้คืนได้!');
            if (confirmDelete) {
                document.body.removeChild(modal);
                resolve('deleteAll');
            }
        };
        document.getElementById('optionCancel').onclick = () => {
            document.body.removeChild(modal);
            resolve('cancel');
        };
    });
}

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

    // ✅ ตรวจสอบ supabaseClient
    console.log('🔍 Checking Supabase client...');
    console.log('window.supabaseClient:', window.supabaseClient);
    
    if (!window.supabaseClient) {
        console.error('❌ Supabase client not available');
        showAlert('❌ ไม่สามารถเชื่อมต่อ Supabase ได้ กรุณารีเฟรชหน้า', 'error');
        return;
    }

    console.log('✅ Supabase client is available');

    // ✅ ใช้วันที่ของข้อมูล (reportDate) แทนวันที่อัพโหลด
    let finalFileName = fileName;
    
    if (reportDate) {
        const ext = fileName.split('.').pop();
        const nameWithoutExt = fileName.replace(`.${ext}`, '');
        finalFileName = `${nameWithoutExt}_${reportDate}.${ext}`;
        console.log('📅 Using report date in filename:', finalFileName);
        showProcessLog('info', `📅 ชื่อไฟล์: ${finalFileName}`);
    } else {
        // fallback: ใช้วันที่อัพโหลด
        const today = new Date().toISOString().split('T')[0];
        const ext = fileName.split('.').pop();
        const nameWithoutExt = fileName.replace(`.${ext}`, '');
        finalFileName = `${nameWithoutExt}_${today}.${ext}`;
        console.log('📅 Using upload date in filename:', finalFileName);
    }

    // ✅ ตรวจสอบข้อมูลซ้ำ
    showAlert('🔍 กำลังตรวจสอบข้อมูลซ้ำ...', 'info');
    const existingCount = await checkDuplicateData(reportDate);
    
    let importMode = 'add'; // default
    
    if (existingCount > 0) {
        console.log(`⚠️ Found ${existingCount} existing records for date ${reportDate}`);
        showAlert(`⚠️ พบข้อมูลเดิมวันที่ ${reportDate} จำนวน ${existingCount} รายการ กรุณาเลือกวิธีการ`, 'warning');
        
        importMode = await showImportOptionsDialog();
        
        if (importMode === 'cancel') {
            console.log('⏹️ User cancelled');
            showAlert('ยกเลิกการนำเข้าข้อมูล', 'info');
            return;
        }
    }

    console.log('✅ Import mode:', importMode);

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
        // ✅ จัดการข้อมูลเก่าตาม mode
        if (importMode === 'replace') {
            showProcessLog('info', `🗑️ กำลังลบข้อมูลเก่าวันที่ "${reportDate}"...`);
            const { error: deleteError } = await window.supabaseClient
                .from('sales_data')
                .delete()
                .eq('report_date', reportDate); // ✅ ลบตามวันที่ของข้อมูล
            
            if (deleteError) {
                console.error('❌ Delete error:', deleteError);
                throw new Error(`ลบข้อมูลเก่าล้มเหลว: ${deleteError.message}`);
            }
            showProcessLog('success', '✅ ลบข้อมูลเก่าสำเร็จ');
            
        } else if (importMode === 'deleteAll') {
            showProcessLog('info', '🗑️ กำลังลบข้อมูลทั้งหมดในตาราง...');
            const { error: deleteError } = await window.supabaseClient
                .from('sales_data')
                .delete()
                .neq('id', 0); // ลบทั้งหมด
            
            if (deleteError) {
                console.error('❌ Delete all error:', deleteError);
                throw new Error(`ลบข้อมูลทั้งหมดล้มเหลว: ${deleteError.message}`);
            }
            showProcessLog('success', '✅ ลบข้อมูลทั้งหมดสำเร็จ');
        }

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
                report_date: reportDate || new Date().toISOString().split('T')[0], // ✅ เพิ่ม: วันที่ของข้อมูล
                import_by: window.currentUser?.display_name || window.currentUser?.email || 'Unknown',
                import_filename: finalFileName // ✅ ใช้ชื่อไฟล์ที่มีวันที่
            };
        });

        console.log('✅ Data prepared:', dataToInsert.length, 'records');
        console.log('📝 First record to insert:', dataToInsert[0]);

        // ✅ ตรวจจับและกรองข้อมูลซ้ำภายในไฟล์ก่อนส่ง
        showProcessLog('info', '🔍 กำลังตรวจสอบข้อมูลซ้ำภายในไฟล์...');
        const uniqueDataMap = new Map();
        
        dataToInsert.forEach((record, index) => {
            // ✅ ใช้ report_date แทน import_filename ใน unique key
            const key = `${record.sales_code}|${record.customer_code}|${record.product_code}|${record.report_date}`;
            
            if (!uniqueDataMap.has(key)) {
                uniqueDataMap.set(key, record);
            } else {
                console.log(`⚠️ พบข้อมูลซ้ำภายในไฟล์ที่แถว ${index + 1}:`, record.product_name);
            }
        });

        const uniqueData = Array.from(uniqueDataMap.values());
        const duplicateCount = dataToInsert.length - uniqueData.length;
        
        if (duplicateCount > 0) {
            console.log(`⚠️ พบข้อมูลซ้ำ ${duplicateCount} รายการภายในไฟล์`);
            showProcessLog('warning', `⚠️ กรองข้อมูลซ้ำออก ${duplicateCount} รายการ`);
        }
        
        showProcessLog('success', `✅ เตรียมข้อมูลพร้อมส่ง ${uniqueData.length} รายการ`);

        // แบ่งเป็น batch
        const batchSize = 100;
        let totalInserted = 0;
        let totalUpdated = 0;

        console.log('🔢 Total batches:', Math.ceil(uniqueData.length / batchSize));

        for (let i = 0; i < uniqueData.length; i += batchSize) {
            const batch = uniqueData.slice(i, i + batchSize);
            const batchNumber = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(uniqueData.length / batchSize);
            
            console.log(`📤 Batch ${batchNumber}/${totalBatches}: Inserting ${batch.length} records...`);
            showProcessLog('info', `📤 กำลังบันทึก ${i + 1}-${Math.min(i + batchSize, uniqueData.length)} จาก ${uniqueData.length}...`);

            try {
                // ✅ ใช้ upsert แทน insert เพื่อป้องกันข้อมูลซ้ำ
                const { data, error, count } = await window.supabaseClient
                    .from('sales_data')
                    .upsert(batch, {
                        onConflict: 'sales_code,customer_code,product_code,report_date', // ✅ ใช้ report_date แทน import_filename
                        ignoreDuplicates: false, // อัพเดทถ้าซ้ำ
                        count: 'exact'
                    });

                if (error) {
                    console.error('❌ Supabase upsert error:', error);
                    console.error('Error details:', {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code
                    });
                    
                    // ✅ แสดง error ที่เข้าใจง่าย
                    let errorMsg = error.message;
                    
                    if (error.message.includes('unique constraint')) {
                        errorMsg = '⚠️ ตรวจพบ Unique Constraint Error\n\n' +
                                   'กรุณาตรวจสอบ:\n' +
                                   '1. Constraint ถูกสร้างแล้วหรือยัง?\n' +
                                   '2. มีข้อมูลซ้ำในฐานข้อมูลหรือไม่?\n\n' +
                                   'รายละเอียด: ' + error.message;
                    } else if (error.message.includes('ON CONFLICT')) {
                        errorMsg = '⚠️ ไม่สามารถบันทึกข้อมูลได้\n\n' +
                                   'สาเหตุที่เป็นไปได้:\n' +
                                   '1. ยังไม่ได้สร้าง Unique Constraint ในตาราง sales_data\n' +
                                   '2. มีข้อมูลซ้ำหลายรายการในไฟล์\n\n' +
                                   'แนะนำ: ให้รัน SQL ในไฟล์ setup_sales_data_constraints.sql ก่อน\n\n' +
                                   'รายละเอียด: ' + error.message;
                    }
                    
                    throw new Error(errorMsg);
                }

                totalInserted += batch.length;
                console.log(`✅ Batch ${batchNumber} inserted/updated successfully`);
                showProcessLog('success', `✅ บันทึกสำเร็จ ${totalInserted} รายการ`);
                
            } catch (batchError) {
                console.error('❌ Batch error:', batchError);
                
                // ✅ แสดง Alert Popup ที่ชัดเจน
                const errorAlert = document.createElement('div');
                errorAlert.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    padding: 2rem;
                    border-radius: 12px;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    z-index: 10001;
                    max-width: 600px;
                    width: 90%;
                    font-family: 'Kanit', sans-serif;
                `;
                
                errorAlert.innerHTML = `
                    <h2 style="color: #f44336; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                        <span class="material-icons" style="font-size: 2rem;">error</span>
                        เกิดข้อผิดพลาดในการบันทึก
                    </h2>
                    <div style="background: #fff3f3; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; white-space: pre-wrap; font-size: 0.9rem; color: #333;">
${batchError.message}
                    </div>
                    <button onclick="this.parentElement.remove()" style="
                        width: 100%;
                        padding: 0.8rem;
                        background: #f44336;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1rem;
                        font-family: 'Kanit', sans-serif;
                    ">
                        ปิด
                    </button>
                `;
                
                document.body.appendChild(errorAlert);
                
                throw batchError;
            }
        }

        console.log('🎉 Import completed:', totalInserted, 'records');
        showProcessLog('success', `🎉 บันทึกข้อมูลทั้งหมดสำเร็จ! (${totalInserted} รายการ)`);
        
        // ✅ แสดง Success Popup
        const successAlert = document.createElement('div');
        successAlert.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10001;
            max-width: 500px;
            width: 90%;
            font-family: 'Kanit', sans-serif;
            text-align: center;
        `;
        
        successAlert.innerHTML = `
            <div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>
            <h2 style="color: #3a7d44; margin: 0 0 1rem 0;">
                บันทึกข้อมูลสำเร็จ!
            </h2>
            <div style="background: #f0f8f0; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div style="font-size: 1.2rem; font-weight: 600; color: #3a7d44;">
                    ${totalInserted.toLocaleString()} รายการ
                </div>
                <div style="font-size: 0.9rem; color: #666; margin-top: 0.5rem;">
                    ${duplicateCount > 0 ? `(กรองข้อมูลซ้ำออก ${duplicateCount} รายการ)` : ''}
                </div>
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-bottom: 1rem;">
                ไฟล์: <strong>${finalFileName}</strong>
            </div>
            <button onclick="this.parentElement.remove()" style="
                width: 100%;
                padding: 0.8rem;
                background: #3a7d44;
                color: white;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 1rem;
                font-family: 'Kanit', sans-serif;
            ">
                ปิด
            </button>
        `;
        
        document.body.appendChild(successAlert);
        
        // ปิดอัตโนมัติหลัง 5 วินาที
        setTimeout(() => {
            if (successAlert.parentElement) {
                successAlert.remove();
            }
        }, 5000);
        
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