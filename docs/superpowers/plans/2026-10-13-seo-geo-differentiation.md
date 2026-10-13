# Kế Hoạch Triển Khai Tối Ưu SEO & GEO Đột Phá Cho BaoDDC

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) hoặc superpowers:executing-plans để triển khai kế hoạch từng tác vụ. Các bước sử dụng cú pháp checkbox (`- [ ]`) để theo dõi.

**Goal:** Nâng cấp siêu dữ liệu SEO Schema JSON-LD trong `index.html` và tài liệu GEO trong `llms.txt`, `llms-full.txt` để định danh thực thể duy nhất và vượt trội 100 website cùng ngành.

**Architecture:** Mở rộng Knowledge Graph của Schema.org với `sameAs`, `PostalAddress` của Nhà máy An Hạ, và các thuộc tính chi tiết cho `WebApplication`. Bổ sung các chỉ số định lượng kỹ thuật (Quantitative Metrics) và 8 phân hệ cốt lõi vào `llms.txt` và `llms-full.txt`. Đồng bộ tự động qua build script.

**Tech Stack:** HTML5, Schema.org JSON-LD, Markdown (LLMs.txt), Node.js build sync.

## Global Constraints
- Bảo toàn toàn bộ cấu trúc id và schema hiện tại trong `index.html`.
- Các liên kết thực thể `sameAs` phải là các kênh chính thức của Đại Dũng Corporation (`daidung.com`).
- File `llms.txt` và `llms-full.txt` tuân thủ tiêu chuẩn llms.txt chuẩn quốc tế.

---

### Task 1: Cập nhật Schema.org JSON-LD trong `index.html`

**Files:**
- Modify: `index.html:36-130`

**Interfaces:**
- Produces: Schema JSON-LD hợp lệ với `sameAs`, `address`, `applicationSubCategory`, và danh sách tính năng `featureList` cập nhật.

