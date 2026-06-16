/**
 * DỰ ÁN: VINAPACO-ERP
 * MODULE: QUAN LÝ VÀ CẬP NHẬT HỒ SƠ CHỨNG TỪ THANH TOÁN (SUPABASE)
 */

// Biến toàn cục lưu trữ dữ liệu của hồ sơ đang thực hiện sửa đổi
let hoSoHienTai = null;

/**
 * CHỨC NĂNG 1: ĐỔ DỮ LIỆU CŨ LÊN FORM ĐỂ CHUẨN BỊ SỬA
 * @param {Object} hoSoData - Đối tượng hồ sơ được chọn từ hàng trong bảng dữ liệu
 */
export function moFormSua(hoSoData) {
    // Kiểm tra tính hợp lệ của dữ liệu đầu vào để tránh lỗi "Cannot read properties of null"
    if (!hoSoData || !hoSoData.id) {
        console.error("Lỗi dữ liệu đầu vào hàm moFormSua:", hoSoData);
        alert("Không thể mở form: Dữ liệu hồ sơ trống hoặc thiếu ID bản ghi!");
        return;
    }

    // 1. Lưu thông tin hồ sơ vào biến tạm toàn cục
    hoSoHienTai = hoSoData;

    // 2. Điền dữ liệu cũ vào các ô nhập liệu (Input) trên giao diện Form của bạn
    // Chú ý: Thay thế các chuỗi ID phía dưới bằng đúng ID HTML thực tế trong dự án của bạn nếu cần
     gánGiaTriInput('ID_INPUT_TEN_HO_SO', hoSoData.ten_ho_so || '');
     gánGiaTriInput('ID_INPUT_TONG_TIEN', hoSoData.tong_tien || 0);

    // 3. Hiển thị thông tin hoặc đường link dẫn tới file chứng từ cũ (nếu có)
    const vungHienThiFileCu = document.getElementById('ID_LABEL_FILE_CU');
    if (vungHienThiFileCu) {
        if (hoSoData.link_minh_chung) {
            vungHienThiFileCu.innerHTML = `
                <span style="color: #2e7d32; font-weight: bold;">✓ Hồ sơ đã có file chứng từ:</span> 
                <a href="${hoSoData.link_minh_chung}" target="_blank" style="color: #1565c0; text-decoration: underline; margin-left: 5px;">
                    Xem file hiện tại
                </a>`;
        } else {
            vungHienThiFileCu.innerHTML = `<span style="color: #ef6c00; font-style: italic;">Hồ sơ này hiện chưa được đính kèm file chứng từ nào.</span>`;
        }
    }

    // 4. Kích hoạt hiển thị Form/Modal sửa (Thay ID_MODAL_SUA bằng ID khung Pop-up của bạn)
    const modalSua = document.getElementById('ID_MODAL_SUA');
    if (modalSua) {
        modalSua.style.display = 'block';
    } else {
        console.warn("Không tìm thấy phần tử hiển thị Form Modal với ID: ID_MODAL_SUA");
    }
}

/**
 * CHỨC NĂNG 2: XỬ LÝ LƯU CẬP NHẬT LÊN SUPABASE (STORAGE & DATABASE)
 * Hàm này tự động bóc tách file, sửa lỗi mất đuôi file, bật 'upsert: true' chống lỗi 404
 */
