import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { UTUBE_TOKEN } from '../utils/authConstants';

const Upload = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Centralized form data - Phase 5: State Persistence
    const [formData, setFormData] = useState({
        // Step 1: Details
        title: '',
        description: '',
        category: '',
        tags: [],  // Array of tag strings

        // Step 2: Media
        videoFile: null,
        thumbnailFile: null,

        // Step 3: Visibility
        visibility: 'public',  // 'public', 'unlisted', 'private'
        scheduledAt: '',  // ISO string
    });

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

        return () => {
            if (videoPreview) URL.revokeObjectURL(videoPreview);
            if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [navigate, videoPreview, thumbnailPreview]);

    // Phase 5: Update form data helper
    const updateFormData = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Phase 5: Tag handling
    const [tagInput, setTagInput] = useState('');

    const handleTagInputKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();  // Prevent form submit
            if (tagInput.trim() && formData.tags.length < 10) {
                updateFormData('tags', [...formData.tags, tagInput.trim()]);
                setTagInput('');
            }
        }
    };

    const removeTag = (indexToRemove) => {
        updateFormData('tags', formData.tags.filter((_, index) => index !== indexToRemove));
    };

    // Media handlers
    const handleVideoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (videoPreview) URL.revokeObjectURL(videoPreview);
            updateFormData('videoFile', file);
            setVideoPreview(URL.createObjectURL(file));
        }
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
            updateFormData('thumbnailFile', file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    // Navigation
    const goToStep = (step) => {
        if (currentStep === step) return;
        setCurrentStep(step);
    };

    // Final submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.videoFile) {
            setError('Please select a video file.');
            return;
        }

        const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (!allowedVideoTypes.includes(formData.videoFile.type)) {
            setError('Invalid video format. Please upload MP4, WebM, or MOV.');
            return;
        }

        if (formData.thumbnailFile) {
            const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedImageTypes.includes(formData.thumbnailFile.type)) {
                setError('Invalid thumbnail format. Please upload JPG, PNG, WEBP, or GIF.');
                return;
            }
        }

        const maxVideoSize = 500 * 1024 * 1024; // 500MB
        if (formData.videoFile.size > maxVideoSize) {
            setError('Video file too large. Max size is 500MB.');
            return;
        }

        setIsUploading(true);
        setError(null);
        setUploadProgress(0);

        abortControllerRef.current = new AbortController();

        // Phase 5: Build FormData with all fields
        const submitData = new FormData();
        submitData.append('title', formData.title);
        submitData.append('description', formData.description);
        submitData.append('category', formData.category);
        submitData.append('tags', JSON.stringify(formData.tags));  // Phase 5: JSON string
        submitData.append('visibility', formData.visibility);  // Phase 5
        if (formData.scheduledAt) {
            submitData.append('scheduled_at', formData.scheduledAt);  // Phase 5
        }
        submitData.append('video_file', formData.videoFile);
        if (formData.thumbnailFile) {
            submitData.append('thumbnail_file', formData.thumbnailFile);
        }

        try {
            await ApiClient.post('/videos/', submitData, {
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
            setError(null);

            setTimeout(() => {
                navigate('/');
            }, 2000);

        } catch (err) {
            if (err.name === 'CanceledError') {
                setError('Upload cancelled.');
            } else {
                setError(err.response?.data?.detail || 'Upload failed. Please try again.');
            }
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
            abortControllerRef.current = null;
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 flex items-center justify-center bg-background">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl glass p-8 sm:p-12 rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden"
            >
                {/* Decorative background */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    {/* Header */}
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
                        <h1 className="text-4xl font-black tracking-tight mb-2">Pro Creator Studio</h1>
                        <p className="text-white/40 font-medium">Professional video publishing in 3 simple steps</p>
                    </header>

                    {/* Phase 5: Tab Navigation */}
                    <div className="flex justify-between mb-10 relative">
                        {/* Progress Bar */}
                        <div className="absolute top-12 left-0 right-0 h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-purple-500"
                                initial={{ width: '0%' }}
                                animate={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>

                        {[
                            { step: 1, label: 'Details', icon: '📝' },
                            { step: 2, label: 'Media', icon: '🎬' },
                            { step: 3, label: 'Visibility', icon: '🌍' }
                        ].map(({ step, label, icon }) => (
                            <button
                                key={step}
                                onClick={() => goToStep(step)}
                                disabled={isUploading}
                                className={`flex-1 flex flex-col items-center gap-3 relative z-10 transition-all ${currentStep === step
                                        ? 'text-primary scale-105'
                                        : currentStep > step
                                            ? 'text-green-400'
                                            : 'text-white/30'
                                    }`}
                            >
                                <motion.div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${currentStep === step
                                            ? 'bg-primary shadow-lg shadow-primary/50'
                                            : currentStep > step
                                                ? 'bg-green-500/20 border-2 border-green-400'
                                                : 'bg-white/5'
                                        }`}
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {currentStep > step ? '✓' : icon}
                                </motion.div>
                                <span className="text-sm font-bold">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Error/Success Messages */}
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-100 rounded-2xl text-sm font-bold flex items-center gap-3"
                            >
                                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">!</div>
                                {error}
                            </motion.div>
                        )}

                        {success && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-6 p-4 bg-green-500/10 border border-green-500/20 text-green-100 rounded-2xl text-sm font-bold flex items-center gap-3"
                            >
                                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">✓</div>
                                Published successfully! Redirecting...
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Phase 5: Step Content */}
                    <form onSubmit={handleSubmit}>
                        <AnimatePresence mode="wait">
                            {/* Step 1: Details */}
                            {currentStep === 1 && (
                                <motion.div
                                    key="step1"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Title */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">Title *</label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => updateFormData('title', e.target.value)}
                                            required
                                            maxLength={200}
                                            disabled={isUploading}
                                            placeholder="Enter a catchy title..."
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">Description</label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => updateFormData('description', e.target.value)}
                                            disabled={isUploading}
                                            rows={4}
                                            placeholder="Tell viewers about your video..."
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all resize-none"
                                        />
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => updateFormData('category', e.target.value)}
                                            disabled={isUploading}
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all"
                                        >
                                            <option value="">Select a category...</option>
                                            <option value="Education">📚 Education</option>
                                            <option value="Technology">💻 Technology</option>
                                            <option value="Gaming">🎮 Gaming</option>
                                            <option value="Music">🎵 Music</option>
                                            <option value="Entertainment">🎭 Entertainment</option>
                                            <option value="Sports">⚽ Sports</option>
                                            <option value="News">📰 News</option>
                                            <option value="Other">🌐 Other</option>
                                        </select>
                                    </div>

                                    {/* Tags - Chip Input */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">
                                            Tags <span className="text-white/40 text-xs">(Press Enter to add, max 10)</span>
                                        </label>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {formData.tags.map((tag, index) => (
                                                <motion.span
                                                    key={index}
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.8, opacity: 0 }}
                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary/20 border border-primary/30 rounded-full text-sm font-bold"
                                                >
                                                    {tag}
                                                    <button
                                                        type="button"
                                                        onClick={() => removeTag(index)}
                                                        className="w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                                                    >
                                                        ×
                                                    </button>
                                                </motion.span>
                                            ))}
                                        </div>
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={handleTagInputKeyDown}
                                            disabled={isUploading || formData.tags.length >= 10}
                                            placeholder={formData.tags.length >= 10 ? "Maximum tags reached" : "Type and press Enter..."}
                                            className="w-full px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all"
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => goToStep(2)}
                                        disabled={!formData.title || isUploading}
                                        className="w-full py-4 bg-gradient-to-r from-primary to-purple-500 text-white font-black rounded-2xl hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next: Upload Media →
                                    </button>
                                </motion.div>
                            )}

                            {/* Step 2: Media */}
                            {currentStep === 2 && (
                                <motion.div
                                    key="step2"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Video File */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">Video File *</label>
                                        <input
                                            type="file"
                                            accept="video/mp4,video/webm,video/quicktime"
                                            onChange={handleVideoChange}
                                            disabled={isUploading}
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 transition-all"
                                        />
                                        {videoPreview && (
                                            <video src={videoPreview} controls className="mt-4 w-full rounded-2xl" />
                                        )}
                                    </div>

                                    {/* Thumbnail File */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">
                                            Custom Thumbnail <span className="text-white/40 text-xs">(optional)</span>
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/gif"
                                            onChange={handleThumbnailChange}
                                            disabled={isUploading}
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/20 file:text-primary hover:file:bg-primary/30 transition-all"
                                        />
                                        {thumbnailPreview && (
                                            <img src={thumbnailPreview} alt="Thumbnail preview" className="mt-4 w-full max-w-xs rounded-2xl" />
                                        )}
                                    </div>

                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => goToStep(1)}
                                            disabled={isUploading}
                                            className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => goToStep(3)}
                                            disabled={!formData.videoFile || isUploading}
                                            className="flex-1 py-4 bg-gradient-to-r from-primary to-purple-500 text-white font-black rounded-2xl hover:shadow-lg hover:shadow-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next: Set Visibility →
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Step 3: Visibility */}
                            {currentStep === 3 && (
                                <motion.div
                                    key="step3"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-6"
                                >
                                    {/* Visibility Options */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-4">Visibility</label>
                                        <div className="space-y-3">
                                            {[
                                                { value: 'public', label: '🌍 Public', desc: 'Everyone can watch' },
                                                { value: 'unlisted', label: '🔗 Unlisted', desc: 'Anyone with the link' },
                                                { value: 'private', label: '🔒 Private', desc: 'Only you' }
                                            ].map(({ value, label, desc }) => (
                                                <label
                                                    key={value}
                                                    className={`block p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.visibility === value
                                                            ? 'border-primary bg-primary/10'
                                                            : 'border-white/10 bg-white/5 hover:border-white/20'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="radio"
                                                            name="visibility"
                                                            value={value}
                                                            checked={formData.visibility === value}
                                                            onChange={(e) => updateFormData('visibility', e.target.value)}
                                                            disabled={isUploading}
                                                            className="w-5 h-5"
                                                        />
                                                        <div>
                                                            <div className="font-bold text-white">{label}</div>
                                                            <div className="text-sm text-white/50">{desc}</div>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Scheduled Publication */}
                                    <div>
                                        <label className="block text-sm font-bold text-white/60 mb-2">
                                            Schedule for Later <span className="text-white/40 text-xs">(optional)</span>
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={formData.scheduledAt}
                                            onChange={(e) => updateFormData('scheduledAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
                                            disabled={isUploading}
                                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:outline-none focus:border-primary/50 focus:bg-white/[0.07] transition-all"
                                        />
                                    </div>

                                    {/* Final Submit */}
                                    <div className="flex gap-4">
                                        <button
                                            type="button"
                                            onClick={() => goToStep(2)}
                                            disabled={isUploading}
                                            className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
                                        >
                                            ← Back
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isUploading}
                                            className="flex-1 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-black rounded-2xl hover:shadow-lg hover:shadow-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isUploading ? `Uploading... ${uploadProgress}%` : '✓ Publish Video'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </div>
            </motion.div>
        </div>
    );
};

export default Upload;
