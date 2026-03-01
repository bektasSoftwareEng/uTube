import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { UTUBE_TOKEN, UTUBE_USER } from '../utils/authConstants';

// ── Validation helpers (mirrors backend security.py rules) ──
// Stricter RFC 5322 approximation logic
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PASSWORD_RULES = [
    { test: (p) => p.length >= 8, label: 'At least 8 characters' },
    { test: (p) => /[A-Z]/.test(p), label: 'One uppercase letter' },
    { test: (p) => /[a-z]/.test(p), label: 'One lowercase letter' },
    { test: (p) => /[0-9]/.test(p), label: 'One digit' },
];

const Register = () => {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [emailChecking, setEmailChecking] = useState(false);
    const [isEmailVerified, setIsEmailVerified] = useState(null); // null = unverified, true = ok, false = bad

    const [error, setError] = useState('');
    const [touched, setTouched] = useState({});
    const navigate = useNavigate();

    // OTP Verification State
    const [verificationStep, setVerificationStep] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [resending, setResending] = useState(false);

    const sanitize = (str) => str.replace(/[<>]/g, '');

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleBlur = useCallback(async (e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));

        // Only check email if it matches basic regex first
        if (name === 'email' && value.length > 0) {
            if (!EMAIL_REGEX.test(value)) {
                setIsEmailVerified(false);
                return;
            }

            setEmailChecking(true);
            setIsEmailVerified(null);

            try {
                const res = await ApiClient.post('/auth/validate-email', { email: value });
                if (res.status === 200) {
                    setIsEmailVerified(true);
                    // Clear overarching error if they just fixed a bad email
                    setError(prev => prev.includes('email') ? '' : prev);
                }
            } catch (err) {
                setIsEmailVerified(false);
                if (err.response?.data?.detail) {
                    setError(err.response.data.detail);
                }
            } finally {
                setEmailChecking(false);
            }
        }
    }, [formData.email]);

    // ── Computed validation state ──
    const emailValid = EMAIL_REGEX.test(formData.email);
    const passwordChecks = useMemo(
        () => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(formData.password) })),
        [formData.password]
    );
    const passwordValid = passwordChecks.every((c) => c.passed);
    const confirmValid = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;
    const usernameValid = formData.username.length >= 3 && formData.username.length <= 50;
    const formValid = emailValid && passwordValid && confirmValid && usernameValid && isEmailVerified === true;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setTouched({ username: true, email: true, password: true, confirmPassword: true });

        if (!formValid) {
            if (isEmailVerified !== true) {
                setError('Please provide a working email address and wait for verification.');
            } else {
                setError('Please fix the highlighted errors before submitting.');
            }
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

            // Backend now returns verification_required instead of a token
            if (res.data.status === 'verification_required') {
                setVerificationEmail(res.data.email);
                setVerificationStep(true);
                setError('');
            } else {
                // Fallback: if backend somehow returns a token (shouldn't happen)
                navigate('/login');
            }
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

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (otpCode.length !== 6) {
            setError('Please enter the 6-digit code.');
            return;
        }

        setVerifyLoading(true);
        setError('');

        try {
            const res = await ApiClient.post('/auth/verify-email', {
                email: verificationEmail,
                code: otpCode
            });

            const { access_token, user_id, username } = res.data;
            if (access_token) {
                localStorage.setItem(UTUBE_TOKEN, access_token);

                // Fetch full profile from /me
                try {
                    const meRes = await ApiClient.get('/auth/me');
                    localStorage.setItem(UTUBE_USER, JSON.stringify(meRes.data));
                } catch {
                    localStorage.setItem(UTUBE_USER, JSON.stringify({
                        id: user_id, username: username || formData.username, email: verificationEmail, profile_image: null
                    }));
                }

                window.dispatchEvent(new Event('authChange'));
                navigate('/');
            }
        } catch (err) {
            console.error("Verification Error:", err);
            let errorMessage = 'Verification failed. Please check your code.';
            if (err.response?.data?.detail) {
                const detail = err.response.data.detail;
                errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
            }
            setError(errorMessage);
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleResendCode = async () => {
        setResending(true);
        setError('');
        try {
            await ApiClient.post('/auth/resend-otp', {
                email: verificationEmail
            });
            setOtpCode('');
            setError('A new verification code has been sent!');
        } catch (err) {
            setError(err.response?.data?.detail || 'Could not resend code. Please try registering again.');
        } finally {
            setResending(false);
        }
    };

    // ── Fixed-space validation hint: always reserves vertical space to prevent layout shift ──
    const FieldHint = ({ show, valid, text }) => (
        <div className="min-h-[20px] mt-1 ml-1">
            <p className={`text-xs font-medium transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'} ${valid ? 'text-green-400' : 'text-red-400'}`}>
                {valid ? '✓ ' : '✗ '}{text}
            </p>
        </div>
    );

    const inputBorderClass = (fieldName, isValid, customOverride = null) => {
        if (!touched[fieldName] || formData[fieldName] === '') return 'border-gray-800';
        if (customOverride !== null) {
            return customOverride ? 'border-green-500/50' : 'border-red-500/50';
        }
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
                        {verificationStep ? 'Verify Your Email' : 'Join the Elite'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {verificationStep
                            ? `Enter the 6-digit code sent to ${verificationEmail}`
                            : 'Create your creator account today'}
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
                                className={`p-3 rounded-2xl border text-sm font-medium flex items-center gap-3 backdrop-blur-sm ${error.includes('sent!')
                                    ? 'bg-green-900/20 border-green-500/50 text-green-200'
                                    : 'bg-red-900/20 border-[#e50914]/50 text-red-200'
                                    }`}
                            >
                                <span className="text-lg">{error.includes('sent!') ? '✅' : '⚠️'}</span>
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* ── OTP Verification Step ── */}
                {verificationStep ? (
                    <form onSubmit={handleVerifyOtp} className="space-y-5">
                        <div className="group">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 group-focus-within:text-[#e50914] transition-colors">
                                Verification Code
                            </label>
                            <input
                                type="text"
                                maxLength={6}
                                value={otpCode}
                                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="w-full bg-white/5 border border-gray-800 text-white px-5 py-4 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 focus:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all duration-300 placeholder-gray-600 backdrop-blur-xl text-center text-2xl tracking-[0.5em] font-mono"
                                placeholder="000000"
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={verifyLoading || otpCode.length !== 6}
                            className="w-full bg-[#e50914] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:scale-[1.02] text-lg"
                        >
                            {verifyLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Verifying...
                                </span>
                            ) : 'Verify & Sign In'}
                        </button>

                        <div className="text-center pt-2">
                            <button
                                type="button"
                                onClick={handleResendCode}
                                disabled={resending}
                                className="text-gray-400 text-sm hover:text-[#e50914] transition-colors disabled:opacity-50"
                            >
                                {resending ? 'Sending...' : "Didn't receive the code? Resend"}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* ── Registration Form ── */
                    <>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {/* Username */}
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
                                    className={`w-full bg-white/5 border ${inputBorderClass('username', usernameValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 focus:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                    placeholder="Create a unique username"
                                />
                                <FieldHint
                                    show={touched.username && formData.username.length > 0}
                                    valid={usernameValid}
                                    text={usernameValid ? 'Looks good' : 'Must be 3–50 characters'}
                                />
                            </div>

                            {/* Email with Live Backend Verification */}
                            <div className="group">
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-1.5 group-focus-within:text-[#e50914] transition-colors">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => {
                                        handleChange(e);
                                        setIsEmailVerified(null); // Reset on re-type
                                    }}
                                    onBlur={handleBlur}
                                    className={`w-full bg-white/5 border ${inputBorderClass('email', emailValid, isEmailVerified)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                    placeholder="name@example.com"
                                />
                                {/* Live Backend Email Verification Field Hint */}
                                <div className="min-h-[20px] mt-1 ml-1">
                                    {touched.email && formData.email.length > 0 && (
                                        <p className={`text-xs font-medium transition-opacity duration-200 
                                  ${emailChecking ? 'text-gray-400'
                                                : isEmailVerified ? 'text-green-400'
                                                    : 'text-red-400'}`}>
                                            {emailChecking
                                                ? '⏳ Checking email...'
                                                : isEmailVerified
                                                    ? '✓ Email is verified'
                                                    : '✗ Invalid email or domain'}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Password */}
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
                                    className={`w-full bg-white/5 border ${inputBorderClass('password', passwordValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 focus:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                    placeholder="••••••••"
                                />
                                {/* Password strength checklist — always rendered at fixed height, opacity-only transition */}
                                <div className={`mt-1.5 ml-1 space-y-0.5 transition-opacity duration-200 ${showPasswordChecklist ? 'opacity-100' : 'opacity-0'}`}>
                                    {passwordChecks.map((rule) => (
                                        <div key={rule.label} className={`flex items-center gap-2 text-xs font-medium transition-colors ${rule.passed ? 'text-green-400' : 'text-white/30'}`}>
                                            <span className="text-[10px]">{rule.passed ? '●' : '○'}</span>
                                            {rule.label}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Confirm Password */}
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
                                    className={`w-full bg-white/5 border ${inputBorderClass('confirmPassword', confirmValid)} text-white px-5 py-3 rounded-2xl focus:outline-none focus:border-[#e50914] focus:bg-white/10 focus:shadow-[0_0_15px_rgba(229,9,20,0.15)] transition-all duration-300 placeholder-gray-600 backdrop-blur-xl`}
                                    placeholder="••••••••"
                                />
                                <FieldHint
                                    show={touched.confirmPassword && formData.confirmPassword.length > 0}
                                    valid={confirmValid}
                                    text={confirmValid ? 'Passwords match' : 'Passwords do not match'}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !formValid}
                                className="w-full bg-[#e50914] hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-2xl transition-all duration-300 hover:scale-[1.02] mt-4 text-lg"
                            >
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>

                        <div className="mt-6 text-center border-t border-white/5 pt-4">
                            <p className="text-gray-400 text-sm">
                                Already have an account?{' '}
                                <Link to="/login" className="text-[#e50914] font-bold hover:text-red-400 transition-colors">
                                    Sign In
                                </Link>
                            </p>
                        </div>
                    </>
                )}
            </motion.div>
        </div>
    );
};

export default Register;
