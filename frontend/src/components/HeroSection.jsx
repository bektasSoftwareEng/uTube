import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getValidUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';
import { Link } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';

// ── Typewriter hook ──────────────────────────────────────────────────────────
const useTypewriter = (text, speed = 75) => {
    const [displayed, setDisplayed] = useState('');
    const rafRef = useRef(null);

    useEffect(() => {
        setDisplayed('');
        if (!text) return;

        let i = 0;
        const tick = () => {
            i++;
            setDisplayed(text.slice(0, i));
            if (i < text.length) {
                rafRef.current = setTimeout(tick, speed);
            }
        };
        rafRef.current = setTimeout(tick, speed);
        return () => clearTimeout(rafRef.current);
    }, [text, speed]);

    return displayed;
};

// ── HeroSection ──────────────────────────────────────────────────────────────
const HeroSection = ({ videos }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showIndicators, setShowIndicators] = useState(true);
    const [topComment, setTopComment] = useState(null);

    // Auto-rotate videos
    useEffect(() => {
        if (!videos || videos.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % videos.length);
        }, 8000);
        return () => clearInterval(interval);
    }, [videos]);

    // Fetch top comment for current video
    useEffect(() => {
        const video = videos?.[currentIndex];
        if (!video?.id) return;

        setTopComment(null); // reset while loading
        ApiClient.get(`/videos/${video.id}/comments`, { params: { limit: 50 } })
            .then(res => {
                const comments = res.data || [];
                if (comments.length === 0) {
                    setTopComment('no-comments');
                    return;
                }
                const best = comments.reduce((top, c) => {
                    const topLikes = top?.like_count || 0;
                    const cLikes = c?.like_count || 0;
                    if (cLikes > topLikes) return c;
                    if (cLikes === topLikes) {
                        return new Date(c.created_at) > new Date(top.created_at) ? c : top;
                    }
                    return top;
                }, comments[0]);
                setTopComment(best);
            })
            .catch(() => setTopComment(null));
    }, [currentIndex, videos]);

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

            {/* ── TOP-LEFT: Trending Badge (fixed, above motion layer) ── */}
            <div className="absolute top-6 left-6 z-30 flex flex-col items-start gap-1.5">
                <AnimatePresence mode="wait">
                    <motion.span
                        key={currentIndex}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.3 }}
                        className="bg-primary text-white text-sm font-black px-4 py-2 rounded-lg inline-flex items-center gap-2 tracking-widest uppercase shadow-[0_0_20px_rgba(255,0,0,0.6)]"
                    >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        Trending #{currentIndex + 1}
                    </motion.span>
                </AnimatePresence>

                {/* Category label */}
                <AnimatePresence mode="wait">
                    {currentVideo.category && (
                        <motion.span
                            key={`cat-${currentIndex}`}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 6 }}
                            transition={{ duration: 0.3, delay: 0.1 }}
                            className="text-white/60 text-[11px] font-semibold uppercase tracking-widest pl-1"
                        >
                            {currentVideo.category}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Main slide area ── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentVideo.uniqueKey || currentVideo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0 flex"
                >
                    {/* LEFT: content */}
                    <div className="w-1/2 md:w-[45%] relative flex flex-col justify-end p-8 md:p-12 z-20">

                        {/* Giant background number */}
                        <div className="absolute inset-0 flex items-center justify-end pointer-events-none select-none overflow-hidden translate-x-16">
                            <span className="text-[200px] md:text-[350px] lg:text-[500px] font-black text-primary/20 leading-none">
                                {currentIndex + 1}
                            </span>
                        </div>

                        {/* Text content */}
                        <div className="relative pt-10">
                            {/* Animated title — typewriter */}
                            <TypewriterTitle text={currentVideo.title} />

                            {/* Actions row */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6">
                                <Link to={`/video/${currentVideo.id}`}>
                                    <button className="bg-white text-black font-black px-8 py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 whitespace-nowrap">
                                        <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                        Watch Now
                                    </button>
                                </Link>

                                {/* Top Comment chip — linked to real comments */}
                                <TopCommentChip
                                    comment={topComment}
                                    videoId={currentVideo.id}
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: thumbnail */}
                    <div className="w-1/2 md:w-[55%] relative h-full">
                        <div className="w-full h-full p-6 md:p-8 flex items-center justify-center">
                            <img
                                src={getValidUrl(currentVideo.thumbnail_url, THUMBNAIL_FALLBACK)}
                                alt={currentVideo.title}
                                className="max-w-full max-h-full object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
                                onError={(e) => { e.target.src = THUMBNAIL_FALLBACK; }}
                            />
                        </div>
                        <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-black via-transparent to-transparent" />
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* ── Carousel Indicators — toggleable ── */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-30">
                <AnimatePresence>
                    {showIndicators && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.25 }}
                            className="flex flex-col gap-3"
                        >
                            {videos.slice(0, 5).map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentIndex(idx)}
                                    className={`w-1.5 rounded-full transition-all duration-300 ${idx === currentIndex
                                        ? 'h-16 bg-primary shadow-[0_0_10px_rgba(255,0,0,0.8)]'
                                        : 'h-12 bg-white/20 hover:bg-white/40'
                                        }`}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toggle chevron */}
                <button
                    onClick={() => setShowIndicators(v => !v)}
                    className="w-5 h-5 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
                    title={showIndicators ? 'Hide navigation' : 'Show navigation'}
                >
                    <motion.svg
                        animate={{ rotate: showIndicators ? 0 : 180 }}
                        transition={{ duration: 0.2 }}
                        className="w-3 h-3 text-white/60"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </motion.svg>
                </button>
            </div>
        </div>
    );
};

