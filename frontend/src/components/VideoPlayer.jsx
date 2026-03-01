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
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
    </svg>
);
const ExitFullscreenIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
    </svg>
);
const PipIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M19 7H9c-1.1 0-2 .9-2 2v10h2V9h10V7zm2 4h-8c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2z" />
    </svg>
);
const SettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
    </svg>
);
const SkipBackIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" />
    </svg>
);
const SkipFwdIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
        <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" />
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
const VideoPlayer = ({ src, poster, onError }) => {
    const videoRef = useRef(null);
    const containerRef = useRef(null);
    const progressRef = useRef(null);
    const hideTimer = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [ended, setEnded] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [seeking, setSeeking] = useState(false);
    const [hoverTime, setHoverTime] = useState(null);
    const [hoverX, setHoverX] = useState(0);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [quality, setQuality] = useState('Auto');
    const [pipActive, setPipActive] = useState(false);
    const [showVolume, setShowVolume] = useState(false);

    const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    const QUALITIES = ['Auto', '1080p HD', '720p', '480p', '360p'];

    // ── Auto-hide controls ──────────────────────────────────────────────────
    const scheduleHide = useCallback(() => {
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => {
            if (playing && !showSpeedMenu && !showQualityMenu) setShowControls(false);
        }, 2800);
    }, [playing, showSpeedMenu, showQualityMenu]);

    const revealControls = useCallback(() => {
        setShowControls(true);
        scheduleHide();
    }, [scheduleHide]);

    useEffect(() => { return () => clearTimeout(hideTimer.current); }, []);
    useEffect(() => { if (playing) scheduleHide(); else setShowControls(true); }, [playing, scheduleHide]);

    // ── Video event bindings ────────────────────────────────────────────────
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const onPlay = () => { setPlaying(true); setEnded(false); };
        const onPause = () => setPlaying(false);
        const onEnded = () => { setPlaying(false); setEnded(true); setShowControls(true); };
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

        v.addEventListener('play', onPlay);
        v.addEventListener('pause', onPause);
        v.addEventListener('ended', onEnded);
        v.addEventListener('timeupdate', onTimeUpdate);
        v.addEventListener('durationchange', onDurationChange);
        v.addEventListener('loadedmetadata', onLoadedMetadata);
        v.addEventListener('volumechange', onVolumeChange);
        v.addEventListener('ratechange', onRateChange);

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
        };
    }, []);

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

    // ── Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            const v = videoRef.current;
            if (!v) return;
            revealControls();
            switch (e.key) {
                case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
                case 'ArrowRight': case 'l': v.currentTime = Math.min(v.duration, v.currentTime + 5); break;
                case 'ArrowLeft': case 'j': v.currentTime = Math.max(0, v.currentTime - 5); break;
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
        setShowSpeedMenu(false);
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
            className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 select-none group"
            onMouseMove={revealControls}
            onMouseLeave={() => { if (playing) setShowControls(false); }}
            onDoubleClick={toggleFullscreen}
        >
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
            />

            {/* ── Centre Play/Pause Flash ── */}
            <AnimatePresence>
                {!playing && !ended && (
                    <motion.div
                        key="centrePlay"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.18 }}
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                        <div className="w-24 h-24 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                            <div className="w-10 h-10 text-white translate-x-0.5"><PlayIcon /></div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Bottom gradient fade ── */}
            <div
                className="absolute inset-x-0 bottom-0 h-40 pointer-events-none transition-opacity duration-300"
                style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
                    opacity: showControls ? 1 : 0,
                }}
            />

            {/* ── Glass Controls ── */}
            <motion.div
                animate={{ opacity: showControls ? 1 : 0, y: showControls ? 0 : 8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-4 flex flex-col gap-3"
                style={{
                    pointerEvents: showControls ? 'auto' : 'none',
                }}
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
                                className="absolute left-0 top-0 h-full rounded-full transition-all bg-[#ff0000]"
                                style={{
                                    width: `${progress}%`,
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
                            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-[#ff0000] opacity-0 group-hover/bar:opacity-100 transition-opacity duration-150"
                            style={{
                                left: `${progress}%`,
                                boxShadow: '0 0 6px rgba(255,0,0,0.8)',
                                opacity: seeking ? 1 : undefined,
                            }}
                        />
                    </div>
                </div>

                {/* ── Buttons Row ── */}
                <div className="flex items-center justify-between">
                    {/* Left: Play, Skip, Volume, Time */}
                    <div className="flex items-center gap-1.5">
                        {/* Play/Pause/Replay */}
                        <Tip label={ended ? 'Replay' : playing ? 'Pause (k)' : 'Play (k)'}>
                            <button
                                onClick={togglePlay}
                                className="w-10 h-10 p-2 rounded-lg text-white hover:bg-white/10 active:scale-90 transition-all"
                            >
                                {ended ? <ReplayIcon /> : playing ? <PauseIcon /> : <PlayIcon />}
                            </button>
                        </Tip>

                        {/* Skip back 10s */}
                        <Tip label="−10s (j)">
                            <button
                                onClick={() => { videoRef.current.currentTime = Math.max(0, currentTime - 10); }}
                                className="w-8 h-8 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                            >
                                <SkipBackIcon />
                            </button>
                        </Tip>

                        {/* Skip forward 10s */}
                        <Tip label="+10s (l)">
                            <button
                                onClick={() => { videoRef.current.currentTime = Math.min(duration, currentTime + 10); }}
                                className="w-8 h-8 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                            >
                                <SkipFwdIcon />
                            </button>
                        </Tip>

                        {/* Volume */}
                        <div
                            className="flex items-center gap-1.5 group/vol"
                            onMouseEnter={() => setShowVolume(true)}
                            onMouseLeave={() => setShowVolume(false)}
                        >
                            <Tip label={muted || volume === 0 ? 'Unmute (m)' : 'Mute (m)'}>
                                <button
                                    onClick={toggleMute}
                                    className="w-8 h-8 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                                >
                                    <VolumeIcon />
                                </button>
                            </Tip>
                            <AnimatePresence>
                                {showVolume && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{ width: 72, opacity: 1 }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ duration: 0.18 }}
                                        className="overflow-hidden"
                                    >
                                        <input
                                            type="range"
                                            min={0} max={1} step={0.02}
                                            value={muted ? 0 : volume}
                                            onChange={onVolumeChange}
                                            className="volume-slider w-[72px] h-1 accent-red-500 cursor-pointer"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Time */}
                        <span className="text-white/80 text-[11px] font-mono font-bold ml-1 tracking-tight">
                            {fmt(currentTime)}<span className="text-white/35 mx-0.5">/</span>{fmt(duration)}
                        </span>
                    </div>

                    {/* Right: Speed, Quality, PiP, Fullscreen */}
                    <div className="flex items-center gap-0.5">
                        {/* Playback Speed */}
                        <div className="relative">
                            <Tip label="Playback speed">
                                <button
                                    onClick={() => { setShowSpeedMenu(p => !p); setShowQualityMenu(false); }}
                                    className={`text-[11px] font-black px-2 py-1 rounded-lg transition-all ${showSpeedMenu ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                                >
                                    {playbackRate === 1 ? '1×' : `${playbackRate}×`}
                                </button>
                            </Tip>
                            <AnimatePresence>
                                {showSpeedMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full right-0 mb-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 py-2 min-w-[100px]"
                                    >
                                        <div className="px-4 py-1.5 text-[10px] font-bold text-white/50 uppercase tracking-widest">Speed</div>
                                        {SPEEDS.map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setSpeed(s)}
                                                className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors ${playbackRate === s ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                                            >
                                                {s === 1 ? 'Normal' : `${s}×`}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Quality Settings */}
                        <div className="relative">
                            <Tip label="Settings">
                                <button
                                    onClick={() => { setShowQualityMenu(p => !p); setShowSpeedMenu(false); }}
                                    className={`w-8 h-8 p-1.5 rounded-lg transition-all ${showQualityMenu ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'} active:scale-90`}
                                >
                                    <SettingsIcon />
                                </button>
                            </Tip>
                            <AnimatePresence>
                                {showQualityMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute bottom-full right-0 mb-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 py-2 min-w-[120px]"
                                    >
                                        <div className="px-4 py-1.5 text-[10px] font-bold text-white/50 uppercase tracking-widest">Quality</div>
                                        {QUALITIES.map(q => (
                                            <button
                                                key={q}
                                                onClick={() => { setQuality(q); setShowQualityMenu(false); }}
                                                className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${quality === q ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                                            >
                                                <span>{q}</span>
                                                {quality === q && <span className="text-[10px]">&bull;</span>}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Picture-in-Picture */}
                        {document.pictureInPictureEnabled && (
                            <Tip label={pipActive ? 'Exit PiP' : 'Picture-in-picture'}>
                                <button
                                    onClick={togglePip}
                                    className={`w-8 h-8 p-1.5 rounded-lg transition-all ${pipActive ? 'text-white bg-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'} active:scale-90`}
                                >
                                    <PipIcon />
                                </button>
                            </Tip>
                        )}

                        {/* Fullscreen */}
                        <Tip label={fullscreen ? 'Exit fullscreen (f)' : 'Fullscreen (f)'}>
                            <button
                                onClick={toggleFullscreen}
                                className="w-8 h-8 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
                            >
                                {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                            </button>
                        </Tip>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default VideoPlayer;
