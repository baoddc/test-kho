/**
 * Cloudflare Worker API for HSE Cloudflare R2 Storage
 * Provides endpoints for uploading, deleting, and serving HSE photos.
 * 
 * R2 Bucket Binding: HSE_BUCKET
 * Optional Environment Variable: PUBLIC_URL (e.g. https://pub-xxxx.r2.dev or https://media.yourdomain.com)
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...CORS_HEADERS
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
    name = name.replace(/_+/g, '_');
    return name;
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method.toUpperCase();

        // 1. Handle CORS Preflight
        if (method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: CORS_HEADERS
            });
        }

        // Verify Bucket Binding
        if (!env.HSE_BUCKET) {
            return jsonResponse({
                status: 'error',
                message: 'Chưa cấu hình R2 Bucket binding "HSE_BUCKET". Vui lòng kiểm tra Settings > Bindings trên Cloudflare Worker.'
            }, 500);
        }

        try {
            // 2. Upload Endpoint: POST /upload
            if (method === 'POST' && (url.pathname === '/upload' || url.pathname === '/')) {
                const contentType = request.headers.get('content-type') || '';
                if (!contentType.includes('multipart/form-data')) {
                    return jsonResponse({
                        status: 'error',
                        message: 'Yêu cầu định dạng multipart/form-data'
                    }, 400);
                }

                const formData = await request.formData();
                const file = formData.get('file');
                const folder = formData.get('folder') || 'general';

                if (!file || typeof file === 'string') {
                    return jsonResponse({
                        status: 'error',
                        message: 'Không tìm thấy tệp ảnh tải lên (field name: "file")'
                    }, 400);
                }

                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const cleanName = sanitizeFileName(file.name);
                const uniqueKey = `hse/${folder}/${year}/${month}/${Date.now()}_${cleanName}`;

                // Upload to Cloudflare R2
                await env.HSE_BUCKET.put(uniqueKey, file.stream(), {
                    httpMetadata: {
                        contentType: file.type || 'image/jpeg',
                        cacheControl: 'public, max-age=31536000, immutable'
                    },
                    customMetadata: {
                        originalName: file.name,
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
                    mimeType: file.type || 'image/jpeg'
                });
            }

            // 3. Delete Endpoint: POST /delete hoặc DELETE /delete
            if ((method === 'POST' || method === 'DELETE') && url.pathname === '/delete') {
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
                    }, 400);
                }

                await env.HSE_BUCKET.delete(key);

                return jsonResponse({
                    status: 'success',
                    message: `Đã xóa tệp "${key}" khỏi R2 Bucket`,
                    key: key
                });
            }

            // 4. Direct File Serving: GET /file/* (Hoạt động khi chưa gắn domain riêng cho R2)
            if (method === 'GET' && url.pathname.startsWith('/file/')) {
                const key = decodeURIComponent(url.pathname.replace(/^\/file\//, ''));
                if (!key) {
                    return new Response('File key is missing', { status: 400 });
                }

                const object = await env.HSE_BUCKET.get(key);
                if (!object) {
                    return new Response('Ảnh không tồn tại trên Cloudflare R2', {
                        status: 404,
                        headers: CORS_HEADERS
                    });
                }

                const headers = new Headers();
                headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
                headers.set('Cache-Control', 'public, max-age=31536000, immutable');
                headers.set('ETag', object.httpEtag);
                Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

                return new Response(object.body, {
                    headers
                });
            }

            // Default route
            return jsonResponse({
                status: 'online',
                service: 'HSE Cloudflare R2 Worker API',
                version: '1.0.0',
                endpoints: {
                    upload: 'POST /upload',
                    delete: 'POST /delete',
                    file: 'GET /file/:key'
                }
            });

        } catch (error) {
            return jsonResponse({
                status: 'error',
                message: error.message || 'Lỗi xử lý server Cloudflare Worker'
            }, 500);
        }
    }
};
