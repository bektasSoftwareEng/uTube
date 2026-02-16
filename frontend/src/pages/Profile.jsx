import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { UTUBE_USER, UTUBE_TOKEN } from '../utils/authConstants';
import { getAvatarUrl } from '../utils/urlHelper';

const Profile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

    useEffect(() => {
        try {
            const data = localStorage.getItem(UTUBE_USER);
            if (data) {
                setUser(JSON.parse(data));
            } else {
                navigate('/login');
            }
        } catch (e) {
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem(UTUBE_TOKEN);
        localStorage.removeItem(UTUBE_USER);
        window.dispatchEvent(new Event('authChange'));
        navigate('/');
    };

    if (!user) return null;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black text-white">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
                >
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
                        {/* Avatar Section */}
                        <div className="flex-shrink-0 mx-auto md:mx-0">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                className="w-40 h-40 rounded-full p-1 bg-gradient-to-br from-primary to-purple-600 shadow-xl"
                            >
                                <div className="w-full h-full rounded-full overflow-hidden border-4 border-black/50 bg-black">
                                    <img
                                        src={getAvatarUrl(user.profile_image, user.username)}
                                        alt={user.username}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </motion.div>
                        </div>

                        {/* Info Section */}
                        <div className="flex-1 w-full text-center md:text-left">
                            <div className="mb-6">
                                <h1 className="text-4xl font-black tracking-tighter mb-2">{user.username}</h1>
                                <p className="text-white/60 font-medium">Member since {new Date(user.created_at).toLocaleDateString()}</p>
                            </div>

                            <div className="grid gap-4 max-w-lg">
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                    <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">Email</p>
                                    <p className="font-medium text-lg truncate">{user.email || 'No email provided'}</p>
                                </div>
                                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                                    <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-1">User ID</p>
                                    <p className="font-mono text-sm opacity-60 truncate">{user.id}</p>
                                </div>
                            </div>

                            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                                <button className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all border border-white/5 flex items-center justify-center gap-2 group">
                                    <svg className="w-5 h-5 text-white/60 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    Edit Profile
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-bold transition-all border border-red-500/10 flex items-center justify-center gap-2 group"
                                >
                                    <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Additional Content / Placeholder */}
                <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="glass rounded-3xl p-8 border border-white/10"
                    >
                        <h3 className="text-xl font-bold mb-4">My Uploads</h3>
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </div>
                            <p className="text-white/40 font-medium">No videos uploaded yet</p>
                            <button className="mt-4 text-primary font-bold text-sm hover:underline">Upload your first video</button>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="glass rounded-3xl p-8 border border-white/10"
                    >
                        <h3 className="text-xl font-bold mb-4">Account Stats</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-2xl font-black">0</p>
                                <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Subscribers</p>
                            </div>
                            <div className="bg-white/5 rounded-xl p-4">
                                <p className="text-2xl font-black">0</p>
                                <p className="text-xs text-white/40 uppercase tracking-wider font-bold">Total Views</p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
