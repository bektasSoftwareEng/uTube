import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        full_name: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [strengthHints, setStrengthHints] = useState([]);
    const navigate = useNavigate();

    // Simple Input Sanitization for XSS Prevention
    const sanitize = (str) => str.replace(/[<>]/g, '');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            await ApiClient.post('/auth/register', {
                username: sanitize(formData.username),
                email: sanitize(formData.email),
                password: formData.password
            });

            navigate('/login');

        } catch (err) {
            setError(err.response?.data?.detail || 'Registration failed. Try a different username or email.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black text-white">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md p-8 rounded-3xl glass border border-white/10 shadow-2xl"
            >
                <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center font-black text-2xl text-white italic mx-auto mb-4 italic">
                        u
                    </div>
                    <h2 className="text-3xl font-black tracking-tighter mb-2">Join uTube</h2>
                    <p className="text-white/40 text-sm">Create your creator account</p>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium"
                    >
                        {error}
                    </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2 ml-1">
                            Username
                        </label>
                        <input
                            type="text"
                            name="username"
                            required
                            value={formData.username}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-sm text-white placeholder:text-white/20"
                            placeholder="johndoe"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2 ml-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-sm text-white placeholder:text-white/20"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2 ml-1">
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            required
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-sm text-white placeholder:text-white/20"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2 ml-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            name="confirmPassword"
                            required
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-sm text-white placeholder:text-white/20"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20 mt-4"
                    >
                        {loading ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-white/40 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-primary font-black hover:underline">
                            Sign In
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Register;
