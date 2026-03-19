// salesTransformer.js

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
        // รอให้ Supabase พร้อม
        while (!window.supabase) {
            await new Promise(r => setTimeout(r, 50));
        }
        
        // ป้องกันหน้า (admin/manager เท่านั้น)
        await protectPage(['admin', 'manager']);
        
        // รอให้ currentUser พร้อม
        while (!window.currentUser) {
            await new Promise(r => setTimeout(r, 50));
        }
        
        // เริ่มต้นระบบ
        initUpload();
    } catch (error) {
        console.error('Init error:', error);
        // ถ้า auth ไม่มี ให้ใช้งานได้ปกติ
        initUpload();
    }
})();

// ========================================
// Event Listeners Setup
// ========================================

function initUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    // Upload area click
    uploadArea.addEventListener('click', () => fileInput.click());
    
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
        handleFile(e.dataTransfer.files[0]);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    // Button events
    document.getElementById('exportBtn').addEventListener('click', exportCSV);
    document.getElementById('clearBtn').addEventListener('click', clearData);
    document.getElementById('clearFilterBtn').addEventListener('click', clearFilters);

    // Filter events
    document.getElementById('filterSales').addEventListener('change', applyFilters);
    document.getElementById('filterCustomer').addEventListener('change', applyFilters);
    document.getElementById('searchProduct').addEventListener('input', applyFilters);
}

// ========================================
// File Handling
// ========================================

async function handleFile(file) {
    if (!file) return;

    fileName = file.name;
    showAlert('กำลังอ่านไฟล์...', 'info');
    showProcessLog('info', '📂 เปิดไฟล์: ' + fileName);

    try {
        let rawData = null;

        // อ่าน Excel หรือ CSV
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            rawData = await readExcel(file);
        } else if (file.name.endsWith('.csv')) {
            rawData = await readCSV(file);
        } else {
            throw new Error('รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv');
        }

        showProcessLog('success', '✅ อ่านไฟล์สำเร็จ: ' + rawData.length + ' แถว');

        // แปลงข้อมูล
        transformedData = transformSalesReport(rawData);

        if (transformedData.length === 0) {
            throw new Error('ไม่พบข้อมูลที่สามารถแปลงได้');
        }

        showProcessLog('success', '✅ แปลงข้อมูลสำเร็จ: ' + transformedData.length + ' รายการ');

        // ตั้งค่า column ที่แสดงทั้งหมดเป็นค่าเริ่มต้น
        visibleColumns = new Set(Object.keys(transformedData[0]));

        // เริ่มต้น filters
        initFilters();
        filteredData = [...transformedData];
        
        // แสดงผล
        showPreview();
        showAlert('✅ ประมวลผลสำเร็จ!', 'success');

    } catch (error) {
        console.error('Process error:', error);
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