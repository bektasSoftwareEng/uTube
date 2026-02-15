/**
 * URL Helper Utility
 * Sanitizes and normalizes asset paths from the backend.
 */

const BASE_URL = "http://localhost:8000";

export const getValidUrl = (path, fallback) => {
    if (!path || path === "" || path.includes('synthetic')) return fallback;

    // Remove problematic prefixes that cause 404s
    let sanitizedPath = path.replace('/storage/', '/');
    if (sanitizedPath.startsWith('storage/')) sanitizedPath = sanitizedPath.replace('storage/', '/');

    // If it's already an absolute URL, return it
    if (sanitizedPath.startsWith('http')) return sanitizedPath;

    // Ensure relative paths have a leading slash for normalization
    const normalizedPath = sanitizedPath.startsWith('/') ? sanitizedPath : `/${sanitizedPath}`;

    return `${BASE_URL}${normalizedPath}`;
};

export const getAvatarUrl = (path, username) => {
    const fallback = `https://ui-avatars.com/api/?name=${username || 'User'}&background=random&color=fff`;
    if (!path || path === "" || path.includes('default') || path.includes('synthetic')) {
        return fallback;
    }
    return getValidUrl(path, fallback);
};

export const THUMBNAIL_FALLBACK = "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800";
export const AVATAR_FALLBACK = "https://ui-avatars.com/api/?name=User&background=random&color=fff";
export const VIDEO_FALLBACK = "https://vjs.zencdn.net/v/oceans.mp4";

