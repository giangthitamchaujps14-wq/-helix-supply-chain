# Supply Chain Analytics Web Tool – Tóm tắt thiết kế & yêu cầu

**Ngày tổng hợp:** 09/09/2026  
**Vai trò hỗ trợ:** Supply Chain Data Scientist + Web Developer  
**Mục tiêu:** Xây dựng website chứa các tool chuyên sâu giúp phân tích chuỗi cung ứng một cách hoàn hảo, có quy trình rõ ràng và dễ mở rộng.

---

## 1. Yêu cầu gốc từ người dùng

1. **Bên trái (Sidebar):** Các tool chuyên sâu  
   - Phân tích tồn kho  
   - Phân tích tài chính tồn kho  
   - Và các tool khác (cần mở rộng thêm)

2. **Sau khi chọn tool:**  
   - Người dùng upload file đầu vào theo yêu cầu của tool đó (Sales, Tồn kho, …)

3. **Xử lý data:**  
   - Dựa trên data đã upload, hệ thống gợi ý các file report tương ứng lấy từ thư mục template của hệ thống.  
   - Hiển thị dưới dạng demo đơn giản.

4. **Trường hợp thiếu data:**  
   - Hiện ô thông báo (modal/notification).  
   - Người dùng có thể đồng ý upload thêm hoặc bỏ qua và chạy với data hiện có.

**Ghi chú của người dùng:**  
Tool này sẽ khá nặng đô và tốn kém. Mong muốn xây dựng một nền tảng chứa nhiều tool phân tích chuỗi cung ứng chất lượng cao.

---

## 2. Đề xuất cấu trúc Tool (Sidebar trái)

### Inventory Analytics
- Phân tích tồn kho cơ bản (Stock status, Aging, Slow/Fast moving)
- ABC / XYZ / ABC-XYZ Analysis
- Inventory Turnover & Days of Supply
- Safety Stock & Reorder Point Calculator
- Excess & Obsolete Inventory Analysis

### Financial Inventory
- Inventory Carrying Cost Analysis
- Inventory Valuation (FIFO / Weighted Average)
- Working Capital tied in Inventory
- GMROI / Turn-Earn Index
- Cash-to-Cash Cycle contribution from Inventory

### Demand & Forecasting
- Demand Forecasting (Statistical + basic ML)
- Forecast Accuracy (MAPE, Bias, Tracking Signal)
- Seasonality & Trend Analysis
- New Product / End-of-Life forecasting

### Supply & Supplier
- Supplier Performance Scorecard (OTD, Quality, Lead Time)
- Purchase Price Variance (PPV)
- Lead Time Analysis & Variability

### Order & Fulfillment
- Perfect Order Rate / OTIF Analysis
- Fill Rate & Backorder Analysis
- Order Cycle Time

### Network & Optimization (nâng cao)
- Multi-echelon Inventory Optimization (demo)
- What-if Scenario (tăng/giảm safety stock, lead time…)

**Khuyến nghị:** Bắt đầu với 6–8 tool cốt lõi, sau đó mở rộng dần.

---

## 3. User Flow chi tiết

1. Người dùng chọn tool ở sidebar trái.
2. Hệ thống hiển thị **yêu cầu file input** rõ ràng (ví dụ):
   - Tool “ABC-XYZ Analysis” → cần Sales history + Inventory snapshot.
   - Tool “Inventory Financial Analysis” → cần Inventory value, Cost of goods, Carrying cost rate…
3. Người dùng upload file (Excel / CSV). Hệ thống validate cột bắt buộc ngay lập tức.
4. Sau khi upload thành công → hệ thống **gợi ý các report template** có sẵn trong thư mục template:
   - Hiển thị tên report + mô tả ngắn + preview (thumbnail hoặc sample output).
5. Nếu thiếu file quan trọng để ra output đầy đủ → hiện **ô thông báo**:
   - Ví dụ: “Để tính chính xác Days of Supply và Safety Stock, hệ thống cần thêm file Demand Forecast hoặc Average Daily Sales. Bạn có muốn upload thêm không?”
   - Các lựa chọn:
     - Đồng ý upload thêm
     - Bỏ qua và chạy với data hiện có
     - Hủy
6. Hệ thống chạy phân tích → hiển thị kết quả + cho phép download report.

---

## 4. Đề xuất kỹ thuật triển khai

### Frontend
- Next.js / React + Tailwind CSS + shadcn/ui
- File upload: react-dropzone + validation schema (Zod)

### Backend / Processing
- Python (FastAPI) + Pandas / Polars
- Các tool nặng (forecasting, optimization) chạy async (Celery + Redis) hoặc serverless
- Template report: lưu sẵn file Excel / generate bằng openpyxl, reportlab…

### Data & Config
- Mỗi tool có file config JSON mô tả:
  - Required columns
  - Optional columns
  - Template mapping
  - Missing-data warning message
- Hỗ trợ map cột tự động hoặc cho user map thủ công

---

## 5. Chiến lược phát triển theo giai đoạn (giảm chi phí & rủi ro)

### Phase 1 – MVP (1–2 tháng)
- 5–6 tool cốt lõi (Inventory Analysis, ABC-XYZ, Financial Inventory, Turnover & DOS, Forecast Accuracy)
- Upload Excel/CSV → validate → xử lý bằng Pandas → xuất Excel report + dashboard đơn giản
- Modal cảnh báo thiếu file
- Demo template sẵn

### Phase 2
- Thêm forecasting đơn giản (Prophet / statsmodels)
- Lưu lịch sử phân tích của user
- Multi-file upload thông minh hơn

### Phase 3
- AI gợi ý (LLM giải thích kết quả + đề xuất action)
- Integration với Google Drive / OneDrive / API ERP

---

## 6. Các bước tiếp theo có thể thực hiện

1. Vẽ chi tiết wireframe / mockup (text + cấu trúc component)
2. Liệt kê cụ thể **cột bắt buộc** của từng tool + message cảnh báo thiếu file
3. Thiết kế database schema + API endpoint
4. Bắt đầu code MVP (Next.js + FastAPI) với 1–2 tool đầu tiên
5. Đề xuất danh sách tool ưu tiên theo mức độ giá trị cho doanh nghiệp Việt Nam

---

## Ghi chú cuối

Tài liệu này tổng hợp toàn bộ nội dung đã trao đổi để bạn có thể đưa vào project riêng một cách dễ dàng.  
Có thể mở rộng thêm phần chi tiết cột dữ liệu, config JSON mẫu, hoặc wireframe khi cần.