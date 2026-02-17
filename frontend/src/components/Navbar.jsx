import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarUrl } from '../utils/urlHelper';
import { UTUBE_TOKEN, UTUBE_USER } from '../utils/authConstants';


const Navbar = () => {
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

    const handleLogout = () => {
        localStorage.removeItem(UTUBE_TOKEN);
        localStorage.removeItem(UTUBE_USER);
        setUser(null);
        setIsMenuOpen(false);
        window.location.href = '/';
    };

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5 h-16 sm:h-20 flex items-center px-4 sm:px-8">
            <div className="flex items-center justify-between w-full max-w-[1800px] mx-auto">
                {/* Logo Section */}
                <div className="flex items-center gap-4 sm:gap-8">
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
                    <div className="relative group">
                        <input
                            type="text"
                            placeholder="Search porn videos..."
                            className="w-full bg-black/40 border border-white/10 rounded-full px-6 py-2.5 sm:py-3 focus:outline-none focus:border-primary/50 focus:shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all text-sm group-hover:bg-black/60"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white/40">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-3 sm:gap-6">
                    {user ? (
                        <div className="flex items-center gap-4">
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

                            {/* Absolute Override: Prominent Display for XSS verification */}
                            <span className="hidden sm:block text-sm font-black text-white italic bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                                Welcome, <span className="text-primary">{user?.username || 'User'}</span>
                            </span>

                            <div className="relative">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
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
                            <Link to="/login" className="hidden xs:block text-sm font-bold text-white/60 hover:text-white transition-colors">
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
