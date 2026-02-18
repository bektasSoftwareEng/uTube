<<<<<<< Updated upstream

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { UTUBE_USER, UTUBE_TOKEN } from '../utils/authConstants';
=======
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { UTUBE_USER } from '../utils/authConstants';
>>>>>>> Stashed changes
import { getAvatarUrl } from '../utils/urlHelper';

const EditProfile = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
<<<<<<< Updated upstream
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
=======
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
>>>>>>> Stashed changes

    const [formData, setFormData] = useState({
        username: '',
        email: '',
<<<<<<< Updated upstream
        currentPassword: '',
        password: '',
        confirmPassword: ''
    });

    const [profileImage, setProfileImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

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
=======
        password: '', // Current password (needed for verification if changing password)
        new_password: '',
        confirm_password: ''
    });

    useEffect(() => {
        try {
            const data = localStorage.getItem(UTUBE_USER);
            if (data) {
                const parsedUser = JSON.parse(data);
                setUser(parsedUser);
                setFormData(prev => ({
                    ...prev,
                    username: parsedUser.username,
                    email: parsedUser.email
                }));
>>>>>>> Stashed changes
            } else {
                navigate('/login');
            }
        } catch (e) {
            navigate('/login');
        }
    }, [navigate]);

<<<<<<< Updated upstream
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setProfileImage(file);
            setImagePreview(URL.createObjectURL(file));
        }
=======
    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        // Clear errors when user types
        if (error) setError('');
>>>>>>> Stashed changes
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
<<<<<<< Updated upstream
        setError(null);
        setSuccess(null);
        setLoading(true);

        // Validation
        if (formData.password && formData.password !== formData.confirmPassword) {
            setError("Passwords do not match");
=======
        setLoading(true);
        setError('');
        setSuccess('');

        // Basic Validation
        if (formData.new_password && formData.new_password !== formData.confirm_password) {
            setError("New passwords do not match");
>>>>>>> Stashed changes
            setLoading(false);
            return;
        }

        try {
<<<<<<< Updated upstream
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
=======
            const updateData = {};
            if (formData.username && formData.username !== user.username) updateData.username = formData.username;
            if (formData.email && formData.email !== user.email) updateData.email = formData.email;
            if (formData.new_password) {
                updateData.new_password = formData.new_password;
                updateData.password = formData.password; // Send current password for verification
            }

            if (Object.keys(updateData).length === 0) {
                setLoading(false);
                return;
            }

            const response = await ApiClient.put('/auth/me', updateData);

            // Update local storage with new user data
            const updatedUser = { ...user, ...response.data };
            localStorage.setItem(UTUBE_USER, JSON.stringify(updatedUser));
            setUser(updatedUser);

            // Dispatch event for Navbar update
            window.dispatchEvent(new Event('authChange'));

            setSuccess('Profile updated successfully!');

            // Clear password fields
            setFormData(prev => ({
                ...prev,
                password: '',
                new_password: '',
                confirm_password: ''
            }));

            // Redirect back to profile after short delay
            setTimeout(() => {
                navigate('/profile');
            }, 1500);

        } catch (err) {
            console.error('Update failed:', err);
            setError(err.response?.data?.detail || 'Failed to update profile. Please check your inputs.');
>>>>>>> Stashed changes
        } finally {
            setLoading(false);
        }
    };

    if (!user) return null;

    return (
<<<<<<< Updated upstream
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
                                <img
                                    src={imagePreview || getAvatarUrl(user.profile_image, user.username)}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                />
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
=======
        <div className="min-h-screen pt-24 pb-12 px-4 md:px-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black text-white">
            <div className="max-w-2xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                    <h1 className="text-3xl font-black tracking-tighter mb-8 relative z-10">Edit Profile</h1>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl relative z-10">
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-200 rounded-xl relative z-10">
                            {success}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
                        {/* Avatar Preview (Read-only for now) */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10 bg-black">
                                <img
                                    src={getAvatarUrl(user.profile_image, user.username)}
                                    alt={user.username}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div>
                                <p className="font-bold">{user.username}</p>
                                <p className="text-white/40 text-sm">Profile picture change not yet supported</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-white/40">Username</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-white/40">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="border-t border-white/10 pt-6 mt-6">
                            <h3 className="text-lg font-bold mb-4">Change Password</h3>
                            <p className="text-white/40 text-sm mb-4">Leave blank if you don't want to change your password.</p>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-wider text-white/40">Current Password</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleChange}
                                        placeholder="Required if setting new password"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-all font-medium"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-white/40">New Password</label>
                                        <input
                                            type="password"
                                            name="new_password"
                                            value={formData.new_password}
                                            onChange={handleChange}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-all font-medium"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-wider text-white/40">Confirm New Password</label>
                                        <input
                                            type="password"
                                            name="confirm_password"
                                            value={formData.confirm_password}
                                            onChange={handleChange}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 transition-all font-medium"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => navigate('/profile')}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all border border-white/5 flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    'Save Changes'
                                )}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
>>>>>>> Stashed changes
        </div>
    );
};

export default EditProfile;
