/**
 * URL Helper Utility
 * Sanitizes and normalizes asset paths from the backend.
 */

<<<<<<< Updated upstream
const BASE_URL = "http://localhost:8000";
=======
// --- Environment-Driven Base URLs ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || '';
const FLV_BASE_URL = import.meta.env.VITE_FLV_BASE_URL;
const RTMP_URL = import.meta.env.VITE_RTMP_URL;
>>>>>>> Stashed changes

export const getValidUrl = (path, fallback) => {
    if (!path || path === "" || path.includes('synthetic')) return fallback;

    // Remove only if it's already an absolute URL
    if (path.startsWith('http')) return path;

    // Clear any white space
    let normalizedPath = path.trim();

    // Ensure it starts with a leading slash
    if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath}`;
    }

    const fullUrl = `${BASE_URL}${normalizedPath}`;

    // Log for Task 2 verification
    if (normalizedPath.includes('uploads')) {
        console.log(`[URL Helper] Constructed: ${fullUrl} (Original: ${path})`);
    }

    return fullUrl;
};

export const getAvatarUrl = (path, username) => {
    const fallback = `https://ui-avatars.com/api/?name=${username || 'User'}&background=random&color=fff`;
    
    if (!path || path === "" || path.includes('default') || path.includes('synthetic')) {
        return fallback;
    }

    // If it's just a filename (no slashes), assume it's in the uploads/avatars directory
    if (!path.startsWith('http') && !path.includes('/')) {
        const mediaPath = `/uploads/avatars/${path}`;
        return getMediaUrl(mediaPath) || fallback;
    }

    return getMediaUrl(path) || fallback;
};

export const THUMBNAIL_FALLBACK = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800";
export const AVATAR_FALLBACK = "https://ui-avatars.com/api/?name=User&background=random&color=fff";
export const VIDEO_FALLBACK = "https://vjs.zencdn.net/v/oceans.mp4";