export async function xuLyLuuCapNhat() {
    // Kiểm tra điều kiện chặn: Phải có hồ sơ đang được chọn sửa
    if (!hoSoHienTai || !hoSoHienTai.id) {
        alert("Lỗi hệ thống: Không xác định được ID hồ sơ cần cập nhật!");
        return;
    }

    // Lấy đối tượng nút bấm để xử lý hiệu ứng loading khóa tương tác
    const btnLuu = document.getElementById('ID_NUT_LUU');
    
    try {
        // Thiết lập trạng thái chờ xử lý cho nút bấm
        if (btnLuu) { 
            btnLuu.disabled = true; 
            btnLuu.innerText = "Đang xử lý dữ liệu..."; 
        }

        // 1. Thu thập dữ liệu mới người dùng vừa chỉnh sửa trên Form
        const tenHoSoMoi = document.getElementById('ID_INPUT_TEN_HO_SO').value.trim();
        const tongTienMoi = document.getElementById('ID_INPUT_TONG_TIEN').value;
        
        // Lấy thông tin tệp tin mới nếu người dùng chọn thay đổi file
        const khungChonFile = document.getElementById('ID_INPUT_FILE_MINH_CHUNG');
        const fileMinhChungMoi = khungChonFile && khungChonFile.files ? khungChonFile.files[0] : null;

        // Mặc định: Giữ nguyên đường link file cũ đang có trong Database
        let linkMinhChungCuoiCung = hoSoHienTai.link_minh_chung;

        // 2. NẾU CÓ CHỌN FILE MỚI -> TIẾN HÀNH XỬ LÝ ĐẨY LÊN SUPABASE STORAGE
        if (fileMinhChungMoi) {
            
            // 2.1. Trích xuất đuôi file gốc (.pdf, .png, .jpg...) bảo vệ định dạng tệp, tránh lỗi trắng trang 404
            const tenFileGoc = fileMinhChungMoi.name;
            const viTriDauCham = tenFileGoc.lastIndexOf('.');
            if (viTriDauCham === -1) {
                throw new Error("Tệp tin được chọn không hợp lệ hoặc thiếu phần mở rộng (đuôi file)!");
            }
            const duoiFile = tenFileGoc.slice(viTriDauCham);

            // 2.2. Tạo cấu trúc tên file chuẩn lưu trữ trên hệ thống dựa vào Mã hồ sơ hoặc ID
            const maDinhDanh = hoSoHienTai.ma_ho_so || `HS-${hoSoHienTai.id}-${Date.now()}`;
            const nameFileDinhDangMoi = `${maDinhDanh}${duoiFile}`;

            // 2.3. Thực hiện tải file lên Bucket 'chung_tu_thanh_toan'
            // Đã tích hợp tham số cấu hình { upsert: true } cho phép sửa đổi và ghi đè file cũ thành công
            const { data: storageData, error: storageError } = await supabase.storage
                .from('chung_tu_thanh_toan')
                .upload(nameFileDinhDangMoi, fileMinhChungMoi, { upsert: true });

            if (storageError) {
                throw new Error("Lỗi kho lưu trữ (Storage): " + storageError.message);
            }

            // 2.4. Khởi tạo đường link công khai (Public URL) mới cho file chứng từ này
            const { data: urlData } = supabase.storage
                .from('chung_tu_thanh_toan')
                .getPublicUrl(nameFileDinhDangMoi);

            linkMinhChungCuoiCung = urlData.publicUrl;
        }

        // 3. TIẾN HÀNH CẬP NHẬT TOÀN BỘ THÔNG TIN MỚI VÀO DATABASE
        // Ghi chú: Hãy đảm bảo 'ho_so_thanh_toan' khớp chính xác với tên bảng dữ liệu của bạn trên Supabase
        const { error: dbError } = await supabase
            .from('ho_so_thanh_toan')
            .update({
                ten_ho_so: tenHoSoMoi,
                tong_tien: tongTienMoi,
                link_minh_chung: linkMinhChungCuoiCung, // Cập nhật link mới hoặc giữ link cũ
                updated_at: new Date().toISOString()
            })
            .eq('id', hoSoHienTai.id); // Chỉ cập nhật đúng dòng bản ghi đang sửa

        if (dbError) {
            throw new Error("Lỗi cơ sở dữ liệu (Database): " + dbError.message);
        }

        // 4. XỬ LÝ SAU KHI CẬP NHẬT THÀNH CÔNG RỰC RỠ
        alert("Chúc mừng! Hệ thống đã cập nhật dữ liệu chứng từ thành công.");
        
        // 4.1. Đóng Form Modal (Ẩn pop-up đi)
        const modalSua = document.getElementById('ID_MODAL_SUA');
        if (modalSua) modalSua.style.display = 'none';
        
        // 4.2. Khôi phục ô chọn file về trạng thái rỗng
        if (khungChonFile) khungChonFile.value = "";

        // 4.3. Kích hoạt hàm làm mới/tải lại danh sách dữ liệu trên màn hình chính của bạn (nếu có)
        if (typeof taiLaiDanhSachHoSo === "function") {
            taiLaiDanhSachHoSo();
        }

    } catch (error) {
        console.error("Chi tiết lỗi phát sinh trong quá trình cập nhật:", error);
        alert("Cập nhật thất bại: " + error.message);
    } finally {
        // Luôn trả lại trạng thái ban đầu cho nút Lưu dù thành công hay thất bại
        if (btnLuu) { 
            btnLuu.disabled = false; 
            btnLuu.innerText = "Lưu cập nhật"; 
        }
    }
}

/**
 * Hàm hỗ trợ kiểm tra phần tử HTML trước khi gán dữ liệu để tránh crash ứng dụng
 */
function gánGiaTriInput(idPhanTu, giaTri) {
    const phanTu = document.getElementById(idPhanTu);
    if (phanTu) {
        phanTu.value = giaTri;
    } else {
        console.warn(`Không tìm thấy thẻ Input có id="${idPhanTu}" trên giao diện HTML.`);
    }
}
