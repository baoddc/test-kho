/**
 * Cloudflare Worker API for HSE Cloudflare R2 Storage
 * Provides endpoints for uploading, deleting, and serving HSE photos.
 * 
 * R2 Bucket Binding: HSE_BUCKET
 * Optional Environment Variable: PUBLIC_URL (e.g. https://pub-xxxx.r2.dev or https://media.yourdomain.com)
 *
 * BẢO MẬT (2026-10-15):
 *  - SUPABASE_URL + SUPABASE_ANON_KEY (vars): upload/delete bắt buộc có Supabase access token hợp lệ
 *    (header Authorization: Bearer <access_token>). Không cấu hình => từ chối upload/delete.
 *  - ALLOWED_ORIGINS (vars, phân tách dấu phẩy): giới hạn CORS. Mặc định chỉ baoddc.com + localhost.
 *  - Chỉ nhận ảnh (jpeg/png/webp/gif/heic), tối đa 15MB; file trả về luôn kèm nosniff + CSP sandbox.
 *  - Chỉ cho phép xóa key nằm trong tiền tố "hse/".
 *  - (2026-10-19) Upload/delete bằng token Supabase chỉ dành cho admin (RPC is_admin).
 */

const DEFAULT_ALLOWED_ORIGINS = [
    'https://baoddc.com',
    'https://www.baoddc.com',
    'https://web-supabase-five.vercel.app', // Electron (bản online) + update checker
    'https://baoddc.github.io',             // Shortcut desktop (GitHub Pages)
    'https://localhost',                    // Android (Capacitor)
    'capacitor://localhost'
];
// App desktop (Electron) chạy server nội bộ trên cổng ngẫu nhiên
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

// Giá trị CÔNG KHAI (đã có sẵn trong mã JS phía trình duyệt) — dùng khi Worker
// chưa cấu hình biến môi trường, để chỉ cần dán code lên Dashboard là chạy.
const DEFAULT_SUPABASE_URL = 'https://ahcethtonjwktjtmxzog.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_zxmsB9cyjDwi9ai9Vw-s1w_QlqKMG0S';

const ALLOWED_IMAGE_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/heic': 'heic',
    'image/heif': 'heif'
};

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB
const KEY_PREFIX = 'hse/';

function getAllowedOrigins(env) {
    if (env.ALLOWED_ORIGINS && env.ALLOWED_ORIGINS.trim()) {
        return env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
    }
    return DEFAULT_ALLOWED_ORIGINS;
}

function buildCorsHeaders(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = getAllowedOrigins(env);
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
    };
    if (origin && (allowed.includes(origin) || LOCAL_ORIGIN_RE.test(origin))) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

function jsonResponse(data, status, cors) {
    return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Content-Type-Options': 'nosniff',
            ...cors
        }
    });
}

function sanitizeFileName(fileName) {
    if (!fileName) return 'image_' + Date.now() + '.jpg';
    
    // Normalize Vietnamese diacritics
    let name = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    name = name.replace(/[đĐ]/g, 'd');
    // Replace spaces and special characters
    name = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Prevent double underscores or dots
    name = name.replace(/_+/g, '_').replace(/\.{2,}/g, '.');
    return name.slice(-120);
}