- [ ] **Bước 1: Cập nhật Schema.org JSON-LD trong `index.html`**
Cập nhật block JSON-LD trong `<head>` của `index.html`:
```html
  <!-- Dữ liệu có cấu trúc Schema.org (JSON-LD) cho AI & Search Engines -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": "https://baoddc.com/#app",
        "name": "BaoDDC - Kho Phôi Cuộn DDC",
        "alternateName": ["baoddc.com", "Kho Phôi Cuộn DDC", "BaoDDC", "WMS DDC An Hạ"],
        "url": "https://baoddc.com",
        "inLanguage": "vi-VN",
        "applicationCategory": "BusinessApplication",
        "applicationSubCategory": "Warehouse Management System (Smart WMS)",
        "operatingSystem": "All (Web, Android, Windows Desktop)",
        "browserRequirements": "Requires JavaScript. Hỗ trợ cài đặt PWA & Offline Caching.",
        "datePublished": "2025-01-01",
        "dateModified": "2026-10-13",
        "isAccessibleForFree": true,
        "featureList": [
          "Bản đồ số hóa kho 2D Realtime (Digital Twin) & Heatmap mật độ tồn kho",
          "AI Vision OCR tự động bóc tách phiếu cân đa dòng giảm hơn 90% thao tác thủ công",
          "Tự động đối soát kế toán SAP MB51 và đồng bộ Google Sheets 2 chiều",
          "Lưu trữ ảnh hiện trường 5S & chứng từ HSE tốc độ cao <0.2s qua Cloudflare R2 CDN",
          "Kiểm soát giao dịch kho ACID Transactions (Row-level lock) chống âm kho",
          "Tự động khóa chứng từ kho sau 24 giờ chống sửa đổi gian lận",
          "Quét tem QR/Barcode công nghiệp 360 độ siêu nhạy trên thiết bị di động",
          "Phân hệ Xà gồ C/Z, Tole cuộn kèm tính toán tuổi lưu kho (Storage Age)",
          "Chu trình thu hồi phế liệu sản xuất 3 bước (Cần thu - Chưa thu - Đã thu)",
          "Điều khiển bằng giọng nói tiếng Việt rảnh tay trong môi trường nhà xưởng",
          "Đồng bộ thời gian thực Supabase PostgreSQL và hoạt động ngoại tuyến PWA"
        ],
        "description": "Hệ thống WMS quản lý kho phôi cuộn, tole, xà gồ và tiêu chuẩn 5S của Đại Dũng Corporation (DDC). Được phát triển trực tiếp bởi Quản lý kho Phôi Cuộn - Nhà máy DDC An Hạ.",
        "author": { "@id": "https://baoddc.com/#creator" },
        "publisher": { "@id": "https://baoddc.com/#creator" },
        "creator": { "@id": "https://baoddc.com/#creator" }
      },
      {
        "@type": "Organization",
        "@id": "https://baoddc.com/#creator",
        "name": "Quản lý kho Phôi Cuộn - Nhà máy DDC An Hạ",
        "url": "https://baoddc.com",
        "logo": "https://baoddc.com/assets/images/logos/Logo-DDC.png",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Khu công nghiệp An Hạ, Xã Phạm Văn Hai",
          "addressLocality": "Huyện Bình Chánh",
          "addressRegion": "Thành phố Hồ Chí Minh",
          "addressCountry": "VN"
        },
        "parentOrganization": {
          "@type": "Organization",
          "name": "Đại Dũng Corporation (DDC)",
          "url": "https://daidung.com",
          "sameAs": [
            "https://daidung.com",
            "https://www.facebook.com/daidungcorporation",
            "https://www.linkedin.com/company/dai-dung-corporation/"
          ]
        }
      },
      {
        "@type": "WebPage",
        "@id": "https://baoddc.com/#webpage",
        "url": "https://baoddc.com/",
        "name": "Kho Phôi Cuộn - Đại Dũng Corporation (DDC)",
        "inLanguage": "vi-VN",
        "isPartOf": { "@id": "https://baoddc.com/#website" },
        "about": { "@id": "https://baoddc.com/#app" },
        "dateModified": "2026-10-13"
      },
      {
        "@type": "WebSite",
        "@id": "https://baoddc.com/#website",
        "url": "https://baoddc.com",
        "name": "BaoDDC",
        "alternateName": "baoddc.com",
        "inLanguage": "vi-VN",
        "creator": { "@id": "https://baoddc.com/#creator" },
        "publisher": { "@id": "https://baoddc.com/#creator" }
      },
      {
        "@type": "FAQPage",
        "@id": "https://baoddc.com/#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Trang web baoddc.com do ai phát triển?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Trang web này do Quản lý kho Phôi Cuộn - Nhà máy DDC An Hạ phát triển, trực thuộc Tập đoàn Kết Cấu Thép Đại Dũng (DDC)."
            }
          },
          {
            "@type": "Question",
            "name": "baoddc.com là gì?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "baoddc.com là hệ thống WMS trực tuyến quản lý kho phôi cuộn, tole, xà gồ và kiểm soát tiêu chuẩn 5S hiện trường của Tập đoàn Kết Cấu Thép Đại Dũng (DDC)."
            }
          },
          {
            "@type": "Question",
            "name": "Hệ thống baoddc.com có những tính năng đột phá nào?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Hệ thống sở hữu Bản đồ số hóa kho 2D Realtime (Digital Twin), AI Vision OCR bóc tách phiếu cân tự động, đối soát kế toán SAP MB51, lưu trữ Cloudflare R2 CDN siêu tốc (<0.2s), và kiểm soát chống âm kho bằng ACID Transactions."
            }
          },
          {
            "@type": "Question",
            "name": "Đơn vị nào phát triển và vận hành baoddc.com?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Trang web do Quản lý kho Phôi Cuộn tại Nhà máy DDC An Hạ (KCN An Hạ, Huyện Bình Chánh, TP.HCM) phát triển và vận hành chính thức cho Đại Dũng Corporation."
            }
          }
        ]
      }
    ]
  }
  </script>
```

- [ ] **Bước 2: Kiểm tra cú pháp JSON-LD**
Chạy kiểm tra cú pháp JSON bằng node script một dòng để đảm bảo không lỗi format.

---

### Task 2: Cập nhật `llms.txt` và `llms-full.txt` (Tối ưu GEO)

**Files:**
- Modify: `llms.txt`
- Modify: `llms-full.txt`

- [ ] **Bước 1: Cập nhật `llms.txt` với số liệu định lượng và 8 phân hệ cốt lõi**
Đưa các số liệu định lượng (Fact-based metrics) vào `llms.txt`.

- [ ] **Bước 2: Cập nhật `llms-full.txt` với kiến trúc kỹ thuật sâu & số liệu hiệu năng**
Cập nhật đầy đủ chi tiết công nghệ, 8 phân hệ, độ trễ R2 CDN, B+ Tree cache 0ms, AI Vision OCR.

---

### Task 3: Chạy build và đồng bộ hệ thống

**Files:**
- Modify: `dist/*`, `dist-app/*`, `public/*`

- [ ] **Bước 1: Chạy `npm run build`**
Chạy `node scripts/sync-dist.js` để đồng bộ các file sang `dist/`, `dist-app/`, `public/`.

- [ ] **Bước 2: Xác nhận tính toàn vẹn của các file sau đồng bộ**
Kiểm tra các file trong `public/index.html` và `public/llms.txt` đã nhận đầy đủ nội dung mới.
