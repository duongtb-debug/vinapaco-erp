/**
 * VINAPACO-ERP: LOGIC HỆ THỐNG ĐÃ TÍCH HỢP TOÀN DIỆN
 * Bao gồm: Khôi phục chức năng đọc data.json cũ và Module xử lý Excel mới
 */

// --- 1. LOGIC CHUYỂN ĐỔI TAB GIAO DIỆN MƯỢT MÀ ---
function switchTab(tabName) {
    // Ẩn tất cả nội dung tab
    document.getElementById('tab-ho-so').style.display = 'none';
    document.getElementById('tab-nhan-su').style.display = 'none';
    
    // Bỏ kích hoạt class active trên menu nút
    document.getElementById('btn-tab-ho-so').classList.remove('active');
    document.getElementById('btn-tab-nhan-su').classList.remove('active');

    // Kích hoạt tab được chọn hiển thị lên
    if (tabName === 'ho-so') {
        document.getElementById('tab-ho-so').style.display = 'block';
        document.getElementById('btn-tab-ho-so').classList.add('active');
    } else if (tabName === 'nhan-su') {
        document.getElementById('tab-nhan-su').style.display = 'block';
        document.getElementById('btn-tab-nhan-su').classList.add('active');
    }
}

// --- 2. KHÔI PHỤC: ĐỌC VÀ HIỂN THỊ DỮ LIỆU GỐC TỪ DATA.JSON ---
function tailaiDuLieuGoc() {
    const tableBody = document.getElementById('hoSoTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-4"><div class="spinner-border spinner-border-sm text-primary"></div> Đang kết nối file data.json...</td></tr>`;

    // Gọi file dữ liệu gốc data.json theo đường dẫn tương đối (An toàn tuyệt đối cho GitHub Pages)
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Không thể tìm thấy file hoặc cấu hình lỗi tải dữ liệu.');
            }
            return response.json();
        })
        .then(data => {
            tableBody.innerHTML = ''; // Xóa thông báo đang tải

            // Trường hợp file JSON trống hoặc không có mảng dữ liệu
            if (!data || data.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-warning py-3">Cảnh báo: File data.json rỗng hoặc sai cấu trúc mảng.</td></tr>`;
                return;
            }

            // Tiến hành quét mảng dữ liệu gốc và hiển thị lại toàn bộ lên màn hình
            data.forEach((item, index) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${index + 1}</td>
                    <td><span class="badge bg-secondary">${item.id || item.maTaiLieu || 'Trống'}</span></td>
                    <td><strong>${item.name || item.tenHoSo || 'Không có tên'}</strong></td>
                    <td>${item.department || item.phongBan || 'Chưa phân phối'}</td>
                    <td><span class="text-success">● Đang hoạt động</span></td>
                `;
                tableBody.appendChild(tr);
            });
        })
        .catch(error => {
            console.error('Lỗi Hệ Thống:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-3">❌ Lỗi: ${error.message}. Hãy chắc chắn file data.json nằm cùng thư mục với index.html</td></tr>`;
        });
}