function sanitizeFolder(folder) {
    const clean = String(folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    return clean || 'general';
}

function timingSafeEqual(a, b) {
    const enc = new TextEncoder();
    const x = enc.encode(String(a));
    const y = enc.encode(String(b));
    let diff = x.length ^ y.length;
    for (let i = 0; i < Math.max(x.length, y.length); i++) {
        diff |= (x[i] || 0) ^ (y[i] || 0);
    }
    return diff === 0;
}

/**
 * Xác thực Supabase access token bằng cách gọi /auth/v1/user
 */
async function verifySupabaseUser(request, env) {
    if (env.REQUIRE_AUTH === 'false') {
        return { ok: true, user: { id: 'anonymous' } };
    }
    const authHeader = request.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        const apiKey = request.headers.get('X-Auth-Key') || '';
        if (env.AUTH_SECRET && timingSafeEqual(apiKey, env.AUTH_SECRET)) {
            return { ok: true, user: { id: 'api_key' } };
        }
        return { ok: false, reason: 'Thiếu token đăng nhập. Vui lòng đăng nhập để thực hiện thao tác này.' };
    }

    const supabaseUrl = env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const anonKey = env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;
    // Thiếu cấu hình xác thực => TỪ CHỐI (fail-closed), không cho upload/xóa ẩn danh
    if (!supabaseUrl || !anonKey) {
        return { ok: false, reason: 'Worker chưa cấu hình SUPABASE_URL / SUPABASE_ANON_KEY.' };
    }

    const token = match[1].trim();
    if (token === anonKey) {
        return { ok: false, reason: 'Token ẩn danh không được phép.' };
    }

    try {
        const res = await fetch(supabaseUrl.replace(/\/+$/, '') + '/auth/v1/user', {
            headers: {
                'apikey': anonKey,
                'Authorization': 'Bearer ' + token
            }
        });
        if (!res.ok) return { ok: false, reason: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' };
        const user = await res.json();
        if (!user || !user.id) return { ok: false, reason: 'Phiên đăng nhập không hợp lệ.' };

        // Chỉ quản trị viên được tải lên / xóa ảnh HSE (khớp checkPermission() trong hse.js)
        const adminRes = await fetch(supabaseUrl.replace(/\/+$/, '') + '/rest/v1/rpc/is_admin', {
            method: 'POST',
            headers: {
                'apikey': anonKey,
                'Authorization': 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        if (!adminRes.ok || (await adminRes.json()) !== true) {
            return { ok: false, status: 403, reason: 'Chỉ quản trị viên mới được tải lên hoặc xóa ảnh HSE.' };
        }
        return { ok: true, user };
    } catch (e) {
        return { ok: false, reason: 'Lỗi kết nối xác thực đến Supabase.' };
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method.toUpperCase();
        const cors = buildCorsHeaders(request, env);

        // 1. Handle CORS Preflight
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: cors
            });
        }

        // Verify Bucket Binding
        if (!env.HSE_BUCKET) {
            return jsonResponse({
                status: 'error',
                message: 'Chưa cấu hình R2 Bucket binding "HSE_BUCKET".'
            }, 500, cors);
        }

        try {
            const isUpload = method === 'POST' && (url.pathname === '/upload' || url.pathname === '/');
            const isDelete = (method === 'POST' || method === 'DELETE') && url.pathname === '/delete';

            if (isUpload || isDelete) {
                const auth = await verifySupabaseUser(request, env);
                if (!auth.ok) {
                    return jsonResponse({ status: 'error', message: auth.reason }, auth.status || 401, cors);
                }
            }

            // 2. Upload Endpoint: POST /upload
            if (isUpload) {
                const contentType = request.headers.get('content-type') || '';
                if (!contentType.includes('multipart/form-data')) {
                    return jsonResponse({
                        status: 'error',
                        message: 'Yêu cầu định dạng multipart/form-data'
                    }, 400, cors);
                }

                const declaredLength = parseInt(request.headers.get('content-length') || '0', 10);
                if (declaredLength > MAX_UPLOAD_BYTES + 1024 * 64) {
                    return jsonResponse({ status: 'error', message: 'Ảnh vượt quá dung lượng cho phép (15MB).' }, 413, cors);
                }

                const formData = await request.formData();
                const file = formData.get('file');
                const folder = sanitizeFolder(formData.get('folder'));

                if (!file || typeof file === 'string') {
                    return jsonResponse({
                        status: 'error',
                        message: 'Không tìm thấy tệp ảnh tải lên (field name: "file")'
                    }, 400, cors);
                }

                const mimeType = String(file.type || '').toLowerCase();
                if (!ALLOWED_IMAGE_TYPES[mimeType]) {
                    return jsonResponse({ status: 'error', message: 'Chỉ cho phép tải lên tệp ảnh (JPG, PNG, WEBP, GIF, HEIC).' }, 415, cors);
                }
                if (file.size > MAX_UPLOAD_BYTES) {
                    return jsonResponse({ status: 'error', message: 'Ảnh vượt quá dung lượng cho phép (15MB).' }, 413, cors);
                }

                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                let cleanName = sanitizeFileName(file.name);
                const ext = ALLOWED_IMAGE_TYPES[mimeType];
                if (!cleanName.toLowerCase().endsWith('.' + ext)) {
                    cleanName = cleanName.replace(/\.[a-zA-Z0-9]+$/, '') + '.' + ext;
                }
                const uniqueKey = `${KEY_PREFIX}${folder}/${year}/${month}/${Date.now()}_${cleanName}`;

                // Upload to Cloudflare R2
                await env.HSE_BUCKET.put(uniqueKey, file.stream(), {
                    httpMetadata: {
                        contentType: mimeType,
                        cacheControl: 'public, max-age=31536000, immutable'
                    },
                    customMetadata: {
                        originalName: cleanName,
                        uploadedAt: now.toISOString(),
                        folder: folder
                    }
                });

                // Determine public access URL
                let fileUrl = '';
                if (env.PUBLIC_URL && env.PUBLIC_URL.trim() !== '') {
                    const baseDomain = env.PUBLIC_URL.trim().replace(/\/+$/, '');
                    fileUrl = `${baseDomain}/${uniqueKey}`;
                } else {
                    // Fallback to Worker's own /file/ endpoint
                    fileUrl = `${url.origin}/file/${uniqueKey}`;
                }

                return jsonResponse({
                    status: 'success',
                    message: 'Tải ảnh lên Cloudflare R2 thành công',
                    fileUrl: fileUrl,
                    key: uniqueKey,
                    size: file.size,
                    mimeType: mimeType
                }, 200, cors);
            }

            // 3. Delete Endpoint: POST /delete hoặc DELETE /delete
            if (isDelete) {
                let key = '';
                try {
                    const body = await request.json();
                    key = body.key || '';
                    if (!key && body.fileUrl) {
                        const targetUrl = new URL(body.fileUrl);
                        // If url contains /file/path, strip /file/
                        if (targetUrl.pathname.startsWith('/file/')) {
                            key = decodeURIComponent(targetUrl.pathname.replace(/^\/file\//, ''));
                        } else {
                            key = decodeURIComponent(targetUrl.pathname.replace(/^\/+/, ''));
                        }
                    }
                } catch (_) {}

                if (!key) {
                    return jsonResponse({
                        status: 'error',
                        message: 'Thiếu key hoặc fileUrl cần xóa'
                    }, 400, cors);
                }

                // Chỉ cho phép xóa trong vùng ảnh HSE, chặn "../"
                if (!key.startsWith(KEY_PREFIX) || key.includes('..')) {
                    return jsonResponse({ status: 'error', message: 'Key không hợp lệ.' }, 403, cors);
                }

                await env.HSE_BUCKET.delete(key);

                return jsonResponse({
                    status: 'success',
                    message: 'Đã xóa tệp khỏi R2 Bucket',
                    key: key
                }, 200, cors);
            }

            // 4. Direct File Serving: GET /file/* (Hoạt động khi chưa gắn domain riêng cho R2)
            if (method === 'GET' && url.pathname.startsWith('/file/')) {
                const key = decodeURIComponent(url.pathname.replace(/^\/file\//, ''));
                if (!key || !key.startsWith(KEY_PREFIX)) {
                    return new Response('Not found', { status: 404 });
                }

                const object = await env.HSE_BUCKET.get(key);
                if (!object) {
                    return new Response('Ảnh không tồn tại trên Cloudflare R2', {
                        status: 404,
                        headers: cors
                    });
                }

                const storedType = (object.httpMetadata?.contentType || '').toLowerCase();
                const safeType = ALLOWED_IMAGE_TYPES[storedType] ? storedType : 'application/octet-stream';

                const headers = new Headers();
                headers.set('Content-Type', safeType);
                headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                headers.set('ETag', object.httpEtag);
                // Chặn trình duyệt thực thi nội dung (chống Stored XSS qua file tải lên)
                headers.set('X-Content-Type-Options', 'nosniff');
                headers.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
                if (safeType === 'application/octet-stream') {
                    headers.set('Content-Disposition', 'attachment');
                }
                Object.entries(cors).forEach(([k, v]) => headers.set(k, v));

                return new Response(object.body, {
                    headers
                });
            }

            // Default route
            return jsonResponse({ status: 'online' }, 200, cors);

        } catch (error) {
            console.error('Worker error:', error);
            return jsonResponse({
                status: 'error',
                message: 'Lỗi xử lý server Cloudflare Worker'
            }, 500, cors);
        }
    }
};
