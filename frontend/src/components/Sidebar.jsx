import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '../context/SidebarContext';
import { UTUBE_USER } from '../utils/authConstants';
import ApiClient from '../utils/ApiClient';
import { getValidUrl, getAvatarUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';

// ── Duration formatter ──
const fmtDuration = (s) => {
    if (!s) return null;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
};

// ── Time ago helper ──
const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

// ── Section Header — matches the navbar dropdown label style  ──
const SectionHeader = ({ icon, title, tag }) => (
    <div className="flex items-center justify-between px-4 pt-5 pb-2.5">
        <div className="flex items-center gap-2">
            <span className="w-1 h-1 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                {icon}
                {title}
            </span>
        </div>
        {tag && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-primary/60 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                {tag}
            </span>
        )}
    </div>
);

// ── Skeleton loaders ──
const SkeletonVideo = () => (
    <div className="flex gap-2.5 px-3 py-2 animate-pulse">
        <div className="w-[72px] aspect-video rounded-xl bg-white/5 shrink-0" />
        <div className="flex-1 space-y-1.5 py-0.5">
            <div className="h-2.5 bg-white/8 rounded w-full" />
            <div className="h-2 bg-white/5 rounded w-2/3" />
            <div className="h-2 bg-white/5 rounded w-1/3" />
        </div>
    </div>
);

const SkeletonChannel = () => (
    <div className="flex items-center gap-3 px-4 py-2 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-white/8 shrink-0" />
        <div className="flex-1 space-y-1.5">
            <div className="h-2.5 bg-white/8 rounded w-3/4" />
        </div>
    </div>
);

// ── Sign-in placeholder ──
const SignInPlaceholder = ({ label }) => (
    <div className="mx-3 my-1 px-3 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-center">
        <p className="text-white/25 text-[11px] leading-relaxed">{label}</p>
    </div>
);

// ── Empty state ──
const EmptyState = ({ label }) => (
    <div className="mx-3 my-1 px-3 py-3 rounded-xl border border-white/5 bg-white/[0.02] text-center">
        <p className="text-white/20 text-[11px]">{label}</p>
    </div>
);

// ── Video Item — mirrors VideoCard from VideoGrid ──
const VideoItem = ({ video }) => {
    const dur = fmtDuration(video.duration);
    return (
        <Link
            to={`/video/${video.id}`}
            className="flex items-start gap-2.5 px-3 py-2 mx-1 rounded-xl hover:bg-white/[0.06] transition-colors group"
        >
            {/* Thumbnail with duration badge */}
            <div className="relative w-[72px] aspect-video rounded-xl overflow-hidden shrink-0 ring-1 ring-white/5">
                <img
                    src={getValidUrl(video.thumbnail_url, THUMBNAIL_FALLBACK)}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => { e.target.src = THUMBNAIL_FALLBACK; }}
                />
                {dur && (
                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[8px] font-bold px-1 py-0.5 rounded leading-none">
                        {dur}
                    </span>
                )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 py-0.5">
                <p className="text-[11px] font-bold leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {video.title}
                </p>
                <p className="text-[10px] text-white/40 mt-0.5 truncate hover:text-white/60 transition-colors">
                    {video.author?.username || video.username}
                </p>
                <div className="flex items-center gap-1 text-[9px] text-white/25 mt-0.5">
                    {video.view_count !== undefined && (
                        <span>{(video.view_count || 0).toLocaleString()} views</span>
                    )}
                    {video.view_count !== undefined && video.upload_date && (
                        <span>•</span>
                    )}
                    {video.upload_date && (
                        <span>{timeAgo(video.upload_date)}</span>
                    )}
                </div>
            </div>
        </Link>
    );
};

// ── Channel Item — mirrors avatar style from VideoCard ──
const ChannelItem = ({ channel }) => {
    const username = channel.author?.username;
    return (
        <div className="flex items-center gap-3 px-4 py-2 mx-1 rounded-xl hover:bg-white/[0.06] transition-colors group cursor-default">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-surface shrink-0 overflow-hidden border border-white/10">
                <img
                    src={getAvatarUrl(channel.author?.profile_image, username)}
                    alt={username}
                    className="w-full h-full object-cover"
                    onError={e => {
                        e.target.src = `https://ui-avatars.com/api/?name=${username || 'U'}&background=random&color=fff`;
                    }}
                />
            </div>

            {/* Name + online dot */}
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold text-white/70 group-hover:text-white transition-colors truncate">
                    {username || 'Unknown'}
                </p>
            </div>

            {/* Red accent arrow on hover */}
            <svg
                className="w-3 h-3 text-primary/0 group-hover:text-primary/60 transition-colors shrink-0"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
        </div>
    );
};

// ── Divider ──
const Divider = () => (
    <div className="mx-4 mt-3 border-t border-white/[0.06]" />
);