// --- 3. BỔ SUNG MỚI: MODULE TIẾP NHẬN FILE EXCEL DANH SÁCH NHÂN SỰ ---
document.addEventListener("DOMContentLoaded", function() {
    // Khởi động chạy ngay tính năng tải dữ liệu gốc khi mở trang web
    tailaiDuLieuGoc();

    const excelFileInput = document.getElementById('excelFile');
    const dropZone = document.getElementById('dropZone');
    const uploadStatus = document.getElementById('uploadStatus');
    const previewCard = document.getElementById('previewCard');
    const excelTableBody = document.getElementById('excelTableBody');
    const btnSaveExcelData = document.getElementById('btnSaveExcelData');
    
    let tempExcelData = []; // Mảng tạm lưu dữ liệu Excel sau xử lý rà soát lỗi

    if (!excelFileInput || !dropZone) return;

    // Thiết lập kéo thả file trực quan
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#e9ecef'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.background = '#fff'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.background = '#fff';
        if (e.dataTransfer.files.length > 0) {
            excelFileInput.files = e.dataTransfer.files;
            docFileExcel();
        }
    });

    excelFileInput.addEventListener('change', docFileExcel);

    function docFileExcel() {
        const file = excelFileInput.files[0];
        if (!file) return;

        uploadStatus.innerHTML = `<div class="spinner-border spinner-border-sm text-primary"></div> Hệ thống đang phân tích cấu trúc cột Excel...`;
        
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = function(e) {
            try {
                const arrayBuffer = e.target.result;
                const data = new Uint8Array(arrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Đọc dữ liệu từ Sheet đầu tiên
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length === 0) {
                    throw new Error("File tải lên hoàn toàn trống, không tìm thấy dữ liệu dòng.");
                }

                kiemTraVaHienThiPreview(jsonData);
            } catch (err) {
                uploadStatus.innerHTML = `<div class="alert alert-danger">❌ Thất bại: ${err.message}</div>`;
                previewCard.classList.add('d-none');
            }
        };
    }

    function kiemTraVaHienThiPreview(data) {
        excelTableBody.innerHTML = "";
        tempExcelData = [];
        let phatHienLoi = false;

        data.forEach(row => {
            // Chuẩn hóa loại bỏ khoảng trắng thừa
            const maNV = row['Mã Nhân Viên']?.toString().trim() || '';
            const tenNV = row['Họ Và Tên']?.toString().trim() || '';
            const chucVu = row['Chức Vụ']?.toString().trim() || '';
            const phongBan = row['Phòng Ban']?.toString().trim() || '';
            const sdt = row['Số Điện Thoại']?.toString().trim() || '';
            const email = row['Email']?.toString().trim() || '';

            // Khởi tạo bộ quy tắc kiểm tra (Validate) dữ liệu chính xác nhất
            let danhSachLoi = [];
            if (!maNV) danhSachLoi.push("Thiếu Mã NV");
            if (!tenNV) danhSachLoi.push("Thiếu Họ Tên");
            if (sdt && !/^[0-9]{9,11}$/.test(sdt)) danhSachLoi.push("SĐT sai định dạng");
            if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) danhSachLoi.push("Email không hợp lệ");

            const hopLe = danhSachLoi.length === 0;
            if (!hopLe) phatHienLoi = true;

            // Đưa dữ liệu lên bảng preview
            const tr = document.createElement('tr');
            if (!hopLe) tr.classList.add('error-row');

            tr.innerHTML = `
                <td>${maNV || '<span class="text-danger">Trống</span>'}</td>
                <td>${tenNV || '<span class="text-danger">Trống</span>'}</td>
                <td>${chucVu}</td>
                <td>${phongBan}</td>
                <td>${sdt}</td>
                <td>${email}</td>
                <td>${hopLe ? '<span class="badge bg-success">✓ Đạt chuẩn</span>' : `<span class="error-text">⚠️ ${danhSachLoi.join(', ')}</span>`}</td>
            `;
            excelTableBody.appendChild(tr);

            tempExcelData.push({ maNV, tenNV, chucVu, phongBan, sdt, email, hopLe });
        });

        // Cập nhật trạng thái thông báo
        uploadStatus.innerHTML = `<div class="alert alert-success">✅ Đã tải cấu trúc xong. Phát hiện tổng cộng ${data.length} nhân viên.</div>`;
        previewCard.classList.remove('d-none');

        // Nếu file có lỗi, khóa nút xác nhận, yêu cầu làm sạch dữ liệu
        if (phatHienLoi) {
            btnSaveExcelData.disabled = true;
            btnSaveExcelData.className = "btn btn-danger";
            btnSaveExcelData.innerText = "Từ chối nhập: File còn dòng lỗi";
        } else {
            btnSaveExcelData.disabled = false;
            btnSaveExcelData.className = "btn btn-success";
            btnSaveExcelData.innerText = "Xác Nhận Lưu Vào Hệ Thống";
        }
    }

    // Hành động lưu dữ liệu đã lọc sạch vào bộ nhớ trình duyệt
    btnSaveExcelData.addEventListener('click', function() {
        const dataSach = tempExcelData.filter(item => item.hopLe);
        
        // Lưu trữ an toàn cục bộ (Client-side) không lo ảnh hưởng đến Server GitHub Pages
        localStorage.setItem('ERP_DANH_SACH_NHAN_VIEN', JSON.stringify(dataSach));
        
        alert(`🎉 Thành công! Hệ thống đã tiếp nhận dữ liệu và lưu trữ chính xác ${dataSach.length} nhân sự mới.`);
    });
});
