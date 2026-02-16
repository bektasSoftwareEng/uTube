import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { UTUBE_TOKEN } from '../utils/authConstants';

const Upload = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [videoFile, setVideoFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Preview URLs for memory management
    const [videoPreview, setVideoPreview] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);

    const navigate = useNavigate();
    const abortControllerRef = useRef(null);

    // Protection and Memory Management
    useEffect(() => {
        const token = localStorage.getItem(UTUBE_TOKEN);
        if (!token) {
            navigate('/login');
        }

        // Cleanup function for previews (Task 2: Memory Management)
        return () => {
            if (videoPreview) URL.revokeObjectURL(videoPreview);
            if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
            // Task 2: Abort Control (Cleanup on unmount)
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [navigate, videoPreview, thumbnailPreview]);

    const handleVideoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (videoPreview) URL.revokeObjectURL(videoPreview);
            setVideoFile(file);
            setVideoPreview(URL.createObjectURL(file));
        }
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
            setThumbnailFile(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 1. Validation
        if (!videoFile) {
            setError('Please select a video file.');
            return;
        }

        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!allowedVideoTypes.includes(videoFile.type)) {
            setError('Invalid video format. Please upload MP4, WebM, or MOV.');
            return;
        }

        if (thumbnailFile) {
            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedImageTypes.includes(thumbnailFile.type)) {
                setError('Invalid thumbnail format. Please upload JPG, PNG, WEBP, or GIF.');
                return;
            }
        }

        const maxVideoSize = 500 * 1024 * 1024; // 500MB
        if (videoFile.size > maxVideoSize) {
            setError('Video file too large. Max size is 500MB.');
            return;
        }

        // 2. Submission Guard & State Reset
        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        // Task 2: Abort Control
        abortControllerRef.current = new AbortController();

        // 3. FormData Construction
        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('video_file', videoFile);
        if (thumbnailFile) {
            formData.append('thumbnail_file', thumbnailFile);
        }

        try {
            // Task 3: Logic (onUploadProgress)
            await ApiClient.post('/videos/', formData, {
                signal: abortControllerRef.current.signal,
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round(
                        (progressEvent.loaded * 100) / progressEvent.total
                    );
                    setUploadProgress(percentCompleted);
                },
            });

            setSuccess(true);
            // Task 4: Redirect after 1.5s
            setTimeout(() => navigate('/'), 1500);
        } catch (err) {
            if (err.name === 'CanceledError' || err.name === 'AbortError') {
                console.log('Upload aborted by user');
                return;
            }

            console.error('Advanced Upload Error:', err);

            // Task 3: Defensive Catch
            let displayError = 'Upload failed. Please check the file format or try again.';
            const serverDetail = err.response?.data?.detail;

            if (typeof serverDetail === 'string') {
                displayError = serverDetail;
            } else if (Array.isArray(serverDetail)) {
                displayError = serverDetail[0]?.msg || JSON.stringify(serverDetail[0]);
            } else if (serverDetail && typeof serverDetail === 'object') {
                displayError = serverDetail.msg || JSON.stringify(serverDetail);
            } else if (err.message) {
                displayError = err.message;
            }

            setError(String(displayError));
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-background">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-3xl glass p-8 sm:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
            >
                {/* Decorative background elements */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl text-primary" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl text-purple-500" />

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
                        <h1 className="text-4xl font-black tracking-tight mb-2">Publish a Video</h1>
                        <p className="text-white/40 font-medium">Share your high-quality porn content with fellow jerk mates.</p>
                    </header>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-100 rounded-2xl text-sm font-bold flex items-center gap-3 backdrop-blur-md overflow-hidden"
                            >
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 shadow-lg font-black italic">!</div>
                                {error}
                            </motion.div>
                        )}

                        {success && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-8 p-4 bg-green-500/10 border border-green-500/20 text-green-100 rounded-2xl text-sm font-bold flex items-center gap-3 backdrop-blur-md overflow-hidden"
                            >
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-lg">✓</div>
                                Content published successfully! Redirecting...
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Left Side: Metadata */}
                            <div className="space-y-6">
                                <div className="group">
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-primary transition-colors">
                                        Title
                                    </label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Video Title..."
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-white/20 font-medium group-hover:bg-white/10 shadow-inner"
                                        required
                                        disabled={isUploading}
                                    />
                                </div>

                                <div className="group">
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 group-focus-within:text-primary transition-colors">
                                        Description
                                    </label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="what do you want to share?"
                                        rows="6"
                                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-white/20 font-medium group-hover:bg-white/10 shadow-inner resize-none"
                                        required
                                        disabled={isUploading}
                                    />
                                </div>
                            </div>

                            {/* Right Side: Media Pickers */}
                            <div className="space-y-6">
                                {/* Video Picker */}
                                <div className="group">
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors">
                                        Video File
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="video/*"
                                            onChange={handleVideoChange}
                                            className="hidden"
                                            id="video-upload"
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="video-upload"
                                            className="flex flex-col items-center justify-center w-full min-h-[140px] bg-white/5 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:bg-white/10 hover:border-primary/50 transition-all group/picker shadow-inner overflow-hidden"
                                        >
                                            {videoPreview ? (
                                                <video src={videoPreview} className="w-full h-full object-cover max-h-[140px]" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                                    <svg className="w-8 h-8 text-white/20 group-hover/picker:text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Pick Video</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>

                                {/* Custom Thumbnail Picker (Task 1) */}
                                <div className="group">
                                    <label className="block text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1 transition-colors">
                                        Custom Thumbnail (Optional)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailChange}
                                            className="hidden"
                                            id="thumbnail-upload"
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="thumbnail-upload"
                                            className="flex flex-col items-center justify-center w-full min-h-[120px] bg-white/5 border-2 border-dashed border-white/10 rounded-3xl cursor-pointer hover:bg-white/10 hover:border-primary/50 transition-all group/picker shadow-inner overflow-hidden"
                                        >
                                            {thumbnailPreview ? (
                                                <img src={thumbnailPreview} alt="Preview" className="w-full h-full object-cover max-h-[120px]" />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center py-6 text-center">
                                                    <svg className="w-8 h-8 text-white/20 group-hover/picker:text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <p className="text-white/40 text-[10px] font-black uppercase tracking-widest">Select Image</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Task 1: Progress Bar */}
                        <AnimatePresence>
                            {isUploading && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="space-y-4"
                                >
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                            {uploadProgress === 100 ? 'Processing on Server...' : 'File Transfer...'}
                                        </span>
                                        <span className="text-xl font-black text-white italic">{uploadProgress}%</span>
                                    </div>
                                    <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[2px]">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${uploadProgress}%` }}
                                            transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                                            className="h-full bg-gradient-to-r from-primary/50 to-primary rounded-full shadow-[0_0_15px_rgba(255,59,48,0.3)]"
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button
                            whileHover={{ scale: isUploading ? 1 : 1.02 }}
                            whileTap={{ scale: isUploading ? 1 : 0.98 }}
                            type="submit"
                            disabled={isUploading} // Task 2: Submission Guard
                            className={`w-full py-5 rounded-[1.25rem] text-sm font-black text-white shadow-2xl transition-all relative overflow-hidden group ${isUploading ? 'bg-white/5 text-white/40 cursor-not-allowed border border-white/5' : 'bg-primary hover:bg-primary/90 shadow-primary/20'
                                }`}
                        >
                            <span className="relative z-10 flex items-center justify-center gap-3">
                                {isUploading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        UPLOAD IN PROGRESS
                                    </>
                                ) : (
                                    'PUBLISH VIDEO'
                                )}
                            </span>
                        </motion.button>

                        {isUploading && (
                            <p className="text-center text-[10px] font-bold text-white/20 uppercase tracking-widest mt-4">
                                Please do not close this window while the upload is active.
                            </p>
                        )}
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default Upload;
