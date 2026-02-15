import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { UTUBE_TOKEN } from '../utils/authConstants';

const Upload = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [videoFile, setVideoFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem(UTUBE_TOKEN);
        if (!token) {
            navigate('/login');
        }
    }, [navigate]);

    const handleFileChange = (e) => {
        setVideoFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validation Check (Task 3)
        if (!videoFile) {
            setError('Please select a video file.');
            return;
        }

        const allowedTypes = ['video/mp4', 'video/webm', 'video/quicktime']; // mp4, webm, mov
        if (!allowedTypes.includes(videoFile.type)) {
            setError('Invalid file format. Please upload MP4, WebM, or MOV.');
            return;
        }

        const maxSize = 500 * 1024 * 1024; // 500MB
        if (videoFile.size > maxSize) {
            setError('File too large. Max size is 500MB.');
            return;
        }

        setIsUploading(true);
        setError(null);

        // 2. FormData Construction (Task 1)
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('video_file', videoFile);

        // Task 1: Verify all fields are present (as requested)
        console.log('--- FormData Payload Check ---');
        for (let [key, value] of formData.entries()) {
            console.log(`${key}:`, value instanceof File ? `${value.name} (${value.size} bytes)` : value);
        }

        try {
            // Task 1 & ApiClient Fix: 
            // We MUST ensure Content-Type is not "application/json" from ApiClient's defaults.
            // By passing null or omitting it while passing FormData, Axios usually handles it,
            // but to be safe against our specific ApiClient setup, we'll let Axios auto-detect.
            await ApiClient.post('/videos/', formData, {
                headers: {
                    // This forces Axios to calculate the boundary for FormData
                    'Content-Type': 'multipart/form-data',
                },
            });

            setSuccess(true);
            setTimeout(() => navigate('/'), 3000);
        } catch (err) {
            // Task 2: Robust Error Handling (No raw objects in JSX)
            console.error('Full Upload Error Object:', err);

            let msg = 'Upload failed. Please check the file format or try again.';
            const serverDetail = err.response?.data?.detail;

            if (typeof serverDetail === 'string') {
                msg = serverDetail;
            } else if (Array.isArray(serverDetail)) {
                // FastAPI validation error: [{ loc: [], msg: "", type: "" }]
                msg = serverDetail[0]?.msg || JSON.stringify(serverDetail[0]);
            } else if (serverDetail && typeof serverDetail === 'object') {
                msg = serverDetail.msg || JSON.stringify(serverDetail);
            } else if (err.message) {
                msg = err.message;
            }

            setError(String(msg)); // Force to string to be 100% safe for React
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-background">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl glass p-8 sm:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
            >
                {/* Decorative background elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <header className="mb-10 text-center">
                        <motion.div
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-2xl mb-6 shadow-xl shadow-primary/10 border border-primary/20"
                        >
                            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                        </motion.div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">Upload Content</h1>
                        <p className="text-white/40 font-medium">Share your lessons with the world.</p>
                    </header>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-100 rounded-2xl text-sm font-bold flex items-center gap-3 backdrop-blur-md"
                        >
                            <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">!</div>
                            {error}
                        </motion.div>
                    )}

                    {success && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="mb-8 p-4 bg-green-500/10 border border-green-500/20 text-green-100 rounded-2xl text-sm font-bold flex items-center gap-3 backdrop-blur-md"
                        >
                            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-lg">✓</div>
                            Upload successful! Redirecting to home...
                        </motion.div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="space-y-6">
                            <div className="group">
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-primary transition-colors">
                                    Lesson Title
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Enter a descriptive title"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-white/20 font-medium group-hover:bg-white/10 shadow-inner"
                                    required
                                />
                            </div>

                            <div className="group">
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-primary transition-colors">
                                    Description
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="What is this lesson about?"
                                    rows="4"
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-white/20 font-medium group-hover:bg-white/10 shadow-inner resize-none"
                                    required
                                />
                            </div>

                            <div className="group">
                                <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-primary transition-colors">
                                    Video File
                                </label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="video/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                        id="video-upload"
                                        required
                                    />
                                    <label
                                        htmlFor="video-upload"
                                        className="flex flex-col items-center justify-center w-full min-h-[160px] bg-white/5 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:bg-white/10 hover:border-primary/50 transition-all group/picker shadow-inner"
                                    >
                                        <div className="flex flex-col items-center justify-center py-6 text-center">
                                            <svg className="w-10 h-10 text-white/20 group-hover/picker:text-primary transition-colors mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            {videoFile ? (
                                                <span className="text-white font-bold">{videoFile.name}</span>
                                            ) : (
                                                <>
                                                    <p className="text-white font-bold text-sm mb-1 uppercase tracking-widest">Click to browse</p>
                                                    <p className="text-white/30 text-xs font-medium">MP4, WebM or MOV (Max 500MB)</p>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isUploading}
                            className={`w-full py-5 rounded-[1.25rem] text-sm font-black text-white shadow-2xl transition-all relative overflow-hidden group ${isUploading ? 'bg-primary/50' : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                                }`}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {isUploading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        UPLOADING... Please wait.
                                    </>
                                ) : (
                                    'PUBLISH LESSON'
                                )}
                            </span>
                        </motion.button>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default Upload;
