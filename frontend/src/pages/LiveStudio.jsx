import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { FLV_BASE_URL, RTMP_URL } from '../utils/urlHelper';
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

    const [activeRightTab, setActiveRightTab] = useState('settings');
    const [chatInput, setChatInput] = useState('');
    const [bitrateData, setBitrateData] = useState(Array(20).fill(4500));

    const [activities] = useState([
        { id: 1, type: 'like', text: 'user1 liked the stream', time: 'Just now' },
        { id: 2, type: 'sub', text: 'New Subscriber! GamerX', time: '2m ago' },
        { id: 3, type: 'share', text: 'ninja shared the stream', time: '5m ago' }
    ]);

    const [chatMessages, setChatMessages] = useState([
        { id: 1, user: 'StreamBot', text: 'Welcome to the stream chat!', isMod: true },
        { id: 2, user: 'cool_dev', text: 'React is so fun to build with.', isMod: false }
    ]);

    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);
    const chatEndRef = useRef(null);

    // Hardcoded for UI demo
    const rtmpUrl = RTMP_URL;

    const initPlayer = () => {
        if (isConnecting) return; // Spam koruması: Zaten bağlanıyorsa tekrar basmayı engelle
        setIsConnecting(true);

        if (flvPlayerRef.current) {
            flvPlayerRef.current.destroy();
        }

        // Sabit ve kesin adresimiz:
        const url = `${FLV_BASE_URL}/user2.flv`;
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
        let lastTime = videoRef.current?.currentTime !== undefined ? videoRef.current.currentTime : -1;

        if (isLive && !countdown) {
            heartbeatInterval = setInterval(() => {
                if (document.hidden) return; // SKIP check if tab is backgrounded
                if (!videoRef.current) return;

                const currentTime = videoRef.current.currentTime;

                // Difference is less than 0.1 seconds over a 3-second window to account for micro-stuttering
                if (lastTime !== -1 && Math.abs(currentTime - lastTime) < 0.1) {
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
            }, 3000);
        }

        return () => clearInterval(heartbeatInterval);
    }, [isLive, countdown]);

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

    // Auto-scroll chat to bottom
    useEffect(() => {
        if (activeRightTab === 'chat' && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [chatMessages, activeRightTab]);

    // Bitrate Simulation Effect for Stream Health
    useEffect(() => {
        let bitrateInterval;
        if (isLive) {
            bitrateInterval = setInterval(() => {
                setBitrateData(prev => {
                    const newBitrate = Math.floor(Math.random() * (6000 - 3500 + 1) + 3500);
                    return [...prev.slice(1), newBitrate];
                });
            }, 1000);
        } else {
            setBitrateData(Array(20).fill(3500));
        }
        return () => clearInterval(bitrateInterval);
    }, [isLive]);

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

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        setChatMessages(prev => [...prev, { id: Date.now(), user: currentUser?.username || 'You', text: chatInput, isMod: true }]);
        setChatInput('');
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 px-4 sm:px-6 pb-6 text-white mt-10">
            {/* Header Area */}
            <div className="max-w-[1920px] mx-auto mb-6 flex items-center justify-between pb-4 border-b border-zinc-800">
                <h1 className="text-3xl font-bold flex items-center gap-4">
                    <span className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">🔴</span>
                    Creator Control Room
                    {isLive && (
                        <span className="ml-4 px-3 py-1 bg-red-500/10 border border-red-500/50 text-red-500 text-sm font-black tracking-widest uppercase rounded-full animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                            ON AIR
                        </span>
                    )}
                </h1>
            </div>

            <div className="max-w-[1920px] mx-auto flex flex-col xl:flex-row gap-6 h-full items-stretch">

                {/* Left Column 25%: Stream Activity Filter/Feed */}
                <div className="hidden xl:flex w-[25%] flex-col bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 shadow-2xl h-[calc(100vh-180px)] overflow-hidden">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 shrink-0">
                        <span className="text-zinc-400">⚡</span> Stream Activity
                    </h2>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                        {activities.map(activity => (
                            <div key={activity.id} className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/50 flex items-start gap-4 hover:border-zinc-700 transition-colors">
                                <div className={`p-2 rounded-lg ${activity.type === 'like' ? 'bg-pink-500/20 text-pink-500' : activity.type === 'sub' ? 'bg-purple-500/20 text-purple-500' : 'bg-blue-500/20 text-blue-500'}`}>
                                    {activity.type === 'like' && <span className="text-lg">❤️</span>}
                                    {activity.type === 'sub' && <span className="text-lg">⭐</span>}
                                    {activity.type === 'share' && <span className="text-lg">↗️</span>}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{activity.text}</p>
                                    <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider">{activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Center Column 50% */}
                <div className="w-full xl:w-[50%] flex flex-col gap-6">

                    {/* Video Container */}
                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative flex flex-col items-center justify-center border border-zinc-700/50 shadow-2xl backdrop-blur-xl ring-1 ring-zinc-800 shrink-0">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className="w-full h-full object-contain block"
                        />

                        {countdown !== null && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-30 w-full h-full">
                                <h2 className="text-4xl md:text-6xl font-black tracking-[0.2em] text-white animate-pulse drop-shadow-[0_0_20px_rgba(239,68,68,0.8)] text-center">
                                    STARTING...<br /><span className="text-8xl text-red-500">{countdown}</span>
                                </h2>
                            </div>
                        )}

                        {!isLive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm z-40 w-full h-full">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-zinc-600 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase mb-10 text-xs text-center px-4">Waiting for OBS Stream...</p>
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

                        <div className={`absolute top-6 left-6 px-4 py-2 flex items-center gap-3 rounded-lg backdrop-blur-md font-sans text-xs tracking-[0.2em] shadow-2xl uppercase font-bold border transition-all duration-500 z-20 ${isLive
                            ? 'bg-black/70 text-white border-red-500/50'
                            : 'bg-black/50 text-gray-500 border-gray-800'
                            }`}>
                            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-red-500' : 'bg-gray-600'}`}></span>
                            </div>
                            {isLive ? 'LIVE RECORDING' : 'OFFLINE'}
                        </div>
                    </div>

                    {/* Streamer Stats HUD & Network Graph */}
                    {isLive && (
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                    </span>
                                    <span className="text-red-500 font-bold tracking-widest uppercase text-sm">Live</span>
                                </div>
                                <div className="h-8 w-[1px] bg-zinc-800"></div>
                                <div className="flex items-center gap-3 text-zinc-300">
                                    <span className="text-xl">⏱️</span>
                                    <span className="text-lg tracking-wider font-mono">{formatUptime(uptime)}</span>
                                </div>
                                <div className="h-8 w-[1px] bg-zinc-800 hidden sm:block"></div>
                                <div className="hidden sm:flex items-center gap-3 text-zinc-300">
                                    <span className="text-xl">👁️</span>
                                    <span className="text-lg tracking-wider font-mono">1 viewer</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1 p-3 bg-zinc-950/60 border border-zinc-800 rounded-xl min-w-[200px]">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-green-500 uppercase tracking-widest font-bold">Health Excellent</span>
                                    <span className="text-green-400 font-mono font-bold animate-pulse">{bitrateData[bitrateData.length - 1]} kbps</span>
                                </div>
                                <div className="h-6 w-full mt-1">
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full opacity-80 overflow-visible">
                                        <polyline
                                            fill="none"
                                            stroke="#22c55e"
                                            strokeWidth="3"
                                            strokeLinejoin="round"
                                            points={bitrateData.map((val, idx) => {
                                                const x = (idx / (bitrateData.length - 1)) * 100;
                                                const y = 100 - ((val - 3000) / 4000) * 100;
                                                return `${x},${y}`;
                                            }).join(' ')}
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="grid grid-cols-3 gap-4 shrink-0">
                        <button className="flex flex-col items-center justify-center p-5 bg-zinc-900/40 hover:bg-zinc-800/80 backdrop-blur-xl border border-zinc-800/80 hover:border-zinc-600 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl group">
                            <span className="text-3xl mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-transform">📊</span>
                            <span className="text-sm font-bold tracking-widest uppercase text-zinc-400 group-hover:text-white transition-colors">Run Poll</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-5 bg-zinc-900/40 hover:bg-zinc-800/80 backdrop-blur-xl border border-zinc-800/80 hover:border-zinc-600 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl group">
                            <span className="text-3xl mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-transform">🐢</span>
                            <span className="text-sm font-bold tracking-widest uppercase text-zinc-400 group-hover:text-white transition-colors">Slow Mode</span>
                        </button>
                        <button className="flex flex-col items-center justify-center p-5 bg-zinc-900/40 hover:bg-zinc-800/80 backdrop-blur-xl border border-zinc-800/80 hover:border-zinc-600 rounded-2xl transition-all hover:scale-[1.02] hover:shadow-xl group">
                            <span className="text-3xl mb-3 group-hover:scale-110 group-hover:-translate-y-1 transition-transform">🎬</span>
                            <span className="text-sm font-bold tracking-widest uppercase text-zinc-400 group-hover:text-white transition-colors">Create Clip</span>
                        </button>
                    </div>

                </div>

                {/* Right Column 25%: Settings and Chat */}
                <div className="w-full xl:w-[25%] flex flex-col bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl h-[calc(100vh-180px)] overflow-hidden shrink-0">

                    {/* Tabs */}
                    <div className="flex border-b border-zinc-800 shrink-0">
                        <button
                            onClick={() => setActiveRightTab('settings')}
                            className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-colors ${activeRightTab === 'settings' ? 'bg-zinc-800/50 text-white border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'}`}
                        >
                            Control
                        </button>
                        <button
                            onClick={() => setActiveRightTab('chat')}
                            className={`flex-1 py-4 text-xs font-bold tracking-widest uppercase transition-colors ${activeRightTab === 'chat' ? 'bg-zinc-800/50 text-white border-b-2 border-red-500' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20'}`}
                        >
                            Live Chat
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        {/* Settings Tab */}
                        {activeRightTab === 'settings' && (
                            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent space-y-6">
                                <div>
                                    <h2 className="text-xs font-bold mb-3 flex items-center gap-2 text-zinc-400 uppercase tracking-widest">
                                        <span className="text-zinc-500">⚙️</span> Connection Stream
                                    </h2>

                                    {/* Stream URL */}
                                    <div className="mb-4 space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Stream URL</label>
                                        <div className="flex bg-zinc-950/80 border border-zinc-800 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-red-500/50 focus-within:border-red-500 transition-all shadow-inner">
                                            <input type="text" value={rtmpUrl} readOnly className="w-full bg-transparent px-3 py-2 text-xs text-gray-300 outline-none font-mono tracking-wider" />
                                            <button onClick={() => copyToClipboard(rtmpUrl)} title="Copy URL" className="px-3 bg-zinc-900 border-l border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-400 flex items-center justify-center">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Stream Key */}
                                    <div className="space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1 flex justify-between">Stream Key</label>
                                        <div className="flex bg-zinc-950/80 border border-zinc-800 rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-red-500/50 focus-within:border-red-500 transition-all shadow-inner">
                                            <input type={showKey ? "text" : "password"} value={isLoadingKey ? "Loading..." : streamKey} readOnly className={`w-full bg-transparent px-3 py-2 text-xs outline-none font-mono tracking-widest ${isLoadingKey ? 'text-zinc-600' : 'text-zinc-300'}`} />
                                            <button onClick={() => setShowKey(!showKey)} disabled={isLoadingKey} className="px-2 bg-zinc-900 border-l border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-400 flex items-center justify-center">
                                                {showKey ? 'Hide' : 'Show'}
                                            </button>
                                            <button onClick={() => copyToClipboard(streamKey)} disabled={isLoadingKey} className="px-3 bg-zinc-900 border-l border-zinc-800 hover:bg-zinc-800 transition-colors text-zinc-400 flex items-center justify-center">
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-zinc-800 pt-5">
                                    <h2 className="text-xs font-bold mb-3 flex items-center gap-2 text-zinc-400 uppercase tracking-widest">
                                        <span className="text-zinc-500">📝</span> Metadata
                                    </h2>

                                    <div className="mb-4 space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Title</label>
                                        <input type="text" value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-red-500/50 shadow-inner" />
                                    </div>

                                    <div className="mb-5 space-y-1">
                                        <label className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold ml-1">Category</label>
                                        <select value={streamCategory} onChange={(e) => setStreamCategory(e.target.value)} className="w-full bg-zinc-950/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-red-500/50 shadow-inner appearance-none">
                                            <option value="Gaming">Gaming</option>
                                            <option value="Education">Education</option>
                                            <option value="Technology">Technology</option>
                                            <option value="Just Chatting">Just Chatting</option>
                                        </select>
                                    </div>

                                    <button onClick={handleUpdateMetadata} disabled={isSubmitting} className={`w-full py-3 rounded-lg text-xs font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'bg-zinc-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:to-red-400 shadow-lg'}`}>
                                        {isSubmitting ? 'Saving...' : 'Update'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Chat Tab */}
                        {activeRightTab === 'chat' && (
                            <div className="flex flex-col h-full bg-zinc-950/50">
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                                    {chatMessages.map(msg => (
                                        <div key={msg.id} className="text-sm leading-relaxed">
                                            <span className="font-bold inline-flex items-center gap-1.5 align-middle mr-2">
                                                {msg.isMod && <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/50 px-1 py-0.5 rounded uppercase tracking-wider">Mod</span>}
                                                <span className={msg.isMod ? 'text-green-400/90' : 'text-blue-400/90'}>{msg.user}</span>
                                                <span className="text-zinc-600">:</span>
                                            </span>
                                            <span className="text-zinc-300 align-middle">
                                                {msg.text}
                                            </span>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>
                                <div className="p-3 bg-zinc-900/80 border-t border-zinc-800 shrink-0">
                                    <form onSubmit={handleSendChat} className="flex gap-2">
                                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Send a message..." className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all" />
                                        <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold tracking-widest uppercase transition-colors">Send</button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LiveStudio;
