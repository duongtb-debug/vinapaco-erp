// --- ĐOẠN CODE HOÀN CHỈNH FILE quanLyHoSo.js ---

function khoiTaoModuleNhanSuExcel() {
    const dropZone = document.getElementById('dropZoneNhanSu');
    const fileInput = document.getElementById('excelFileNhanSu');
    const uploadStatus = document.getElementById('uploadStatusNhanSu');
    const previewCard = document.getElementById('previewCardNhanSu');
    const tableBody = document.getElementById('excelTableBodyNhanSu');
    const btnSave = document.getElementById('btnSaveExcelDataNhanSu');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', xuLyFileExcelNhanSu);

    dropZone.addEventListener('dragover', (e) => { 
        e.preventDefault(); 
        dropZone.style.borderColor = '#10b981'; 
    });
    
    dropZone.addEventListener('dragleave', () => { 
        dropZone.style.borderColor = 'var(--primary-color)'; 
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            xuLyFileExcelNhanSu();
        }
    });

    function xuLyFileExcelNhanSu() {
        const file = fileInput.files[0];
        if (!file) return;

        uploadStatus.innerHTML = `⏳ Hệ thống đang tự động quét cấu trúc file Excel...`;

        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                
                // Đọc dữ liệu thô dạng mảng 2 chiều để tránh bỏ sót hàng tiêu đề ẩn
                const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                if (rawRows.length === 0) {
                    throw new Error("File Excel không có dữ liệu.");
                }

                // Tìm hàng chứa tiêu đề thực sự (chứa chữ 'Họ và tên' hoặc 'hoten')
                let headerIndex = -1;
                for (let i = 0; i < rawRows.length; i++) {
                    const row = rawRows[i];
                    if (row && row.some(cell => {
                        const txt = (cell || '').toString().toLowerCase().trim();
                        return txt.includes('họ và tên') || txt.includes('hoten') || txt.includes('chức danh');
                    })) {
                        headerIndex = i;
                        break;
                    }
                }

                // Nếu không tìm thấy tiêu đề đặc trưng, mặc định lấy hàng có dữ liệu đầu tiên làm tiêu đề
                if (headerIndex === -1) {
                    headerIndex = 0;
                }

                // Chuyển đổi lại thành JSON chuẩn bắt đầu từ hàng tiêu đề vừa tìm được
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerIndex });

                thamDinhVaHienThiNhanSu(jsonData);
            } catch (error) {
                uploadStatus.innerHTML = `<span class="error-text">❌ Lỗi đọc file: ${error.message}</span>`;
                if (previewCard) previewCard.classList.add('d-none');
            }
        };
    }

    function thamDinhVaHienThiNhanSu(data) {
        if (!tableBody) return;
        tableBody.innerHTML = "";
        tempNhanSuExcelData = [];

        // Hàm dọn dẹp chữ để so sánh cột thông minh
        const chuanHoaTenCot = (str) => {
            if (!str) return "";
            return str.toString()
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/đ/g, "d")
                .replace(/[^a-z0-9]/g, ""); // Bỏ hết dấu, khoảng trắng và ký tự đặc biệt
        };

        let countSuccess = 0;

        data.forEach(row => {
            let maNV = "", tenNV = "", chucVu = "", phongBan = "", sdt = "", email = "";

            // Duyệt từng ô trong hàng để map thông minh vào các trường tương ứng
            Object.keys(row).forEach(key => {
                const cotSach = chuanHoaTenCot(key);
                const giaTri = (row[key] || '').toString().trim();

                if (!giaTri) return;

                // Map cột Họ và Tên
                if (cotSach.includes('hovaten') || cotSach === 'hoten' || cotSach === 'tennhanvien') {
                    tenNV = giaTri;
                }
                // Map cột Chức danh công việc / Chức vụ
                else if (cotSach.includes('chucdanh') || cotSach.includes('chucvu') || cotSach === 'vitri') {
                    chucVu = giaTri;
                }
                // Map cột Mã nhân viên hoặc dùng tạm Số sổ BHXH / CCCD nếu file không có mã riêng
                else if (cotSach === 'manv' || cotSach === 'manhanvien' || cotSach.includes('sosobhxh') || cotSach.includes('socccd') || cotSach === 'stt') {
                    if (!maNV) maNV = giaTri; // Ưu tiên lấy giá trị đầu tiên tìm thấy làm mã định danh
                }
                // Map cột Phòng ban / Đơn vị
                else if (cotSach.includes('phongban') || cotSach.includes('donvi') || cotSach.includes('bophan')) {
                    phongBan = giaTri;
                }
                // Map cột Số điện thoại
                else if (cotSach.includes('sodienthoai') || cotSach === 'sdt' || cotSach.includes('telephone')) {
                    sdt = giaTri;
                }
                // Map cột Email
                else if (cotSach === 'email') {
                    email = giaTri;
                }
            });

            // Nếu hàng trống hoàn toàn hoặc không có tên thì bỏ qua không xử lý
            if (!tenNV && !maNV) return;

            // Thẩm định tính hợp lệ
            let validationErrors = [];
            if (!maNV) validationErrors.push("Thiếu Mã NV/Số định danh");
            if (!tenNV) validationErrors.push("Thiếu Họ & Tên");

            const checkHopLe = validationErrors.length === 0;
            if (checkHopLe) countSuccess++;

            const tr = document.createElement('tr');
            if (!checkHopLe) tr.classList.add('error-row');

            tr.innerHTML = `
                <td>${maNV || '<span class="text-danger">Thiếu</span>'}</td>
                <td>${tenNV || '<span class="text-danger">Thiếu</span>'}</td>
                <td>${chucVu || '<span class="text-muted">Không có</span>'}</td>
                <td>${phongBan || '<span class="text-muted">Tổng công ty</span>'}</td>
                <td>${sdt || '<span class="text-muted">-</span>'}</td>
                <td>${email || '<span class="text-muted">-</span>'}</td>
                <td>${checkHopLe ? '<span class="status-pill status-good">✓ Hợp Lệ</span>' : `<span class="error-text">⚠️ ${validationErrors.join(', ')}</span>`}</td>
            `;
            tableBody.appendChild(tr);

            tempNhanSuExcelData.push({ maNV, tenNV, chucVu, phongBan, sdt, email, hopLe: checkHopLe });
        });

        if (uploadStatus) {
            uploadStatus.innerHTML = `<span style="color:var(--success-color); font-weight:bold;">✅ Đã nhận diện thông minh! Đã quét được ${tempNhanSuExcelData.length} dòng (Hợp lệ: ${countSuccess}).</span>`;
        }
        if (previewCard) previewCard.classList.remove('d-none');
        if (btnSave) btnSave.disabled = false;
    }

    if (btnSave) {
        btnSave.addEventListener('click', function() {
            const dataSach = tempNhanSuExcelData.filter(item => item.hopLe);
            if (dataSach.length === 0) {
                alert("⚠️ Không có nhân sự nào hợp lệ để lưu vào hệ thống.");
                return;
            }
            localStorage.setItem('DANH_SACH_NHAN_VIEN_IMPORT', JSON.stringify(dataSach));
            alert(`🎉 Thành công! Đã lưu dữ liệu của ${dataSach.length} nhân sự vào hệ thống.`);
        });
    }
}
