import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { UTUBE_TOKEN, UTUBE_USER } from '../utils/authConstants';

const Login = () => {
    // FIX: Initialize with empty strings
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Simple Input Sanitization
    const sanitize = (str) => str.replace(/[<>]/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await ApiClient.post('/auth/login', {
                email: sanitize(email),
                password: password
            });

            const { access_token, user_id, username } = response.data;

            if (access_token) {
                // Storage
                localStorage.setItem(UTUBE_TOKEN, access_token);

                // Construct basic user object
                const userObj = {
                    id: user_id,
                    username: username,
                    email: email, // Fallback
                    profile_image: null
                };

                localStorage.setItem(UTUBE_USER, JSON.stringify(userObj));

                // Event & Redirect
                window.dispatchEvent(new Event('authChange'));
                navigate('/');
            }

        } catch (err) {
            console.error("Login Error:", err);

            // FIX: Robust Error Handling
            let errorMessage = 'Login failed. Please check your credentials.';

            if (err.response?.status === 401) {
                errorMessage = 'Hatalı giriş veya hesap mevcut değil. Lütfen tekrar kayıt olun.';
            } else if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                if (Array.isArray(detail)) {
                    errorMessage = detail[0]?.msg || JSON.stringify(detail);
                } else if (typeof detail === 'string') {
                    errorMessage = detail;
                }
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // Animation Variants
    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: { duration: 0.4, ease: "easeOut" }
        },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#0f0f0f] text-white selection:bg-[#e50914] selection:text-white relative overflow-hidden">
            {/* Cinematic Background Gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#251010] z-0" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0 pointer-events-none" />

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="w-full max-w-md p-8 rounded-3xl bg-black/40 border border-red-900/30 shadow-2xl backdrop-blur-xl relative z-10 ring-1 ring-white/5"
            >
                {/* Header Section */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-[#e50914] to-[#b2070f] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(229,9,20,0.4)] transform rotate-3 hover:rotate-6 transition-transform duration-300">
                        <span className="font-black text-3xl text-white italic tracking-tighter">u</span>
                    </div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Welcome Back</h2>
                    <p className="text-gray-400 text-sm">Sign in to your creator account</p>
                </div>

                {/* Error Message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="mb-6 p-4 rounded-2xl bg-red-900/20 border border-[#e50914]/50 text-red-200 text-sm font-medium flex items-center gap-3 backdrop-blur-sm shadow-[0_0_15px_rgba(229,9,20,0.1)]"
                        >
                            <span className="text-xl">⚠️</span>
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2 group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 group-focus-within:text-[#e50914] transition-colors">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-gray-800 text-white px-6 py-4 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 focus:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all duration-300 placeholder-gray-600 backdrop-blur-xl"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div className="space-y-2 group">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 group-focus-within:text-[#e50914] transition-colors">
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-gray-800 text-white px-6 py-4 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 focus:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all duration-300 placeholder-gray-600 backdrop-blur-xl"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#e50914] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_5px_20px_rgba(229,9,20,0.3)] hover:shadow-[0_5px_30px_rgba(229,9,20,0.5)] text-lg tracking-wide"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Authenticating...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-gray-400 text-sm">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-[#e50914] font-bold hover:text-red-400 transition-colors hover:underline decoration-2 underline-offset-4">
                            Join Now
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
