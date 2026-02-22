import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { toast } from 'react-hot-toast';
import flvjs from 'flv.js';

const LiveStudio = () => {
    const [streamTitle, setStreamTitle] = useState('');
    const [streamCategory, setStreamCategory] = useState('Gaming');
    const [showKey, setShowKey] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const [streamKey, setStreamKey] = useState('');
    const [isLoadingKey, setIsLoadingKey] = useState(true);
    const [isLive, setIsLive] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [countdown, setCountdown] = useState(null);
    const [currentUser, setCurrentUser] = useState(null);
    const [uptime, setUptime] = useState(0);

    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);

    // Hardcoded for UI demo
    const rtmpUrl = "rtmp://127.0.0.1:1935/live";

    const initPlayer = () => {
        if (isConnecting) return; // Spam koruması: Zaten bağlanıyorsa tekrar basmayı engelle
        setIsConnecting(true);

        if (flvPlayerRef.current) {
            flvPlayerRef.current.destroy();
        }

        // Sabit ve kesin adresimiz:
        const url = `http://127.0.0.1:8080/live/user2.flv`;
        console.log("BAĞLANTI DENENİYOR: ", url);

        const player = flvjs.createPlayer({
            type: 'flv',
            url: url,
            isLive: true,
            cors: true
        });

        player.attachMediaElement(videoRef.current);
        player.load();

        player.play().then(() => {
            console.log("YAYIN BAŞARIYLA GELDİ!");
            setIsLive(true);
            setIsConnecting(false);
            setCountdown(10);
        }).catch(err => {
            console.error("OYNATICI HATASI:", err);
            setIsConnecting(false);
            alert("OBS yayını bulunamadı! Lütfen önce OBS'te yayını başlatın.");
        });

        player.on(flvjs.Events.ERROR, (errType, errDetail) => {
            console.error("FLV HATASI:", errType, errDetail);
            if (flvPlayerRef.current) {
                try {
                    flvPlayerRef.current.unload();
                    flvPlayerRef.current.detachMediaElement();
                    flvPlayerRef.current.destroy();
                } catch (e) { }
                flvPlayerRef.current = null;
            }
            setIsLive(false);
            setIsConnecting(false);
            setCountdown(null);
        });

        flvPlayerRef.current = player;
    };

    // Stream Heartbeat Killer (Sensor for dead RTMP connection)
    useEffect(() => {
        let heartbeatInterval;
        let lastTime = -1;

        if (isLive) {
            heartbeatInterval = setInterval(() => {
                if (!videoRef.current) return;

                const currentTime = videoRef.current.currentTime;

                // If the video time hasn't changed in the last 2 seconds after starting, it's dead
                if (currentTime === lastTime) {
                    console.warn("📹 Stream Heartbeat Dead: currentTime stalled at", currentTime);
                    if (flvPlayerRef.current) {
                        try {
                            flvPlayerRef.current.unload();
                            flvPlayerRef.current.detachMediaElement();
                            flvPlayerRef.current.destroy();
                        } catch (e) { }
                        flvPlayerRef.current = null;
                    }
                    setIsLive(false);
                    setIsConnecting(false);
                    setCountdown(null);
                    toast.error("Yayın bağlantısı koptu (OBS durduruldu).");
                }

                lastTime = currentTime;
            }, 2000);
        }

        return () => clearInterval(heartbeatInterval);
    }, [isLive]);

    useEffect(() => {
        if (countdown === null) return;
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else {
            setCountdown(null);
        }
    }, [countdown]);

    // Uptime Timer Effect
    useEffect(() => {
        let uptimeInterval;
        if (isLive) {
            uptimeInterval = setInterval(() => {
                setUptime(prev => prev + 1);
            }, 1000);
        } else {
            setUptime(0);
        }
        return () => clearInterval(uptimeInterval);
    }, [isLive]);

    const formatUptime = (seconds) => {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const keyResponse = await ApiClient.get('/auth/stream-key');
                setStreamKey(keyResponse.data.stream_key);

                const userResponse = await ApiClient.get('/auth/me');
                setCurrentUser(userResponse.data);
                if (userResponse.data.stream_title) {
                    setStreamTitle(userResponse.data.stream_title);
                }
                if (userResponse.data.stream_category) {
                    setStreamCategory(userResponse.data.stream_category);
                }
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
                toast.error("Yayın bilgileri alınamadı, lütfen sayfayı yenileyin.");
            } finally {
                setIsLoadingKey(false);
            }
        };
        fetchInitialData();

        // Crucial Memory Cleanup Step (Senior Requirement 2)
        return () => {
            if (flvPlayerRef.current) {
                try {
                    flvPlayerRef.current.pause();
                    flvPlayerRef.current.unload();
                    flvPlayerRef.current.detachMediaElement();
                    flvPlayerRef.current.destroy();
                } catch (err) {
                    console.error("Error on unmount", err);
                }
                flvPlayerRef.current = null;
            }
        };
    }, []);

    const handleUpdateMetadata = async () => {
        setIsSubmitting(true);
        try {
            await ApiClient.put('/auth/live-metadata', {
                title: streamTitle,
                category: streamCategory
            });

            toast.success("Metadata updated securely!", {
                icon: '📝',
                style: { background: '#1c1c1c', color: '#fff', border: '1px solid #3f3f46' }
            });
        } catch (error) {
            console.error("Failed to update live metadata:", error);
            toast.error("Failed to update metadata.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegenerateKey = async () => {
        setIsLoadingKey(true);
        try {
            const response = await ApiClient.post('/auth/stream-key/reset');
            setStreamKey(response.data.stream_key);
            setShowKey(false); // Hide it again for safety
            toast.success("Yayın anahtarı başarıyla yenilendi!", {
                icon: '🔄',
                style: { background: '#1c1c1c', color: '#fff', border: '1px solid #3f3f46' }
            });
        } catch (error) {
            console.error("Failed to regenerate stream key:", error);
            toast.error("Anahtar yenilenemedi.");
        } finally {
            setIsLoadingKey(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success("Kopyalandı!", {
            id: 'copy-toast', // Prevent spamming exact same toast
            icon: '📋',
            style: { background: '#1c1c1c', color: '#fff', border: '1px solid #3f3f46' }
        });
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 px-6 pb-6 text-white mt-10">
            <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">

                {/* Left Column: Stream Preview */}
                <div className="flex-grow flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md">
                    <h1 className="text-3xl font-bold mb-6 flex items-center gap-4 border-b border-zinc-800/50 pb-4">
                        <span className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">🔴</span>
                        Creator Control Room
                    </h1>

                    <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center border-4 border-zinc-950 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)] ring-1 ring-zinc-800">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className="w-full h-full object-contain block"
                        />

                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md z-30 w-full h-full">
                                <h2 className="text-4xl md:text-6xl font-black tracking-[0.2em] text-white animate-pulse drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] text-center">
                                    YAYIN BAŞLIYOR...<br /><span className="text-8xl text-red-500">{countdown}</span>
                                </h2>
                            </div>
                        )}

                        {/* Offline Placeholder */}
                        {!isLive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm z-40 w-full h-full">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-28 h-28 text-zinc-600 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-zinc-500 font-semibold tracking-[0.3em] uppercase mb-10 text-xs text-center px-4">Waiting for OBS Stream...</p>
                                <button
                                    onClick={initPlayer}
                                    disabled={isConnecting}
                                    className={`relative z-50 px-12 py-5 rounded-full text-lg font-black tracking-widest shadow-2xl transition-all duration-300 overflow-hidden group ${isConnecting
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                                        : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:to-red-400 hover:scale-105 hover:shadow-[0_0_40px_rgba(239,68,68,0.6)] animate-[pulse_2s_ease-in-out_infinite] border border-red-400/50'
                                        }`}
                                >
                                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                                    <span className="relative z-10">{isConnecting ? 'CONNECTING...' : 'START PREVIEW'}</span>
                                </button>
                            </div>
                        )}

                        {/* Premium Live Badge */}
                        <div className={`absolute top-6 left-6 px-4 py-2 flex items-center gap-3 rounded-md backdrop-blur-md font-sans text-xs tracking-[0.2em] shadow-xl uppercase font-bold border transition-all duration-500 z-20 ${isLive
                            ? 'bg-black/70 text-white border-red-500/30'
                            : 'bg-black/50 text-gray-500 border-gray-800'
                            }`}>
                            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-red-500' : 'bg-gray-600'}`}></span>
                            </div>
                            {isLive ? 'LIVE RECORDING' : 'OFFLINE'}
                        </div>
                    </div>

                    {/* Streamer Stats HUD */}
                    {isLive && (
                        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-500">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    <span className="text-red-500 font-bold tracking-widest uppercase text-sm">Live</span>
                                </div>
                                <div className="h-8 w-[1px] bg-zinc-800"></div>
                                <div className="flex items-center gap-2 text-zinc-300 font-mono">
                                    <span className="text-xl">⏱️</span>
                                    <span className="text-lg tracking-wider">{formatUptime(uptime)}</span>
                                </div>
                                <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block"></div>
                                <div className="hidden sm:flex items-center gap-2 text-zinc-300 font-mono">
                                    <span className="text-xl">👁️</span>
                                    <span className="text-lg tracking-wider">0 Viewer</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-green-950/30 border border-green-900/50 rounded-lg">
                                <span className="text-green-500 text-xs uppercase tracking-widest font-bold">Stream Health</span>
                                <span className="text-green-400 text-sm font-black">Excellent</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Stream Settings */}
                <div className="w-full xl:w-[450px] bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-8 shadow-xl backdrop-blur-md shrink-0">
                    <div>
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-zinc-400">⚙️</span> Stream Engine Output
                        </h2>

                        {/* Stream URL */}
                        <div className="mb-6 space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Stream URL</label>
                            <div className="flex bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-red-500/50 focus-within:border-red-500 transition-all shadow-inner">
                                <input
                                    type="text"
                                    value={rtmpUrl}
                                    readOnly
                                    className="w-full bg-transparent px-4 py-3 text-sm text-gray-300 outline-none font-mono tracking-wider"
                                />
                                <button
                                    onClick={() => copyToClipboard(rtmpUrl)}
                                    title="Copy URL"
                                    className="px-4 py-3 bg-transparent hover:bg-zinc-800 transition-colors text-gray-400 hover:text-white border-l border-gray-800 flex items-center justify-center"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Stream Key */}
                        <div className="mb-6 space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1 flex justify-between">
                                Stream Key
                                <span className="text-red-500 lowercase normal-case tracking-normal opacity-70">Keep secret</span>
                            </label>
                            <div className="flex bg-zinc-950/80 border border-zinc-800 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-red-500/50 focus-within:border-red-500 transition-all shadow-inner">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={isLoadingKey ? "Loading..." : streamKey}
                                    readOnly
                                    className={`w-full bg-transparent px-4 py-3 text-sm outline-none font-mono tracking-widest ${isLoadingKey ? 'text-gray-600 italic' : 'text-gray-300'}`}
                                />
                                <button
                                    onClick={() => setShowKey(!showKey)}
                                    disabled={isLoadingKey}
                                    title={showKey ? "Hide" : "Show"}
                                    className="px-4 py-3 bg-transparent hover:bg-zinc-800 transition-colors text-gray-400 hover:text-white border-l border-gray-800 disabled:opacity-50 flex items-center justify-center"
                                >
                                    {showKey ? (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.05 10.05 0 011.52-2.972m5.022-1.325a3 3 0 013.91 3.91M15 12a3 3 0 01-3.91 3.91m-1.248-1.248L9.5 15.5M15.5 9.5L14.252 10.748M3 3l18 18" /></svg>
                                    ) : (
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                    )}
                                </button>
                                <button
                                    onClick={() => copyToClipboard(streamKey)}
                                    disabled={isLoadingKey}
                                    title="Copy Key"
                                    className="px-4 py-3 bg-transparent hover:bg-zinc-800 transition-colors text-gray-400 hover:text-white border-l border-gray-800 disabled:opacity-50 flex items-center justify-center"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                </button>
                                <button
                                    onClick={handleRegenerateKey}
                                    disabled={isLoadingKey}
                                    title="Regenerate Key"
                                    className="px-4 py-3 bg-transparent hover:bg-red-500 hover:text-white text-red-500 transition-all border-l border-gray-800 disabled:opacity-50 flex items-center justify-center group"
                                >
                                    <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            </div>
                            <div className="text-xs text-red-400 mt-2 ml-1 font-semibold space-y-1">
                                <p>⚠️ IMPORTANT FOR OBS:</p>
                                <p className="text-gray-400">Make sure your OBS Stream Key is set exactly to your <strong className="text-white">username</strong> temporarily for testing.</p>
                            </div>
                        </div>

                        {/* Quick Share */}
                        {currentUser && (
                            <div className="mt-8 pt-6 border-t border-zinc-800">
                                <button
                                    onClick={() => copyToClipboard(window.location.origin + '/watch/' + currentUser.username)}
                                    className="w-full py-4 px-6 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all rounded-xl border border-zinc-700 hover:border-zinc-600 flex items-center justify-center gap-3 font-semibold tracking-wide shadow-md group"
                                >
                                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    Copy Stream Link
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="border-t border-zinc-800 pt-6">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-zinc-400">📝</span> Metadata
                        </h2>

                        {/* Title */}
                        <div className="mb-6 space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Title</label>
                            <input
                                type="text"
                                value={streamTitle}
                                onChange={(e) => setStreamTitle(e.target.value)}
                                placeholder="E.g., Let's build a React App!"
                                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all outline-none text-sm text-gray-200 placeholder-zinc-600 shadow-inner"
                            />
                        </div>

                        {/* Category */}
                        <div className="mb-8 space-y-2">
                            <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Category</label>
                            <select
                                value={streamCategory}
                                onChange={(e) => setStreamCategory(e.target.value)}
                                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-all outline-none text-sm text-gray-200 appearance-none cursor-pointer shadow-inner"
                            >
                                <option className="bg-zinc-900" value="Gaming">Gaming</option>
                                <option className="bg-zinc-900" value="Education">Education</option>
                                <option className="bg-zinc-900" value="Technology">Technology</option>
                                <option className="bg-zinc-900" value="Just Chatting">Just Chatting</option>
                            </select>
                        </div>

                        <button
                            onClick={handleUpdateMetadata}
                            disabled={isSubmitting}
                            className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-3 ${isSubmitting
                                ? 'bg-zinc-800 text-gray-500 cursor-not-allowed border border-zinc-700'
                                : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:to-red-400 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:-translate-y-0.5'
                                }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    Saving...
                                </>
                            ) : (
                                "Update Metadata"
                            )}
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LiveStudio;
