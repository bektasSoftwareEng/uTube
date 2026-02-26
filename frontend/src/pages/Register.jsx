import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';

// ── Validation helpers (mirrors backend security.py rules) ──
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const PASSWORD_RULES = [
    { test: (p) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
    { test: (p) => /[a-z]/.test(p), label: 'One lowercase letter' },
    { test: (p) => /[0-9]/.test(p), label: 'One digit' },
];

const Register = () => {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [otpCode, setOtpCode] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [touched, setTouched] = useState({});
    const navigate = useNavigate();

    const sanitize = (str) => str.replace(/[<>]/g, '');

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleBlur = useCallback((e) => {
        const { name } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));
    }, []);

    // ── Computed validation state ──
    const emailValid = EMAIL_REGEX.test(formData.email);
    const passwordChecks = useMemo(
        () => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(formData.password) })),
        [formData.password]
    );
    const passwordValid = passwordChecks.every((c) => c.passed);
    const confirmValid = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
    const usernameValid = formData.username.length >= 3 && formData.username.length <= 50;
    const formValid = emailValid && passwordValid && confirmValid && usernameValid;
    const otpValid = otpCode.length === 6;

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();
        setTouched({ username: true, email: true, password: true, confirmPassword: true });

        if (!formValid) {
            setError('Please fix the highlighted errors before submitting.');
            return;
        }

        setLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            const res = await ApiClient.post('/auth/register', {
                username: sanitize(formData.username),
                email: sanitize(formData.email),
                password: formData.password
            });

            // Move to OTP verification step
            setStep(2);
        } catch (err) {
            console.error("Registration Error:", err);
            let errorMessage = 'Registration failed. Try a different username or email.';
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                if (Array.isArray(detail)) {
                    errorMessage = detail[0]?.msg || JSON.stringify(detail);
                } else if (typeof detail === 'string') {
                    errorMessage = detail;
                } else {
                    errorMessage = JSON.stringify(detail);
                }
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifySubmit = async (e) => {
        e.preventDefault();
        if (!otpValid) return;

        setLoading(true);
        setError('');

        try {
            const res = await ApiClient.post('/auth/verify-email', {
                email: formData.email,
                code: otpCode
            });

            // Handle successful verification (Token received)
            const { access_token } = res.data;
            if (access_token) {
                localStorage.setItem('UTUBE_TOKEN', access_token);
                window.dispatchEvent(new Event('authChange'));
                navigate('/');
            } else {
                navigate('/login');
            }
        } catch (err) {
            console.error("Verification Error:", err);
            setError(err.response?.data?.detail || 'Invalid or expired verification code.');
        } finally {
            setLoading(false);
        }
    };

    // ── Fixed-space validation hint
    const FieldHint = ({ show, valid, text }) => (
        <div className="min-h-[20px] mt-1 ml-1">
            <p className={`text-xs font-medium transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'} ${valid ? 'text-green-400' : 'text-red-400'}`}>
                {valid ? '✓ ' : '✗ '}{text}
            </p>
        </div>
    );

    const inputBorderClass = (fieldName, isValid) => {
        if (!touched[fieldName] || formData[fieldName] === '') return 'border-gray-800';
        return isValid ? 'border-green-500/50' : 'border-red-500/50';
    };

    const showPasswordChecklist = touched.password || formData.password.length > 0;

    return (
        <div className="min-h-screen flex items-start justify-center px-4 py-8 bg-[#0f0f0f] text-white selection:bg-[#e50914] selection:text-white relative overflow-y-auto">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#251010] z-0" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 z-0 pointer-events-none" />

            <motion.div
                className="relative z-10 w-full max-w-md my-auto p-6 sm:p-8 rounded-3xl glass border border-white/10 shadow-2xl overflow-y-auto max-h-[calc(100vh-4rem)]"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                {/* Header Section */}
                <div className="text-center mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-[#e50914] to-[#b2070f] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(229,9,20,0.4)] transform rotate-3 transition-transform duration-300">
                        <span className="font-black text-2xl text-white italic tracking-tighter">u</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
                        {step === 1 ? 'Join the Elite' : 'Verify Email'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {step === 1 ? 'Create your creator account today' : `We sent a code to ${formData.email}`}
                    </p>
                </div>

                {/* Error Message */}
                <div className="min-h-[1px] mb-2">
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="p-3 rounded-2xl bg-red-900/20 border border-[#e50914]/50 text-red-200 text-sm font-medium flex items-center gap-3 backdrop-blur-sm"
                            >
                                <span className="text-lg">⚠️</span>
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Step 1: Registration Form */}
                {step === 1 && (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3">
                        <div className="group">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 group-focus-within:text-[#e50914] transition-colors">
                                Username
                            </label>
                            <input
                                type="text"
                                name="username"
                                required
                                value={formData.username}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`w-full bg-white/5 border ${inputBorderClass('username', usernameValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                placeholder="Create a unique username"
                            />
                            <FieldHint show={touched.username && formData.username.length > 0} valid={usernameValid} text={usernameValid ? 'Looks good' : 'Must be 3–50 characters'} />
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 group-focus-within:text-[#e50914] transition-colors">
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`w-full bg-white/5 border ${inputBorderClass('email', emailValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                placeholder="name@example.com"
                            />
                            <FieldHint show={touched.email && formData.email.length > 0} valid={emailValid} text={emailValid ? 'Valid email' : 'Enter a valid email address'} />
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 group-focus-within:text-[#e50914] transition-colors">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`w-full bg-white/5 border ${inputBorderClass('password', passwordValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                placeholder="••••••••"
                            />
                            <div className={`mt-1.5 ml-1 space-y-0.5 transition-opacity duration-200 ${showPasswordChecklist ? 'opacity-100' : 'opacity-0'}`}>
                                {passwordChecks.map((rule) => (
                                    <div key={rule.label} className={`flex items-center gap-2 text-xs font-medium transition-colors ${rule.passed ? 'text-green-400' : 'text-white/30'}`}>
                                        <span className="text-[10px]">{rule.passed ? '●' : '○'}</span>
                                        {rule.label}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="group">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 group-focus-within:text-[#e50914] transition-colors">
                                Confirm Password
                            </label>
                            <input
                                type="password"
                                name="confirmPassword"
                                required
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                className={`w-full bg-white/5 border ${inputBorderClass('confirmPassword', confirmValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                placeholder="••••••••"
                            />
                            <FieldHint show={touched.confirmPassword && formData.confirmPassword.length > 0} valid={confirmValid} text={confirmValid ? 'Passwords match' : 'Passwords do not match'} />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !formValid}
                            className="w-full bg-[#e50914] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:scale-[1.02] mt-4 text-lg"
                        >
                            {loading ? 'Processing...' : 'Continue'}
                        </button>
                    </form>
                )}

                {/* Step 2: OTP Verification Form */}
                {step === 2 && (
                    <motion.form
                        onSubmit={handleVerifySubmit}
                        className="space-y-6"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <div className="group text-center">
                            <label className="block text-sm font-bold text-gray-400 mb-3">
                                Enter 6-Digit Code
                            </label>
                            <input
                                type="text"
                                name="otpCode"
                                required
                                maxLength="6"
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))}
                                className="w-full text-center tracking-[1em] text-2xl font-black bg-white/5 border border-gray-800 text-white px-5 py-4 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 transition-all duration-300"
                                placeholder={"------"}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !otpValid}
                            className="w-full bg-[#e50914] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:scale-[1.02] text-lg mt-4"
                        >
                            {loading ? 'Verifying...' : 'Verify and Create Account'}
                        </button>

                        <div className="text-center text-sm text-gray-500 mt-4">
                            Didn't receive it? <span className="text-gray-400">Check your spam folder.</span>
                        </div>
                    </motion.form>
                )}

                {step === 1 && (
                    <div className="mt-6 text-center border-t border-white/5 pt-4">
                        <p className="text-gray-400 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="text-[#e50914] font-bold hover:text-red-400 transition-colors">
                                Sign In
                            </Link>
                        </p>
                    </div>
                )}
            </motion.div>
        </div>
    );
};

export default Register;

