import React, { useState, useEffect, useMemo } from 'react';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { UTUBE_USER, UTUBE_TOKEN } from '../utils/authConstants';
import { getAvatarUrl } from '../utils/urlHelper';



const EditProfile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const [formData, setFormData] = useState({
        username: '',
        email: '',
        currentPassword: '',
        password: '',
        confirmPassword: ''
    });

    const [profileImage, setProfileImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    const safeProfilePreview = useMemo(() => {
        const rawUrl = imagePreview || (user ? getAvatarUrl(user.profile_image, user.username) : '');
        return DOMPurify.sanitize(rawUrl, { ALLOWED_URI_REGEXP: /^(?:http:|https:|blob:)/ });
    }, [imagePreview, user]);

    useEffect(() => {
        try {
            const userData = localStorage.getItem(UTUBE_USER);
            if (userData) {
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
                setFormData({
                    username: parsedUser.username || '',
                    email: parsedUser.email || '',
                    currentPassword: '',
                    password: '',
                    confirmPassword: ''
                });
            } else {
                navigate('/login');
            }
        } catch (e) {
            navigate('/login');
        }
    }, [navigate]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setProfileImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        // Validation
        if (formData.password && formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            const submitData = new FormData();
            submitData.append('username', formData.username);
            submitData.append('email', formData.email);
            if (formData.password) {
                if (!formData.currentPassword) {
                    setError("Current password is required to set a new password");
                    setLoading(false);
                    return;
                }
                submitData.append('password', formData.password);
                submitData.append('current_password', formData.currentPassword);
            }
            if (profileImage) {
                submitData.append('file', profileImage);
            }

            const response = await ApiClient.put('/auth/me', submitData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Update local storage with new user data
            const updatedUser = response.data;
            localStorage.setItem(UTUBE_USER, JSON.stringify(updatedUser));
            setUser(updatedUser);

            setSuccess("Profile updated successfully!");
            setTimeout(() => navigate('/profile'), 1500);

        } catch (err) {
            console.error(err);
            const errorMsg = err.response?.data?.detail || "Failed to update profile";
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black text-white flex items-center justify-center">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                <h1 className="text-3xl font-black tracking-tighter mb-8 text-center">Edit Profile</h1>

                <AnimatePresence>
                    {error && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-center text-sm font-medium">
                            {error}
                        </motion.div>
                    )}
                    {success && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="bg-green-500/10 border border-green-500/50 text-green-200 px-4 py-3 rounded-xl mb-6 text-center text-sm font-medium">
                            {success}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

                    {/* Profile Picture Upload */}
                    <div className="flex flex-col items-center gap-4 mb-8">
                        <div className="relative group cursor-pointer">
                            <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/10 bg-black shadow-xl group-hover:border-white/30 transition-colors">
                                {safeProfilePreview && (
                                    <img
                                        src={safeProfilePreview}
                                        alt="Profile"
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                                <span className="text-xs font-bold uppercase tracking-wider">Change</span>
                                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                            </label>
                        </div>
                        <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Profile Picture</p>
                    </div>

                    {/* Inputs */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Username</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-white/10">
                        <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">New Password (Optional)</label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Leave blank to keep current password"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                        />
                    </div>

                    {formData.password && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Current Password</label>
                                <input
                                    type="password"
                                    value={formData.currentPassword}
                                    onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                    required
                                />
                                <p className="text-xs text-white/40 ml-1">Required to confirm password change</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-white/60 uppercase tracking-widest ml-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={formData.confirmPassword}
                                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-primary/50 focus:bg-white/10 transition-all font-medium"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-6">
                        <button
                            type="button"
                            onClick={() => navigate('/profile')}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/80 hover:to-purple-600/80 text-white font-bold rounded-xl shadow-lg transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? "Saving..." : "Save Changes"}
                        </button>
                    </div>

                </form>
            </motion.div>
        </div>
    );
};

export default EditProfile;
