import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const PlayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M8 5v14l11-7z" />
    </svg>
);
const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);
const ReplayIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
    </svg>
);
const VolumeHighIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
);
const VolumeMutedIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
);
const VolumeLowIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
    </svg>
);
const FullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
);
const ExitFullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
    </svg>
);
const PipIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <rect x="3" y="6" width="18" height="12" rx="2" ry="2" />
        <rect x="12" y="11" width="7" height="5" rx="1" ry="1" fill="currentColor" stroke="none" />
    </svg>
);
const SettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

// ── Tooltip wrapper ────────────────────────────────────────────────────────────
const Tip = ({ label, children }) => (
    <div className="group/tip relative flex items-center">
        {children}
        <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50">
            {label}
        </div>
    </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const VideoPlayer = ({ src, poster, onError,
    availableResolutions,
    transcodeStatus,
    title,
    channelName,
    onAutoplayEnd
}) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressRef = useRef(null);
    const hideTimer = useRef(null);
    const idleTimerRef = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [ended, setEnded] = useState(false);
    const [buffering, setBuffering] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('utube_volume');
        return saved !== null ? parseFloat(saved) : 1;
    });
    const [muted, setMuted] = useState(() => {
        const saved = localStorage.getItem('utube_muted');
        return saved === 'true';
    });
    const [fullscreen, setFullscreen] = useState(false);
    const [isIdle, setIsIdle] = useState(false);
    const [seeking, setSeeking] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [settingsMenuState, setSettingsMenuState] = useState('closed');
    const [playbackRate, setPlaybackRate] = useState(() => {
        const saved = localStorage.getItem('utube_playbackRate');
        return saved !== null ? parseFloat(saved) : 1;
    });
    const [quality, setQuality] = useState('Auto');
    const [pipActive, setPipActive] = useState(false);
    const [showVolume, setShowVolume] = useState(false);
    const [autoplayEnabled, setAutoplayEnabled] = useState(true);
    const [skipIndicator, setSkipIndicator] = useState(null); // { type: 'forward' | 'backward', key: number }

    const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    // Override Quality list specifically formatted per the new user request
    const QUALITIES = React.useMemo(() => {
        return ['Auto', '1080p', '720p', '480p', '360p', '144p', 'Original'];
    }, []);

    const isTranscoding = transcodeStatus === 'processing';

    // ── Idle state: hide overlays after 2.5s of no mouse movement ─────────────
    const IDLE_DELAY_MS = 2500;
    const settingsMenuClosedRef = useRef(true);
    settingsMenuClosedRef.current = settingsMenuState === 'closed';

    const startIdleTimer = useCallback(() => {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            if (settingsMenuClosedRef.current) setIsIdle(true);
        }, IDLE_DELAY_MS);
    }, []);

    const handleActivity = useCallback(() => {
        setIsIdle(false);
        startIdleTimer();
    }, [startIdleTimer]);

    useEffect(() => {
        return () => clearTimeout(idleTimerRef.current);
    }, []);

    // When playing starts, start idle timer; when paused/ended, show overlays
    useEffect(() => {
        if (playing) startIdleTimer();
        else setIsIdle(false);
    }, [playing, startIdleTimer]);

    // Show overlays when not idle OR when paused/ended (always show controls when paused)
    const showOverlays = !isIdle || !playing;
    const revealControls = handleActivity;

    // ── Video event bindings ────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const onPlay = () => { setPlaying(true); setEnded(false); setBuffering(false); };
        const onPause = () => setPlaying(false);
        const onEnded = () => {
            setPlaying(false);
            setEnded(true);
            setBuffering(false);
            if (autoplayEnabled && onAutoplayEnd) {
                onAutoplayEnd();
            }
        };
        const onTimeUpdate = () => {
            setCurrentTime(v.currentTime);
            if (v.buffered.length > 0) {
                setBuffered(v.buffered.end(v.buffered.length - 1));
            }
        };
        const onDurationChange = () => setDuration(v.duration);
        const onLoadedMetadata = () => {
            setDuration(v.duration);
            setCurrentTime(v.currentTime);
        };
        const onVolumeChange = () => { setVolume(v.volume); setMuted(v.muted); };
        const onRateChange = () => setPlaybackRate(v.playbackRate);
        const onWaiting = () => setBuffering(true);
        const onCanPlay = () => setBuffering(false);
        const onPlaying = () => setBuffering(false);

        v.addEventListener('play', onPlay);
        v.addEventListener('pause', onPause);
        v.addEventListener('ended', onEnded);
        v.addEventListener('timeupdate', onTimeUpdate);
        v.addEventListener('durationchange', onDurationChange);
        v.addEventListener('loadedmetadata', onLoadedMetadata);
        v.addEventListener('volumechange', onVolumeChange);
        v.addEventListener('ratechange', onRateChange);
        v.addEventListener('waiting', onWaiting);
        v.addEventListener('canplay', onCanPlay);
        v.addEventListener('playing', onPlaying);

        // Sync initial persisted values to the video element DOM when mounted
        v.volume = volume;
        v.muted = muted;
        v.playbackRate = playbackRate;

        if (v.readyState >= 1) {
            setDuration(v.duration);
            setCurrentTime(v.currentTime);
            if (v.buffered.length > 0) {
                setBuffered(v.buffered.end(v.buffered.length - 1));
            }
        }

        return () => {
            v.removeEventListener('play', onPlay);
            v.removeEventListener('pause', onPause);
            v.removeEventListener('ended', onEnded);
            v.removeEventListener('timeupdate', onTimeUpdate);
            v.removeEventListener('durationchange', onDurationChange);
            v.removeEventListener('loadedmetadata', onLoadedMetadata);
            v.removeEventListener('volumechange', onVolumeChange);
            v.removeEventListener('ratechange', onRateChange);
            v.removeEventListener('waiting', onWaiting);
            v.removeEventListener('canplay', onCanPlay);
            v.removeEventListener('playing', onPlaying);
        };
    }, [autoplayEnabled, onAutoplayEnd]);

    // ── Fullscreen sync ─────────────────────────────────────────────────────
    useEffect(() => {
        const onChange = () => setFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    // ── PiP sync ────────────────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onEnterPip = () => setPipActive(true);
        const onLeavePip = () => setPipActive(false);
        v.addEventListener('enterpictureinpicture', onEnterPip);
        v.addEventListener('leavepictureinpicture', onLeavePip);
        return () => {
            v.removeEventListener('enterpictureinpicture', onEnterPip);
            v.removeEventListener('leavepictureinpicture', onLeavePip);
        };
    }, []);

    // ── Smooth Progress Bar Loop (60fps DOM bypass) ─────────────────────────
    useEffect(() => {
        let frameId;
        const updateProgress = () => {
            if (videoRef.current && progressRef.current && duration > 0) {
                // Read from true underlying video current time for fluid sub-second precision
                const v = videoRef.current;
                const pct = (v.currentTime / duration) * 100;
                progressRef.current.style.setProperty('--progress', `${pct}%`);
            }
            frameId = requestAnimationFrame(updateProgress);
        };
        frameId = requestAnimationFrame(updateProgress);
        return () => cancelAnimationFrame(frameId);
    }, [duration]);

    // ── Persist Settings Hook ──────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem('utube_volume', volume);
        localStorage.setItem('utube_muted', muted);
        localStorage.setItem('utube_playbackRate', playbackRate);
    }, [volume, muted, playbackRate]);

    // ── Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            const v = videoRef.current;
            if (!v) return;

            revealControls();

            const triggerSkipIndicator = (type) => {
                setSkipIndicator({ type, key: Date.now() });
                setTimeout(() => setSkipIndicator(null), 800);
            };

            switch (e.key) {
                case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
                case 'ArrowRight': case 'l':
                    v.currentTime = Math.min(v.duration, v.currentTime + 10);
                    triggerSkipIndicator('forward');
                    break;
                case 'ArrowLeft': case 'j':
                    v.currentTime = Math.max(0, v.currentTime - 10);
                    triggerSkipIndicator('backward');
                    break;
                case 'ArrowUp': v.volume = Math.min(1, v.volume + 0.1); break;
                case 'ArrowDown': v.volume = Math.max(0, v.volume - 0.1); break;
                case 'm': v.muted = !v.muted; break;
                case 'f': toggleFullscreen(); break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [revealControls]);

    // ── Control actions ─────────────────────────────────────────────────────
    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (ended) { v.currentTime = 0; }
        v.paused ? v.play() : v.pause();
    };

    const toggleFullscreen = async () => {
        if (!document.fullscreenElement) {
            await containerRef.current?.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    };

    const togglePip = async () => {
        const v = videoRef.current;
        if (!v) return;
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
            await v.requestPictureInPicture();
        }
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
    };

    const setSpeed = (rate) => {
        const v = videoRef.current;
        if (!v) return;
        v.playbackRate = rate;
        setPlaybackRate(rate);
        setSettingsMenuState('closed');
    };

    const changeQuality = (q) => {
        setQuality(q);
        setSettingsMenuState('closed');

        // Resolve the new source URL
        let newSrc = src; // Default: original src prop
        if (q !== 'Auto' && availableResolutions && availableResolutions[q]) {
            // Build full URL from the resolution path
            const mediaBase = import.meta.env.VITE_MEDIA_BASE_URL || '';
            const resPath = availableResolutions[q];
            newSrc = resPath.startsWith('http') ? resPath : `${mediaBase}${resPath}`;
        }

        const v = videoRef.current;
        if (!v) return;

        // If src is already the same, no need to reload
        const currentSrc = v.currentSrc || v.src || '';
        if (currentSrc.endsWith(newSrc) || currentSrc === newSrc) return;

        // Save state before switching
        const savedTime = v.currentTime;
        const savedRate = v.playbackRate;
        const wasPlaying = !v.paused;

        // Switch source and restore state
        v.src = newSrc;
        v.load();

        const onReady = () => {
            v.currentTime = savedTime;
            v.playbackRate = savedRate;
            if (wasPlaying) v.play().catch(() => { });
            v.removeEventListener('loadedmetadata', onReady);
        };
        v.addEventListener('loadedmetadata', onReady);
    };

    // ── Progress bar interaction ─────────────────────────────────────────────
    const getSeekTime = (e) => {
        const rect = progressRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        return (x / rect.width) * duration;
    };

    const onProgressClick = (e) => {
        const t = getSeekTime(e);
        videoRef.current.currentTime = t;
        setCurrentTime(t);
    };

    const onProgressMouseMove = (e) => {
        const rect = progressRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        setHoverX(x);
        setHoverTime((x / rect.width) * duration);
    };

    const onProgressMouseDown = (e) => {
        setSeeking(true);
        const wasPlaying = !videoRef.current.paused;
        if (wasPlaying) videoRef.current.pause();

        const onMove = (ev) => {
            const t = getSeekTime(ev);
            videoRef.current.currentTime = t;
            setCurrentTime(t);
        };
        const onUp = () => {
            setSeeking(false);
            if (wasPlaying) videoRef.current.play();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        onMove(e);
    };

    const onVolumeChange = (e) => {
        const v = videoRef.current;
        const val = parseFloat(e.target.value);
        v.volume = val;
        v.muted = val === 0;
    };

    const VolumeIcon = muted || volume === 0 ? VolumeMutedIcon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;

    const progress = duration ? (currentTime / duration) * 100 : 0;
    const bufferedPct = duration ? (buffered / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 select-none group transition-[cursor] duration-300 ${isIdle ? 'cursor-none' : ''}`}
            onMouseMove={handleActivity}
            onDoubleClick={toggleFullscreen}
        >
            {/* ── Top Info Bar (title only, visible only in fullscreen) ── */}
            <div
                className={`absolute top-0 left-0 w-full z-50 bg-gradient-to-b from-black/80 to-transparent px-8 py-6 transition-opacity duration-300 ease-in-out ${showOverlays && fullscreen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                {title != null && title !== '' && (
                    <h2 className="text-white font-semibold text-2xl truncate drop-shadow-md">{title}</h2>
                )}
            </div>

            {/* ── Video Element ── */}
            <video
                ref={videoRef}
                key={src}
                src={src}
                poster={poster}
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
                onClick={togglePlay}
                onError={onError}
                playsInline
                autoPlay
            />

            {/* ── Buffering Spinner ── */}
            <AnimatePresence>
                {buffering && playing && (
                    <motion.div
                        key="buffering"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                    >
                        <div className="w-16 h-16">
                            <svg className="animate-spin w-full h-full text-white/70" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Centre Play/Replay Overlay ── */}
            <AnimatePresence>
                {(!playing || ended) && !buffering && (
                    <motion.div
                        key={ended ? 'centreReplay' : 'centrePlay'}
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-24 h-24 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                            <div className="w-10 h-10 text-white translate-x-0.5">
                                {ended ? <ReplayIcon /> : <PlayIcon />}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Skip Indicator Overlay ── */}
            <AnimatePresence>
                {skipIndicator && (
                    <motion.div
                        key={skipIndicator.key}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        transition={{ duration: 0.2 }}
                        className={`absolute top-1/2 -translate-y-1/2 ${skipIndicator.type === 'forward' ? 'right-24' : 'left-24'} pointer-events-none z-50`}
                    >
                        <div className="bg-black/40 backdrop-blur-sm px-6 py-4 rounded-full text-white font-bold text-2xl tracking-widest flex items-center gap-2 shadow-2xl border border-white/10">
                            {skipIndicator.type === 'backward' && <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" /></svg>}
                            {skipIndicator.type === 'backward' ? '- 10' : '+ 10'}
                            {skipIndicator.type === 'forward' && <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" /></svg>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bottom gradient fade ── */}
            <div
                className={`absolute inset-x-0 bottom-0 h-40 pointer-events-none transition-opacity duration-300 ease-in-out ${showOverlays ? 'opacity-100' : 'opacity-0'}`}
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                }}
            />

            {/* ── Glass Controls ── */}
            <div
                className={`absolute inset-x-0 bottom-0 px-4 pb-4 pt-4 flex flex-col gap-3 transition-opacity duration-300 ease-in-out ${showOverlays ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Progress Track ── */}
                <div className="flex items-center w-full">
                    <div
                        ref={progressRef}
                        className="relative flex-1 h-1 group/bar cursor-pointer"
                        style={{ paddingBlock: '6px', marginBlock: '-6px' }}
                        onClick={onProgressClick}
                        onMouseMove={onProgressMouseMove}
                        onMouseLeave={() => setHoverTime(null)}
                        onMouseDown={onProgressMouseDown}
                    >
                        {/* Track base */}
                        <div className="absolute inset-0 top-[calc(50%-2px)] h-1 rounded-full bg-white/15 overflow-hidden" style={{ top: '50%', transform: 'translateY(-50%)', height: '5px' }}>
                            {/* Buffered */}
                            <div
                                className="absolute left-0 top-0 h-full bg-white/20 rounded-full transition-all"
                                style={{ width: `${bufferedPct}%` }}
                            />
                            {/* Played — solid red */}
                            <div
                                className="absolute left-0 top-0 h-full rounded-full bg-[#ff0000]"
                                style={{
                                    width: `var(--progress, 0%)`,
                                    boxShadow: '0 0 10px rgba(255,0,0,0.5)',
                                }}
                            />
                        </div>

                        {/* Hover time tooltip */}
                        {hoverTime !== null && (
                            <div
                                className="absolute bottom-5 -translate-x-1/2 bg-black/90 text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none"
                                style={{ left: hoverX }}
                            >
                                {fmt(hoverTime)}
                            </div>
                        )}

                        {/* Scrubber thumb — appears on hover/seeking */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#ff0000] opacity-0 group-hover/bar:opacity-100"
                            style={{
                                left: `var(--progress, 0%)`,
                                boxShadow: '0 0 6px rgba(255,0,0,0.8)',
                                opacity: seeking ? 1 : undefined,
                                transition: 'opacity 150ms ease-in-out',
                            }}
                        />
                    </div>
                </div>

                {/* ── Buttons Row ── */}
                <div className="flex items-center justify-between mt-1 px-1">
                    {/* Left: Play, Volume, Time, Chapter pills */}
                    <div className="flex items-center gap-2">
                        {/* Play/Pause/Replay Pill */}
                        <Tip label={ended ? 'Replay' : playing ? 'Pause (k)' : 'Play (k)'}>
                            <button
                                onClick={togglePlay}
                                className="w-[44px] h-[44px] flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 active:scale-95 transition-all backdrop-blur-md"
                            >
                                <div className="w-5 h-5">{ended ? <ReplayIcon /> : playing ? <PauseIcon /> : <PlayIcon />}</div>
                            </button>
                        </Tip>

                        {/* Volume Pill */}
                        <div
                            className="flex items-center gap-1 group/vol bg-white/20 hover:bg-white/30 rounded-full h-[44px] px-3 transition-all w-[44px] hover:w-[120px] overflow-hidden backdrop-blur-md cursor-pointer"
                            onMouseEnter={() => setShowVolume(true)}
                            onMouseLeave={() => setShowVolume(false)}
                            onClick={(e) => {
                                // Mute if clicking directly on the pill background/icon (not the slider)
                                if (e.target.tagName !== 'INPUT') toggleMute();
                            }}
                        >
                            <Tip label={muted || volume === 0 ? 'Unmute (m)' : 'Mute (m)'}>
                                <div className="w-[20px] h-[20px] shrink-0 text-white transition-all">
                                    <VolumeIcon />
                                </div>
                            </Tip>
                            <div
                                className="w-[66px] min-w-[66px] shrink-0 opacity-0 group-hover/vol:opacity-100 transition-opacity duration-300 flex items-center ml-1"
                                onClick={(e) => e.stopPropagation()} // Prevent mute trigger when dragging
                            >
                                <input
                                    type="range"
                                    min={0} max={1} step={0.02}
                                    value={muted ? 0 : volume}
                                    onChange={onVolumeChange}
                                    className="volume-slider w-full h-1 cursor-pointer"
                                    style={{ '--vol': `${(muted ? 0 : volume) * 100}%` }}
                                />
                            </div>
                        </div>

                        {/* Time Pill */}
                        <div className="h-[44px] px-5 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center backdrop-blur-md">
                            <span className="text-white text-[13px] font-bold tracking-tight">
                                {fmt(currentTime)} <span className="text-white/60 mx-1 font-normal">/</span> {fmt(duration)}
                            </span>
                        </div>
                    </div>

                    {/* Right: Unified Pill for Tools */}
                    <div className="h-[44px] px-5 rounded-[22px] bg-white/20 flex items-center gap-7 backdrop-blur-md">
                        {/* Autoplay Toggle */}
                        <Tip label="Autoplay is on">
                            <div
                                onClick={() => setAutoplayEnabled(!autoplayEnabled)}
                                className={`w-[40px] h-[22px] rounded-full p-[2px] cursor-pointer flex flex-shrink-0 items-center transition-colors shadow-inner ${autoplayEnabled ? 'bg-white' : 'bg-white/40'}`}
                            >
                                <div className={`w-[18px] h-[18px] rounded-full bg-[#111] flex items-center justify-center transition-transform ${autoplayEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`}>
                                    {autoplayEnabled && <div className="w-[8px] h-[8px] text-white ml-[1px]"><PlayIcon /></div>}
                                </div>
                            </div>
                        </Tip>

                        {/* Settings with HD badge */}
                        <div className="relative flex items-center justify-center flex-shrink-0">
                            <Tip label="Settings">
                                <button
                                    onClick={() => setSettingsMenuState(prev => prev === 'closed' ? 'main' : 'closed')}
                                    className={`w-5 h-5 transition-all active:scale-95 ${settingsMenuState !== 'closed' ? 'text-white rotate-45 scale-110' : 'text-white hover:opacity-80'}`}
                                >
                                    <SettingsIcon />
                                </button>
                            </Tip>

                            {/* HD Badge */}
                            {(quality === '1080p' || quality === '720p' || quality === 'Auto') && (
                                <div className="absolute -top-1.5 -right-3 bg-red-600 shadow-sm text-white text-[8px] font-black px-[3px] py-[1px] rounded-[3px] pointer-events-none tracking-tighter leading-none border border-black/20">
                                    HD
                                </div>
                            )}

                            <AnimatePresence mode="wait">
                                {settingsMenuState !== 'closed' && (
                                    <motion.div
                                        key={settingsMenuState}
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full right-0 mb-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 py-1 min-w-[200px]"
                                    >
                                        {/* ─── Main View ─── */}
                                        {settingsMenuState === 'main' && (
                                            <>
                                                <button
                                                    onClick={() => setSettingsMenuState('speed')}
                                                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 opacity-70"><path d="M10 8v8l6-4-6-4zm11.54-1.38C20.8 4.44 18.55 3 16 3H8C5.45 3 3.2 4.44 2.46 6.62L1 12l1.46 5.38C3.2 19.56 5.45 21 8 21h8c2.55 0 4.8-1.44 5.54-3.62L23 12l-1.46-5.38zM21 12l-1.26 4.63C19.22 18.38 17.73 19 16 19H8c-1.73 0-3.22-.62-3.74-2.37L3 12l1.26-4.63C4.78 5.62 6.27 5 8 5h8c1.73 0 3.22.62 3.74 2.37L21 12z" /></svg>
                                                        Playback speed
                                                    </span>
                                                    <span className="text-white/50 text-[11px]">
                                                        {playbackRate === 1 ? 'Normal' : `${playbackRate}×`}
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => setSettingsMenuState('quality')}
                                                    className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 opacity-70"><path d="M15 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9l-6-6zM5 19V5h9v5h5v9H5zm4-4h6v2H9v-2zm0-4h6v2H9v-2z" /></svg>
                                                        Quality
                                                    </span>
                                                    <span className="text-white/50 text-[11px] flex items-center gap-1">
                                                        {isTranscoding && (
                                                            <svg className="w-3 h-3 animate-spin text-yellow-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                        )}
                                                        {quality}
                                                    </span>
                                                </button>
                                            </>
                                        )}

                                        {/* ─── Speed Submenu ─── */}
                                        {settingsMenuState === 'speed' && (
                                            <>
                                                <button
                                                    onClick={() => setSettingsMenuState('main')}
                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 transition-colors border-b border-white/10"
                                                >
                                                    <span className="text-sm">←</span>
                                                    Playback speed
                                                </button>
                                                {SPEEDS.map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => setSpeed(s)}
                                                        className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${playbackRate === s
                                                            ? 'text-white bg-white/10'
                                                            : 'text-white/70 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <span>{s === 1 ? 'Normal' : `${s}×`}</span>
                                                        {playbackRate === s && <span className="text-[10px]">✓</span>}
                                                    </button>
                                                ))}
                                            </>
                                        )}

                                        {/* Quality Sub-menu */}
                                        {settingsMenuState === 'quality' && (
                                            <>
                                                <button
                                                    onClick={() => setSettingsMenuState('main')}
                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white/80 hover:text-white hover:bg-white/5 transition-colors border-b border-white/10"
                                                >
                                                    <span className="text-sm">←</span>
                                                    <span className="flex items-center gap-2">
                                                        Quality
                                                        {isTranscoding && (
                                                            <span className="inline-flex items-center gap-1 text-yellow-400 text-[10px] normal-case tracking-normal">
                                                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                                                Processing…
                                                            </span>
                                                        )}
                                                    </span>
                                                </button>
                                                {QUALITIES.map(q => (
                                                    <button
                                                        key={q}
                                                        onClick={() => changeQuality(q)}
                                                        className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${quality === q
                                                            ? 'text-white bg-white/10'
                                                            : 'text-white/70 hover:text-white hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <span>{q}</span>
                                                        {quality === q && <span className="text-[10px]">✓</span>}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Picture-in-Picture */}
                        {document.pictureInPictureEnabled && (
                            <Tip label={pipActive ? 'Exit PiP' : 'Picture-in-picture'}>
                                <button
                                    onClick={togglePip}
                                    className={`w-5 h-5 flex-shrink-0 transition-all active:scale-95 ${pipActive ? 'text-blue-400' : 'text-white hover:opacity-80'}`}
                                >
                                    <PipIcon />
                                </button>
                            </Tip>
                        )}

                        {/* Fullscreen */}
                        <Tip label={fullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}>
                            <button
                                onClick={toggleFullscreen}
                                className="w-5 h-5 text-white hover:opacity-80 active:scale-95 transition-all flex-shrink-0"
                            >
                                {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                            </button>
                        </Tip>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;
