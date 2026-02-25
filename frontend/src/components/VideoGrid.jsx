import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { getValidUrl, getAvatarUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';

// ── Time-ago helper ───────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    if (d < 365) return `${Math.floor(d / 30)}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
};

const fmtViews = (n) => {
    if (!n && n !== 0) return '0';
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
};

// ── Three-dot menu ────────────────────────────────────────────────────────────
// ── Per-user blocked channel storage ────────────────────────────────────────
export const getStorageKey = () => {
    try {
        const user = JSON.parse(localStorage.getItem('utube_user_data') || 'null');
        return user?.id ? `utube_blocked_channels_${user.id}` : 'utube_blocked_channels_guest';
    } catch { return 'utube_blocked_channels_guest'; }
};

export const getBlockedChannelsData = () => {
    try {
        const data = JSON.parse(localStorage.getItem(getStorageKey()) || '[]');
        // Filter out legacy integer IDs so only rich author objects are returned
        return data.filter(item => typeof item === 'object' && item !== null);
    } catch { return []; }
};

export const getBlockedChannels = () => {
    return getBlockedChannelsData().map(c => typeof c === 'object' ? c.id : c);
};

export const blockChannel = (author) => {
    const existing = getBlockedChannelsData();
    const id = author.id || author;
    if (!existing.some(c => (c.id || c) === id)) {
        localStorage.setItem(getStorageKey(), JSON.stringify([...existing, author]));
        window.dispatchEvent(new Event('utube_channel_blocked'));
    }
};

export const unblockChannel = (authorId) => {
    const existing = getBlockedChannelsData();
    const filtered = existing.filter(c => (c.id || c) !== authorId);
    localStorage.setItem(getStorageKey(), JSON.stringify(filtered));
    window.dispatchEvent(new Event('utube_channel_blocked'));
};

const VideoMenu = ({ video, onHide }) => {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const ref = useRef(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleDownload = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = getValidUrl(video.video_url || video.file_url, null);
        if (!url) { alert('No download link available for this video.'); return; }
        const a = document.createElement('a');
        a.href = url;
        a.download = `${video.title || 'video'}.mp4`;
        a.click();
        setOpen(false);
    };

    const handleShare = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const link = `${window.location.origin}/video/${video.id}`;
        navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
        setOpen(false);
    };

    const handleNotInterested = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onHide('video', video.id);
        setOpen(false);
    };

    const handleBlockChannel = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (video.author?.id) {
            blockChannel(video.author);
            onHide('channel', video.author.id);
        }
        setOpen(false);
    };

    const items = [
        {
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
            ),
            label: 'Download',
            action: handleDownload,
        },
        {
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
            ),
            label: copied ? 'Link Copied!' : 'Share',
            action: handleShare,
        },
        {
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
            ),
            label: 'Not Interested',
            action: handleNotInterested,
            danger: true,
        },
        {
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
            ),
            label: 'Don\'t Recommend Channel',
            action: handleBlockChannel,
            danger: true,
        },
    ];

    return (
        <div ref={ref} className="relative" onClick={e => e.preventDefault()}>
            {/* Three-dot trigger */}
            <button
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); }}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/15 transition-all text-white/50 hover:text-white"
                title="More options"
            >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
            </button>

            {/* Dropdown */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-8 z-50 w-52 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
                        style={{ background: 'rgba(18,18,18,0.97)', backdropFilter: 'blur(16px)' }}
                    >
                        {items.map(({ icon, label, action, danger }) => (
                            <button
                                key={label}
                                onClick={action}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-colors text-left
                                    ${danger
                                        ? 'text-red-400 hover:bg-red-500/10'
                                        : 'text-white/70 hover:bg-white/8 hover:text-white'
                                    }`}
                            >
                                {icon}
                                {label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ── VideoCard ─────────────────────────────────────────────────────────────────
export const VideoCard = ({ video, onHide }) => {
    const duration = video.duration
        ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}`
        : null;

    return (
        <motion.div className="video-card-hover group cursor-pointer relative" layout>
            {/* Thumbnail — full clickable */}
            <Link to={`/video/${video.id}`}>
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                    <img
                        src={getValidUrl(video.thumbnail_url, THUMBNAIL_FALLBACK)}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = THUMBNAIL_FALLBACK; }}
                    />
                    {duration && (
                        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {duration}
                        </div>
                    )}
                </div>
            </Link>

            {/* Info row */}
            <div className="flex gap-2.5">
                {/* Avatar */}
                <Link to={`/video/${video.id}`} className="shrink-0">
                    <div className="w-8 h-8 rounded-full bg-surface overflow-hidden border border-white/10">
                        <img
                            src={getAvatarUrl(video.author?.profile_image, video.author?.username)}
                            alt={video.author?.username}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${video.author?.username || 'U'}&background=random&color=fff`;
                            }}
                        />
                    </div>
                </Link>

                {/* Text + three-dot row */}
                <div className="flex-1 min-w-0 flex gap-1">
                    <Link to={`/video/${video.id}`} className="flex-1 min-w-0">
                        <h3 className="font-bold text-xs sm:text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                            {video.title}
                        </h3>
                        <p className="text-white/40 text-[11px] mt-0.5 hover:text-white/60 transition-colors truncate">
                            {video.author?.username}
                        </p>
                        <div className="flex items-center gap-1 text-white/30 text-[10px] mt-0.5">
                            <span>{fmtViews(video.view_count)} views</span>
                            <span>·</span>
                            <span>{timeAgo(video.upload_date)}</span>
                        </div>
                    </Link>

                    {/* ⋮ Menu */}
                    {onHide && (
                        <div className="shrink-0 self-start pt-0.5">
                            <VideoMenu video={video} onHide={onHide} />
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

// ── VideoGrid ─────────────────────────────────────────────────────────────────
const VideoGrid = ({ videos: initialVideos, loading }) => {
    const [hidden, setHidden] = useState(new Set());   // hidden video IDs
    const [blocked, setBlocked] = useState(() => new Set(getBlockedChannels()));

    // Derive visible list
    const visible = (initialVideos || []).filter(v =>
        !hidden.has(v.id) && !blocked.has(v.author?.id)
    );

    const handleHide = useCallback((type, id) => {
        if (type === 'video') {
            setHidden(prev => new Set([...prev, id]));
        } else if (type === 'channel') {
            blockChannel(id);
            setBlocked(prev => new Set([...prev, id]));
        }
    }, []);

    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="aspect-video bg-surface rounded-xl mb-3" />
                        <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-surface" />
                            <div className="flex-1 space-y-2 py-1">
                                <div className="h-4 bg-surface rounded w-3/4" />
                                <div className="h-3 bg-surface rounded w-1/2" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            <AnimatePresence>
                {visible.map(video => (
                    <VideoCard
                        key={video.uniqueKey || video.id}
                        video={video}
                        onHide={handleHide}
                    />
                ))}
            </AnimatePresence>
        </div>
    );
};

export default VideoGrid;