// ── Typewriter title sub-component ──────────────────────────────────────────
const TypewriterTitle = ({ text }) => {
    const displayed = useTypewriter(text, 38);
    return (
        <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight tracking-tight drop-shadow-md min-h-[1.2em]">
            {displayed}
            {/* blinking cursor while typing */}
            {displayed.length < (text?.length || 0) && (
                <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.5 }}
                    className="inline-block w-0.5 h-[1em] bg-primary ml-0.5 align-middle"
                />
            )}
        </h1>
    );
};

// ── Top Comment chip sub-component ──────────────────────────────────────────
const TopCommentChip = ({ comment, videoId }) => {
    // Infrastructure: comment object comes from the parent's API fetch.
    // When clicked, it navigates to the video page which automatically opens comments.
    if (!comment) return null;

    if (comment === 'no-comments') {
        return (
            <Link
                to={`/video/${videoId}#comments`}
                className="glass px-4 py-2 rounded-lg border-l-2 border-white/20 max-w-[220px] hidden lg:block hover:border-white/40 hover:bg-white/5 transition-all group"
            >
                <p className="text-[10px] text-white/40 mb-1 uppercase font-bold tracking-wider flex items-center gap-1">
                    <svg className="w-2.5 h-2.5 text-white/40" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                    </svg>
                    Comments
                </p>
                <p className="text-xs text-white/50 italic truncate group-hover:text-white/70 transition-colors">
                    No comments yet.
                </p>
                <p className="text-[9px] text-white/30 mt-0.5 truncate">Be the first to comment</p>
            </Link>
        );
    }

    const authorName = comment.author?.username || 'Anonymous';
    const commentText = comment.text || '';

    return (
        <Link
            to={`/video/${videoId}#comments`}
            className="glass px-4 py-2 rounded-lg border-l-2 border-primary max-w-[220px] hidden lg:block hover:border-primary/80 hover:bg-white/5 transition-all group"
            title={`@${authorName}: ${commentText}`}
        >
            <p className="text-[10px] text-white/50 mb-1 uppercase font-bold tracking-wider flex items-center gap-1">
                <svg className="w-2.5 h-2.5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                </svg>
                Top Comment
                {comment.like_count > 0 && (
                    <span className="text-primary/70">· {comment.like_count} ♥</span>
                )}
            </p>
            <p className="text-xs text-white/80 italic truncate group-hover:text-white transition-colors">
                "{commentText}"
            </p>
            <p className="text-[9px] text-white/30 mt-0.5 truncate">— @{authorName}</p>
        </Link>
    );
};

export default HeroSection;
