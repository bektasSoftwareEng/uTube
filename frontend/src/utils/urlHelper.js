/**
 * URL Helper Utility
 * Dynamically constructs asset URLs based on the active environment.
 * Uses Vite environment variables (import.meta.env) with reliable fallbacks.
 */

// --- Environment-Driven Base URLs ---
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_BASE_URL || '';
const FLV_BASE_URL = import.meta.env.VITE_FLV_BASE_URL || 'http://127.0.0.1:8080/live';
const RTMP_URL = import.meta.env.VITE_RTMP_URL || 'rtmp://127.0.0.1:1935/live';

/**
 * Constructs a valid, full URL for a given asset path.
 * - Returns absolute URLs (http/https) as-is.
 * - Prepends API_BASE_URL to relative paths.
 * @param {string} path - The raw asset path from the backend.
 * @param {string} fallback - A fallback URL if the path is invalid.
 * @returns {string}
 */
export const getValidUrl = (path, fallback) => {
    if (!path || path === '' || path.includes('synthetic')) return fallback;

    // Already an absolute URL — return directly
    if (path.startsWith('http')) return path;

    // Clear whitespace and ensure leading slash
    let normalizedPath = path.trim();
    if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath}`;
    }

    // Media paths should NEVER point to API_BASE_URL (/api), 
    // they should go directly to the storage container.
    return `${MEDIA_BASE_URL}${normalizedPath}`;
};

/**
 * Constructs a valid avatar URL.
 * Falls back to ui-avatars.com if no valid path is provided.
 * @param {string} path - The raw avatar path from the backend.
 * @param {string} username - The username for the fallback avatar.
 * @returns {string}
 */
export const getAvatarUrl = (path, username) => {
    const fallback = `https://ui-avatars.com/api/?name=${username || 'User'}&background=random&color=fff`;

    if (!path || path === '' || path.includes('default') || path.includes('synthetic')) {
        return fallback;
    }

    // If it's just a filename (no slashes), assume it's in the uploads/avatars directory
    if (!path.startsWith('http') && !path.includes('/')) {
        return getValidUrl(`/uploads/avatars/${path}`, fallback);
    }

    return getValidUrl(path, fallback);
};

/**
 * Constructs a full media URL for assets served from the storage/media server.
 * @param {string} path - The relative path (e.g., /storage/uploads/previews/frame.jpg)
 * @returns {string}
 */
export const getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    let normalizedPath = path.trim();
    if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath}`;
    }

    return `${MEDIA_BASE_URL}${normalizedPath}`;
};

// --- Exported Constants ---
export { API_BASE_URL, MEDIA_BASE_URL, FLV_BASE_URL, RTMP_URL };

export const THUMBNAIL_FALLBACK = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800';
export const AVATAR_FALLBACK = 'https://ui-avatars.com/api/?name=User&background=random&color=fff';
export const VIDEO_FALLBACK = 'https://vjs.zencdn.net/v/oceans.mp4';
