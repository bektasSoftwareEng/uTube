import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarUrl, getValidUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';
import { UTUBE_TOKEN, UTUBE_USER } from '../utils/authConstants';
import ApiClient from '../utils/ApiClient';
import { useSidebar } from '../context/SidebarContext';


const Navbar = () => {
    const { isSidebarOpen, toggleSidebar } = useSidebar();
    // Read from disk during initialization
    const [user, setUser] = useState(() => {
        try {
            const data = localStorage.getItem(UTUBE_USER);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    });

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');

    useEffect(() => {
        setSearchQuery(searchParams.get('search') || '');
    }, [searchParams]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
        } else {
            navigate('/');
        }
    };

    // ── Notification State ──
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notifLoading, setNotifLoading] = useState(false);
    const [hasNew, setHasNew] = useState(false);
    const notifRef = useRef(null);
    const bellRef = useRef(null);

    const checkAuth = () => {
        try {
            const data = localStorage.getItem(UTUBE_USER);
            setUser(data ? JSON.parse(data) : null);
        } catch (e) {
            setUser(null);
        }
    };

    useEffect(() => {
        // Real-time Reactivity: Listen for internal dispatch
        window.addEventListener('authChange', checkAuth);

        // External Reactivity: Listen for storage changes (other tabs)
        const handleStorageChange = (e) => {
            if (e.key === UTUBE_TOKEN || e.key === UTUBE_USER) {
                checkAuth();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('authChange', checkAuth);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // ── Close dropdowns on outside click ──
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target) &&
                bellRef.current && !bellRef.current.contains(e.target)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── Fetch subscription feed when bell is opened ──
    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        setNotifLoading(true);
        try {
            const res = await ApiClient.get('/feed/subscriptions', { params: { limit: 10 } });
            setNotifications(res.data);
            setHasNew(false); // Mark as read once opened
        } catch (err) {
            console.warn('Failed to load subscription feed:', err);
        } finally {
            setNotifLoading(false);
        }
    }, [user]);

    // ── Check for new subscription videos periodically ──
    useEffect(() => {
        if (!user) return;

        const checkNew = async (retries = 3) => {
            try {
                const res = await ApiClient.get('/feed/subscriptions', { params: { limit: 1 } });
                if (res.data.length > 0) {
                    setHasNew(true);
                }
            } catch (err) {
                // Determine if it is a network error/proxy error
                const isNetworkError = err.code === 'ERR_NETWORK' || !err.response;
                if (isNetworkError && retries > 0) {
                    console.warn(`Feed fetch failed. Retrying... (${retries} left)`);
                    setTimeout(() => checkNew(retries - 1), 2000);
                } else {
                    // Silently fail after retries
                    console.error("Feed feed definitive failure:", err.message);
                }
            }
        };

        // Delay initial check slightly to allow python backend to boot
        const startupTimeout = setTimeout(checkNew, 2000);

        const interval = setInterval(() => checkNew(), 60000); // Check every 60s

        return () => {
            clearTimeout(startupTimeout);
            clearInterval(interval);
        };
    }, [user]);

    const handleBellClick = () => {
        const newState = !isNotifOpen;
        setIsNotifOpen(newState);
        setIsMenuOpen(false); // Close profile menu
        if (newState) {
            fetchNotifications();
        }
    };

    const handleLogout = () => {
        localStorage.removeItem(UTUBE_TOKEN);
        localStorage.removeItem(UTUBE_USER);
        setUser(null);
        setIsMenuOpen(false);
        window.location.href = '/';
    };

    // ── Time ago helper ──
    const timeAgo = (dateStr) => {
        const now = new Date();
        const date = new Date(dateStr);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHrs = Math.floor(diffMins / 60);
        if (diffHrs < 24) return `${diffHrs}h ago`;
        const diffDays = Math.floor(diffHrs / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    return (
        <nav className="absolute top-0 left-0 right-0 z-50 glass border-b border-white/5 h-16 sm:h-20 flex items-center px-4 sm:px-8">
            <div className="flex items-center justify-between w-full max-w-[1800px] mx-auto">
                {/* Logo + Hamburger Section */}
                <div className="flex items-center gap-3 sm:gap-5">
                    {/* Hamburger toggle */}
                    <motion.button
                        onClick={toggleSidebar}
                        whileTap={{ scale: 0.88 }}
                        className="relative w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-white/8 transition-colors shrink-0"
                        title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                        aria-label="Toggle sidebar"
                    >
                        <motion.span
                            animate={isSidebarOpen
                                ? { rotate: 45, y: 6, width: '18px' }
                                : { rotate: 0, y: 0, width: '18px' }}
                            transition={{ duration: 0.22 }}
                            className="block h-[2px] bg-white/80 rounded-full origin-center"
                            style={{ width: 18 }}
                        />
                        <motion.span
                            animate={isSidebarOpen
                                ? { opacity: 0, scaleX: 0 }
                                : { opacity: 1, scaleX: 1 }}
                            transition={{ duration: 0.18 }}
                            className="block h-[2px] bg-white/80 rounded-full"
                            style={{ width: 14 }}
                        />
                        <motion.span
                            animate={isSidebarOpen
                                ? { rotate: -45, y: -6, width: '18px' }
                                : { rotate: 0, y: 0, width: '12px' }}
                            transition={{ duration: 0.22 }}
                            className="block h-[2px] bg-white/80 rounded-full origin-center"
                            style={{ width: 12 }}
                        />
                    </motion.button>

                    <Link to="/" className="flex items-center gap-2 group">
                        <motion.div
                            whileHover={{ rotate: -10, scale: 1.1 }}
                            className="w-28 sm:w-32"
                        >
                            <img src="/utube.png" alt="uTube" className="w-full h-auto object-contain drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]" />
                        </motion.div>
                    </Link>
                </div>

                {/* Search Bar - Center */}
                <div className="flex-1 max-w-2xl mx-4 sm:mx-8 hidden md:block">
                    <form onSubmit={handleSearch} className="relative group">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search porn videos..."
                            className="w-full bg-black/40 border border-white/10 rounded-full px-6 py-2.5 sm:py-3 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all text-sm group-hover:bg-black/60"
                        />
                        <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/80 group-hover:text-white/40 transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </button>
                    </form>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3 sm:gap-6">
                    {user ? (
                        <div className="flex items-center gap-4">
                            {/* Go Live Button */}
                            <Link to="/live">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-bold text-sm"
                                >
                                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                    <span className="hidden xs:inline">Canlı Yayın Aç</span>
                                </motion.button>
                            </Link>

                            {/* Upload Button */}
                            <Link to="/upload">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full hover:bg-white/10 transition-all font-bold text-sm"
                                >
                                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span className="hidden xs:inline">Upload</span>
                                </motion.button>
                            </Link>

                            {/* Welcome Text */}
                            <span className="hidden sm:block text-sm font-black text-white italic bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                                Welcum, <span className="text-primary">{user?.username || 'User'}</span>
                            </span>

                            {/* ── Notification Bell (functional) ── */}
                            <div className="relative">
                                <motion.button
                                    ref={bellRef}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    onClick={handleBellClick}
                                    className={`relative p-2 rounded-full transition-colors ${isNotifOpen ? 'bg-white/10' : 'hover:bg-white/10'
                                        }`}
                                    title="Subscription Feed"
                                >
                                    <svg className={`w-5 h-5 ${isNotifOpen ? 'text-white' : 'text-white/70'}`} fill={isNotifOpen ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    {hasNew && (
                                        <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-[var(--bg-primary)]"
                                        />
                                    )}
                                </motion.button>

                                {/* Notification Dropdown */}
                                <AnimatePresence>
                                    {isNotifOpen && (
                                        <motion.div
                                            ref={notifRef}
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl glass border border-white/10 shadow-2xl overflow-hidden"
                                        >
                                            {/* Header */}
                                            <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                                                <h3 className="font-bold text-sm">Subscriptions</h3>
                                                <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Latest uploads</span>
                                            </div>

                                            {/* Content */}
                                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                                                {notifLoading ? (
                                                    <div className="p-4 space-y-3">
                                                        {[...Array(4)].map((_, i) => (
                                                            <div key={i} className="flex gap-3 animate-pulse">
                                                                <div className="w-28 aspect-video bg-white/5 rounded-lg shrink-0" />
                                                                <div className="flex-1 space-y-2 py-1">
                                                                    <div className="h-3 bg-white/5 rounded w-full" />
                                                                    <div className="h-2 bg-white/5 rounded w-2/3" />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : notifications.length > 0 ? (
                                                    <div>
                                                        {notifications.map((video) => (
                                                            <Link
                                                                key={video.id}
                                                                to={`/video/${video.id}`}
                                                                className="flex gap-3 px-4 py-3 hover:bg-white/5 transition-colors group"
                                                                onClick={() => setIsNotifOpen(false)}
                                                            >
                                                                {/* Thumbnail */}
                                                                <div className="w-28 aspect-video rounded-lg overflow-hidden shrink-0 ring-1 ring-white/5">
                                                                    <img
                                                                        src={getValidUrl(video.thumbnail_url, THUMBNAIL_FALLBACK)}
                                                                        alt={video.title}
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                                                        onError={(e) => { e.target.src = THUMBNAIL_FALLBACK; }}
                                                                    />
                                                                </div>
                                                                {/* Info */}
                                                                <div className="flex-1 min-w-0 py-0.5">
                                                                    <p className="text-xs font-bold line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                                                        {video.title}
                                                                    </p>
                                                                    <p className="text-[10px] text-white/40 mt-1 truncate">
                                                                        {video.author?.username}
                                                                    </p>
                                                                    <p className="text-[10px] text-white/30 mt-0.5">
                                                                        {timeAgo(video.upload_date)} · {video.view_count?.toLocaleString()} views
                                                                    </p>
                                                                </div>
                                                            </Link>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="py-12 px-6 text-center">
                                                        <svg className="w-10 h-10 mx-auto mb-3 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                                        </svg>
                                                        <p className="text-white/30 text-sm font-medium">No new videos</p>
                                                        <p className="text-white/15 text-xs mt-1">Subscribe to channels to see their latest uploads here</p>
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="relative">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => { setIsMenuOpen(!isMenuOpen); setIsNotifOpen(false); }}
                                    className="w-10 h-10 rounded-full overflow-hidden border border-white/10 bg-surface relative group shadow-lg"
                                >
                                    <img
                                        src={getAvatarUrl(user?.profile_image, user?.username)}
                                        alt={user?.username || 'User'}
                                        className="w-full h-full object-cover"
                                    />
                                </motion.button>

                                <AnimatePresence>
                                    {isMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute right-0 mt-4 w-60 p-2 rounded-2xl glass border border-white/10 shadow-2xl overflow-hidden"
                                        >
                                            <div className="px-4 py-4 border-b border-white/5 mb-2 bg-white/5">
                                                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1.5 align-middle flex items-center gap-1.5">
                                                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                                                    Signed in as
                                                </p>
                                                <p className="font-bold text-white truncate text-sm">@{user?.username || 'Member'}</p>
                                                <p className="text-[10px] font-medium text-primary uppercase tracking-tighter mt-1 opacity-60">ID: {user?.id || '—'}</p>
                                            </div>

                                            <Link
                                                to="/profile"
                                                className="block px-4 py-3 rounded-xl hover:bg-white/5 text-white/70 hover:text-white font-bold text-sm transition-colors"
                                                onClick={() => setIsMenuOpen(false)}
                                            >
                                                My Profile
                                            </Link>

                                            <button
                                                onClick={handleLogout}
                                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 font-bold text-sm transition-colors flex items-center gap-2 group/logout"
                                            >
                                                <svg className="w-4 h-4 transition-transform group-hover/logout:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                                </svg>
                                                Sign Out
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <Link to="/login" className="text-sm font-bold text-white/60 hover:text-white transition-colors">
                                Sign In
                            </Link>
                            <Link to="/register">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-primary px-6 py-2.5 rounded-full text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                                >
                                    Register
                                </motion.button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
