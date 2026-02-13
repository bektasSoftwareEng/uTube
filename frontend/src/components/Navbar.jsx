import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Navbar = () => {
    return (
        <nav className="fixed top-0 left-0 right-0 h-16 glass z-50 px-4 md:px-8 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-black text-white italic">
                    u
                </div>
                <span className="text-xl font-bold tracking-tighter">uTube</span>
            </Link>

            <div className="hidden md:flex items-center flex-1 max-w-xl mx-8">
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Search videos..."
                        className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-2 focus:outline-none focus:border-primary/50 transition-colors"
                    />
                    <kbd className="absolute right-4 top-2 text-xs text-white/40 pointer-events-none">
                        Ctrl K
                    </kbd>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="text-sm font-medium hover:text-white/80 transition-colors"
                >
                    Sign In
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-full hover:bg-primary/90 transition-colors"
                >
                    Try Premium
                </motion.button>
            </div>
        </nav>
    );
};

export default Navbar;
