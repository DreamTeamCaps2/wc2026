# World Cup 2026 Match Tracker & Predictor - Project Memory

Tài liệu này lưu trữ toàn bộ kiến thức, cấu trúc kiến trúc, các quyết định thiết kế và cách thức vận hành của dự án **World Cup 2026 Match Tracker & Predictor** để phục vụ cho việc bảo trì hoặc phát triển tiếp nối.

---

## 1. Tổng quan Dự án
Ứng dụng web Single Page Application (SPA) viết bằng Vanilla JS và CSS, hiển thị danh sách 48 trận đấu vòng bảng FIFA World Cup 2026, cung cấp lịch thi đấu thực tế, tỷ số thời gian thực (giả lập theo giờ hệ thống), xem đội hình chi tiết từng đội bóng và dự đoán tỷ số thông minh bằng AI (hoặc bộ giả lập fallback).

---

## 2. Cấu trúc Thư mục & Vai trò File
```
wc2026/
├── server.py                     # Python HTTP Server & CORS Proxy (Cổng 8080)
├── build.bat                     # Lệnh chạy nhanh trên CMD: "build Run"
├── build.ps1                     # Lệnh chạy nhanh trên PowerShell: ".\build Run"
├── patch_clubs_wikidata_batch.py # Script tải thông tin câu lạc bộ từ Wikidata
├── Memory.md                     # Tài liệu này (Lịch sử & kiến thức dự án)
└── public/                       # Thư mục chứa tài nguyên tĩnh
    ├── index.html                # Cấu trúc HTML chính & modal containers
    ├── data/
    │   └── squads.json           # Cơ sở dữ liệu đội hình local & thông tin câu lạc bộ
    ├── css/
    │   └── styles.css            # Hệ thống Dark Theme Premium & Custom Scrollbars
    └── js/
        ├── app.js                # Quản lý vòng đời ứng dụng & sự kiện
        ├── components/
        │   ├── filterBar.js      # Bộ lọc trạng thái, bảng đấu & ô tìm kiếm
        │   ├── matchCard.js      # Giao diện Match Card kèm nút Đội hình (ℹ️) & Dự đoán
        │   ├── predictionModal.js# Modal Dự đoán AI, hiển thị 5 nguồn phân tích (cuộn toàn trang)
        │   └── teamModal.js      # Modal hiển thị danh sách cầu thủ chia theo vị trí & CLB chủ quản
        └── utils/
            └── api.js            # API Client, Cache, Fallback Simulator & Time Simulator
```

---

## 3. Các Giải pháp & Thiết kế Kiến trúc Quan trọng

