import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getValidUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';
import { Link } from 'react-router-dom';

const HeroSection = ({ videos }) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Auto-rotate videos
    // Auto-rotate videos
    useEffect(() => {
        if (!videos || videos.length === 0) return;

        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % videos.length);
        }, 8000); // Change every 8 seconds

        return () => clearInterval(interval);
    }, [videos]);

    if (!videos || videos.length === 0) {
        return (
            <div className="h-[60vh] w-full bg-neutral-900 animate-pulse flex items-center justify-center">
                <span className="text-white/20 text-4xl font-black italic">uTube Premium</span>
            </div>
        );
    }

    const currentVideo = videos[currentIndex];

    return (
        <div className="relative w-full max-w-[95%] mx-auto mt-4 rounded-3xl overflow-hidden h-[55vh] bg-black shadow-2xl border border-white/5">
            <AnimatePresence mode='wait'>
                <motion.div
                    key={currentVideo.uniqueKey || currentVideo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 flex"
                >
                    {/* LEFT SIDE: Big Trending Number & Content */}
                    <div className="w-1/2 md:w-[45%] relative flex flex-col justify-end p-8 md:p-12 z-20">

                        {/* Giant Background Number */}
                        <div className="absolute inset-0 flex items-center justify-end pointer-events-none select-none overflow-hidden translate-x-16">
                            <span className="text-[200px] md:text-[350px] lg:text-[500px] font-black text-primary/20 leading-none">
                                {currentIndex + 1}
                            </span>
                        </div>

                        {/* Text Content */}
                        <motion.div
                            initial={{ opacity: 0, x: -30 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="relative"
                        >
                            <span className="bg-primary text-white text-xs font-black px-3 py-1 rounded mb-4 inline-block tracking-widest uppercase shadow-[0_0_15px_rgba(255,0,0,0.6)]">
                                Trending #{currentIndex + 1}
                            </span>
                            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 leading-tight tracking-tight drop-shadow-md">
                                {currentVideo.title}
                            </h1>
                            <p className="text-white/70 text-sm mb-8 line-clamp-3 font-medium max-w-md">
                                {currentVideo.description || "Experience the next generation of video content directly on uTube."}
                            </p>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                <Link to={`/video/${currentVideo.id}`}>
                                    <button className="bg-white text-black font-black px-8 py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 whitespace-nowrap">
                                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        Watch Now
                                    </button>
                                </Link>

                                {/* Comment Box (Optional/Contextual) */}
                                <div className="glass px-4 py-2 rounded-lg border-l-2 border-primary max-w-[200px] hidden lg:block">
                                    <p className="text-[10px] text-white/50 mb-1 uppercase font-bold tracking-wider">Top Comment</p>
                                    <p className="text-xs text-white/90 italic truncate">"Mind-blowing quality!"</p>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* RIGHT SIDE: Thumbnail Image */}
                    <div className="w-1/2 md:w-[55%] relative h-full bg-gradient-to-l from-black/0 to-black/80">
                        {/* Image Container */}
                        <div className="w-full h-full p-6 md:p-8 flex items-center justify-center">
                            <img
                                src={getValidUrl(currentVideo.thumbnail_url, THUMBNAIL_FALLBACK)}
                                alt={currentVideo.title}
                                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                                onError={(e) => { e.target.src = THUMBNAIL_FALLBACK; }}
                            />
                        </div>

                        {/* Vignette/Gradient to blend layout */}
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black via-transparent to-transparent" />
                    </div>

                </motion.div>
            </AnimatePresence>

            {/* Carousel Indicators */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                {videos.slice(0, 5).map((_, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentIndex(idx)}
                        className={`w-1.5 h-12 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-primary h-16 shadow-[0_0_10px_rgba(255,0,0,0.8)]' : 'bg-white/20 hover:bg-white/40'
                            }`}
                    />
                ))}
            </div>
        </div>
    );
};

export default HeroSection;