// ── Main Sidebar ──
const Sidebar = () => {
    const { isSidebarOpen } = useSidebar();

    const [user, setUser] = useState(() => {
        try {
            const d = localStorage.getItem(UTUBE_USER);
            return d ? JSON.parse(d) : null;
        } catch { return null; }
    });

    const [subs, setSubs] = useState([]);
    const [history, setHistory] = useState([]);
    const [liked, setLiked] = useState([]);
    const [loading, setLoading] = useState({ subs: false, history: false, liked: false });

    // Sync user with auth events
    useEffect(() => {
        const sync = () => {
            try {
                const d = localStorage.getItem(UTUBE_USER);
                setUser(d ? JSON.parse(d) : null);
            } catch { setUser(null); }
        };
        window.addEventListener('authChange', sync);
        window.addEventListener('storage', sync);
        return () => {
            window.removeEventListener('authChange', sync);
            window.removeEventListener('storage', sync);
        };
    }, []);

    // Fetch when sidebar opens
    useEffect(() => {
        if (!isSidebarOpen || !user) return;
        setLoading({ subs: true, history: true, liked: true });

        ApiClient.get('/feed/subscriptions', { params: { limit: 8 } })
            .then(r => setSubs(r.data))
            .catch(() => setSubs([]))
            .finally(() => setLoading(p => ({ ...p, subs: false })));

        ApiClient.get('/videos/history', { params: { limit: 8 } })
            .then(r => setHistory(Array.isArray(r.data) ? r.data : r.data?.videos || []))
            .catch(() => setHistory([]))
            .finally(() => setLoading(p => ({ ...p, history: false })));

        ApiClient.get('/videos/liked', { params: { limit: 8 } })
            .then(r => setLiked(Array.isArray(r.data) ? r.data : r.data?.videos || []))
            .catch(() => setLiked([]))
            .finally(() => setLoading(p => ({ ...p, liked: false })));
    }, [isSidebarOpen, user]);

    // Deduplicated subscription channels
    const channels = (() => {
        const seen = new Set();
        return subs.filter(v => {
            const id = v.author?.id;
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    })();

    return (
        <AnimatePresence>
            {isSidebarOpen && (
                <motion.aside
                    key="sidebar"
                    initial={{ x: -260, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -260, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 36 }}
                    className="fixed left-0 top-0 bottom-0 pt-16 sm:pt-20 w-60 z-40 flex flex-col border-r border-white/[0.06]"
                    style={{
                        background: 'rgba(8, 8, 8, 0.92)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                    }}
                >
                    {/* Top gradient accent — matches the site's red-black radial theme */}
                    <div
                        className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
                        style={{
                            background: 'radial-gradient(ellipse at 50% 0%, rgba(139,0,0,0.18) 0%, transparent 70%)',
                        }}
                    />

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto sidebar-scroll py-2 pb-10 relative">

                        {/* ── Subscriptions ── */}
                        <SectionHeader
                            icon={
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            }
                            title="Subscriptions"
                            tag="Channels"
                        />

                        {!user ? (
                            <SignInPlaceholder label="Sign in to see your subscriptions" />
                        ) : loading.subs ? (
                            [...Array(4)].map((_, i) => <SkeletonChannel key={i} />)
                        ) : channels.length > 0 ? (
                            channels.map(v => <ChannelItem key={v.author?.id} channel={v} />)
                        ) : (
                            <EmptyState label="No subscriptions yet" />
                        )}

                        <Divider />

                        {/* ── Watch History ── */}
                        <SectionHeader
                            icon={
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                            title="Watch History"
                            tag="Recent"
                        />

                        {!user ? (
                            <SignInPlaceholder label="Sign in to see your watch history" />
                        ) : loading.history ? (
                            [...Array(3)].map((_, i) => <SkeletonVideo key={i} />)
                        ) : history.length > 0 ? (
                            history.map(v => <VideoItem key={v.id} video={v} />)
                        ) : (
                            <EmptyState label="No watch history yet" />
                        )}

                        <Divider />

                        {/* ── Liked Videos ── */}
                        <SectionHeader
                            icon={
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                </svg>
                            }
                            title="Liked Videos"
                            tag="All"
                        />

                        {!user ? (
                            <SignInPlaceholder label="Sign in to see your liked videos" />
                        ) : loading.liked ? (
                            [...Array(3)].map((_, i) => <SkeletonVideo key={i} />)
                        ) : liked.length > 0 ? (
                            liked.map(v => <VideoItem key={v.id} video={v} />)
                        ) : (
                            <EmptyState label="No liked videos yet" />
                        )}

                    </div>

                    {/* Bottom fade mask */}
                    <div
                        className="h-10 shrink-0 pointer-events-none"
                        style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.95), transparent)' }}
                    />
                </motion.aside>
            )}
        </AnimatePresence>
    );
};

export default Sidebar;