### A. Cơ chế Vượt rào CORS & Tự động Nạp dữ liệu
* **Vấn đề**: Football-Data API chặn CORS trên trình duyệt đối với các cổng tùy chỉnh (như `:8080`).
* **Giải pháp**: Xây dựng một local Proxy Server viết bằng Python ([server.py](file:///d:/Code/Automation/wc2026/server.py)).
* **Tự động chuyển tiếp**: Trong [api.js](file:///d:/Code/Automation/wc2026/public/js/utils/api.js), client tự động kiểm tra nếu host là `localhost` hoặc `127.0.0.1` thì sẽ đổi endpoint gọi trực tiếp sang API proxy nội bộ (`/api/matches` và `/api/team?id={id}`).
* **API Key Cố định**: Thiết lập sẵn mã khóa API Key của Football-Data: `ae4fa7a0fdd2472b861033c12c518797` giúp ứng dụng tự động hoạt động ngay sau khi chạy server mà không cần cấu hình thủ công.

### B. Giả lập Trận đấu Theo Thời gian Thực (Time Simulator)
* Thay vì chỉ hiển thị các trận đấu ở trạng thái chờ (TIMED), ứng dụng có bộ máy giả lập trạng thái trận đấu tự động dựa trên thời gian thực tế của hệ thống:
  * **Trận đấu đã qua**: Tự động chuyển sang trạng thái `FINISHED`, giả lập tỷ số hợp lý và hiển thị nút Xem Dự đoán / Đội hình.
  * **Trận đấu đang diễn ra**: Tự động chuyển sang trạng thái `IN_PLAY` (Đang diễn ra), cập nhật tỷ số trực tiếp động và được đưa lên phần **"ĐANG DIỄN RA"** nổi bật với viền đỏ phát sáng chuyển động nhấp nháy.
  * **Trận đấu sắp diễn ra**: Giữ nguyên trạng thái `TIMED` kèm đếm ngược hoặc hiển thị giờ thi đấu theo múi giờ địa phương của người dùng.

### C. Bộ mô phỏng Dự đoán AI (Fallback Simulator)
* **Vấn đề**: Do hạn ngạch (quota) của các tài khoản miễn phí Gemini API thường bằng 0 hoặc cực kỳ giới hạn, ứng dụng dễ gặp lỗi đỏ khi dự đoán.
* **Giải pháp**: Tích hợp một bộ **Prediction Fallback Simulator** trong [api.js](file:///d:/Code/Automation/wc2026/public/js/utils/api.js#L130). Nếu phát hiện lỗi Quota/API Key, bộ giả lập sẽ phân tích các chỉ số sức mạnh của 2 đội bóng (dựa trên bảng xếp hạng và thực lực giả định) để tự động xuất ra kết quả dự đoán chi tiết:
  * Điểm số dự đoán sát thực tế.
  * Tỷ số cụ thể và ghi chú của 5 nguồn uy tín khác nhau (ví dụ: Opta, BBC Sport, ESPN, Sky Sports, Sporting News).
  * Điểm mạnh then chốt của từng đội tuyển.
  * Tỷ lệ phần trăm độ tin cậy.

### D. Đồng bộ Dữ liệu Đội tuyển & Tải Thông tin Câu lạc bộ từ Wikidata
* ** Wikidata Batch Query**: Sử dụng script [patch_clubs_wikidata_batch.py](file:///d:/Code/Automation/wc2026/patch_clubs_wikidata_batch.py) để gửi truy vấn Batch SPARQL thông qua phương thức HTTP POST lên Wikidata. Nhờ đó tải xuống thông tin câu lạc bộ chuyên nghiệp và URL logo (crest) của **895/1239** cầu thủ đang thi đấu.
* **Tích hợp Local**: Dữ liệu này được lưu trữ ngoại tuyến tại [squads.json](file:///d:/Code/Automation/wc2026/public/data/squads.json) làm nguồn fallback chính thức khi gọi API Đội hình, hiển thị đầy đủ tên CLB và logo nhỏ dưới tên cầu thủ trong modal đội hình [teamModal.js](file:///d:/Code/Automation/wc2026/public/js/components/teamModal.js).
* **Phân chia Vị trí Tiếng Việt**: Toàn bộ danh sách cầu thủ được gom nhóm và dịch tự động sang các vị trí: **Thủ Môn, Hậu Vệ, Tiền Vệ, Tiền Đạo** cùng thông tin HLV trưởng.

### E. Thiết kế Giao diện cuộn của Modal Dự đoán
* **Yêu cầu ban đầu**: Tạo scroll cho phần danh sách 5 nguồn.
* **Cải tiến tối ưu**: Thay vì cuộn lồng cục bộ gây khó khăn cho trải nghiệm người dùng, ứng dụng đã gỡ bỏ `overflow: hidden` trên lớp `.prediction-modal-content` tại [styles.css](file:///d:/Code/Automation/wc2026/public/css/styles.css) và kích hoạt cuộn trên toàn bộ modal với chiều cao tối đa `90vh` và thuộc tính `overflow-y: auto`. Điều này giúp người dùng cuộn xem toàn bộ thông tin dự đoán một cách liền mạch, trực quan và chuyên nghiệp.

---

## 4. Cách Khởi chạy Dự án nhanh trên Máy cá nhân
Dự án được trang bị sẵn các tệp kịch bản khởi chạy tự động:

1. Mở Terminal tại thư mục gốc của dự án (`d:\Code\Automation\wc2026`).
2. Thực hiện lệnh chạy tương ứng với môi trường Shell của bạn:
   * **Nếu dùng Command Prompt (CMD)**:
     ```cmd
     build Run
     ```
   * **Nếu dùng PowerShell**:
     ```powershell
     .\build Run
     ```
3. Truy cập trình duyệt qua đường dẫn: **`http://127.0.0.1:8080`**.
