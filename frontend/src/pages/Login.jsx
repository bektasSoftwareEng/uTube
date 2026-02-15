import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { UTUBE_TOKEN, UTUBE_USER } from '../utils/authConstants';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Simple Input Sanitization for XSS Prevention
    const sanitize = (str) => str.replace(/[<>]/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            console.log('--- AUTH DEBUG START ---');
            console.log('Login: Attempting auth...');
            const response = await ApiClient.post('/auth/login', {
                email: sanitize(email),
                password: password
            });

            // LOUD DEBUGGER: Log exactly what came back
            console.log('Login: Response data received', response.data);

            let { access_token, user_id, username } = response.data;

            // Atomic Storage Step
            localStorage.setItem(UTUBE_TOKEN, access_token);

            // MANUAL CONSTRUCTION: Backend returns limited info, so we build the object here
            const manualUser = {
                id: user_id,
                username: username,
                // Fallback values for UI consistency
                email: email,
                profile_image: null,
                created_at: new Date().toISOString()
            };

            if (manualUser) {
                // Save session
                localStorage.setItem(UTUBE_USER, JSON.stringify(manualUser));

                // Notify other components
                window.dispatchEvent(new Event('authChange'));

                // Instant Redirect for Production
                window.location.href = '/';
            } else {
                setError('Could not retrieve user profile even with fallback.');
                setLoading(false);
            }

        } catch (err) {
            console.error('Login Error:', err);
            setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
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
                    <h2 className="text-3xl font-black tracking-tighter mb-2">Welcome Back</h2>
                    <p className="text-white/40 text-sm">Sign in to your account</p>
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

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2 ml-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-white/20"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black text-white/40 uppercase tracking-widest mb-2 ml-1">
                            Password
                        </label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-white/20"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-primary/20"
                    >
                        {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-white/5 pt-6">
                    <p className="text-white/40 text-sm">
                        Don't have an account?{' '}
                        <Link to="/register" className="text-primary font-black hover:underline">
                            Join Now
                        </Link>
                    </p>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
