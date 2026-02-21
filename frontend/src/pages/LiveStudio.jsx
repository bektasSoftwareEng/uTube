import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { toast } from 'react-hot-toast';
import flvjs from 'flv.js';

const LiveStudio = () => {
    const [streamTitle, setStreamTitle] = useState('');
    const [streamCategory, setStreamCategory] = useState('Gaming');
    const [showKey, setShowKey] = useState(false);

    const [streamKey, setStreamKey] = useState('');
    const [isLoadingKey, setIsLoadingKey] = useState(true);
    const [isLive, setIsLive] = useState(false);

    const videoRef = useRef(null);
    let flvPlayer = null;

    // Hardcoded for UI demo
    const rtmpUrl = "rtmp://localhost:1935/live";

    useEffect(() => {
        const fetchStreamKey = async () => {
            try {
                const response = await ApiClient.get('/auth/stream-key');
                setStreamKey(response.data.stream_key);
            } catch (error) {
                console.error("Failed to fetch stream key:", error);
                toast.error("Yayın anahtarı alınamadı, lütfen sayfayı yenileyin.");
            } finally {
                setIsLoadingKey(false);
            }
        };
        fetchStreamKey();

        // Initialize FLV.js exactly as the Senior Architect required:
        // Explicity utilizing the user's username for the stream URL to shield the Stream Key.
        const user = JSON.parse(localStorage.getItem('user'));
        if (flvjs.isSupported() && user && user.username) {
            const videoElement = videoRef.current;
            flvPlayer = flvjs.createPlayer({
                type: 'flv',
                url: `http://localhost:8080/live/${user.username}.flv`
            });
            flvPlayer.attachMediaElement(videoElement);
            flvPlayer.load();
            flvPlayer.play().catch(e => console.log('Auto-play prevented or stream offline.'));

            flvPlayer.on(flvjs.Events.METADATA_ARRIVED, () => {
                setIsLive(true);
                toast.success("Stream connected securely!", { icon: '🟢', style: { background: '#1c1c1c', color: '#fff', border: '1px solid #3f3f46' } });
            });

            flvPlayer.on(flvjs.Events.ERROR, (errType, errDetail) => {
                if (isLive) {
                    setIsLive(false);
                    toast.error("Stream offline.");
                }
            });
        }

        // Crucial Memory Cleanup Step (Senior Requirement 2)
        return () => {
            if (flvPlayer) {
                flvPlayer.pause();
                flvPlayer.unload();
                flvPlayer.detachMediaElement();
                flvPlayer.destroy();
                flvPlayer = null;
            }
        };
    }, []);

    const handleUpdateMetadata = async () => {
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
        <div className="min-h-screen bg-[#0f0f0f] pt-24 px-6 pb-6 text-white mt-10">
            <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-6">

                {/* Left Column: Stream Preview */}
                <div className="flex-grow flex flex-col bg-black/40 border border-gray-800 rounded-2xl p-6 shadow-2xl backdrop-blur-sm">
                    <h1 className="text-3xl font-bold mb-6 flex items-center gap-4 border-b border-gray-800/50 pb-4">
                        <span className="text-red-500">🔴</span>
                        Creator Control Room
                    </h1>

                    <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center border border-gray-800/80 shadow-inner">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            className={`w-full h-full object-contain ${!isLive ? 'hidden' : 'block'}`}
                        />

                        {/* Offline Placeholder */}
                        {!isLive && (
                            <div className="text-gray-500 flex flex-col items-center gap-4 text-center p-8 bg-[url('/static/noise.png')] bg-repeat opacity-80 mix-blend-overlay w-full h-full justify-center">
                                <span className="text-6xl animate-pulse">📡</span>
                                <p className="font-bold text-xl uppercase tracking-widest text-gray-400">Waiting for OBS Stream...</p>
                                <p className="text-sm">Please connect your streaming software.</p>
                            </div>
                        )}

                        <div className={`absolute top-4 left-4 px-3 py-1 rounded backdrop-blur font-mono text-sm tracking-widest uppercase font-black border ${isLive ? 'bg-red-600/90 text-white border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-red-600/20 text-red-500 border-red-500/20'}`}>
                            {isLive ? 'Live' : 'Offline'}
                        </div>
                    </div>
                </div>

                {/* Right Column: Stream Settings */}
                <div className="w-full xl:w-[450px] bg-black/40 border border-gray-800 rounded-2xl p-6 flex flex-col gap-8 shadow-xl backdrop-blur-sm shrink-0">
                    <div>
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-gray-400">⚙️</span> Stream Engine Output
                        </h2>

                        {/* Stream URL */}
                        <div className="mb-6 space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">Stream URL</label>
                            <div className="flex bg-white/5 border border-gray-700 rounded-xl overflow-hidden focus-within:border-red-500 transition-colors">
                                <input
                                    type="text"
                                    value={rtmpUrl}
                                    readOnly
                                    className="w-full bg-transparent px-4 py-3 text-sm text-gray-300 outline-none font-mono"
                                />
                                <button
                                    onClick={() => copyToClipboard(rtmpUrl)}
                                    className="px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors text-white font-bold text-sm border-l border-gray-700"
                                >
                                    Copy
                                </button>
                            </div>
                        </div>

                        {/* Stream Key */}
                        <div className="mb-6 space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1 flex justify-between">
                                Stream Key
                                <span className="text-red-500 lowercase normal-case tracking-normal">Keep this secret!</span>
                            </label>
                            <div className="flex bg-white/5 border border-gray-700 rounded-xl overflow-hidden focus-within:border-red-500 transition-colors">
                                <input
                                    type={showKey ? "text" : "password"}
                                    value={isLoadingKey ? "Loading..." : streamKey}
                                    readOnly
                                    className={`w-full bg-transparent px-4 py-3 text-sm outline-none font-mono tracking-wider ${isLoadingKey ? 'text-gray-500 italic' : 'text-gray-300'}`}
                                />
                                <button
                                    onClick={() => setShowKey(!showKey)}
                                    disabled={isLoadingKey}
                                    className="px-4 py-3 bg-transparent hover:bg-white/10 transition-colors text-gray-400 text-sm border-l border-gray-700 disabled:opacity-50"
                                >
                                    {showKey ? 'Hide' : 'Show'}
                                </button>
                                <button
                                    onClick={() => copyToClipboard(streamKey)}
                                    disabled={isLoadingKey}
                                    className="px-4 py-3 bg-white/10 hover:bg-white/20 transition-colors text-white font-bold text-sm border-l border-gray-700 disabled:opacity-50"
                                >
                                    Copy
                                </button>
                                <button
                                    onClick={handleRegenerateKey}
                                    disabled={isLoadingKey}
                                    title="Regenerate Key"
                                    className="px-4 py-3 bg-red-900/30 hover:bg-red-900/60 transition-colors text-red-500 font-bold text-sm border-l border-gray-700 disabled:opacity-50"
                                >
                                    {isLoadingKey ? '...' : 'Yenile'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-800 pt-6">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-gray-400">📝</span> Metadata
                        </h2>

                        {/* Title */}
                        <div className="mb-6 space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">Title</label>
                            <input
                                type="text"
                                value={streamTitle}
                                onChange={(e) => setStreamTitle(e.target.value)}
                                placeholder="E.g., Let's build a React App!"
                                className="w-full bg-white/5 border border-gray-700 rounded-xl px-4 py-3 focus:border-red-500 focus:bg-white/10 transition-colors outline-none text-sm placeholder-gray-600"
                            />
                        </div>

                        {/* Category */}
                        <div className="mb-8 space-y-2">
                            <label className="text-xs uppercase tracking-widest text-gray-400 font-bold ml-1">Category</label>
                            <select
                                value={streamCategory}
                                onChange={(e) => setStreamCategory(e.target.value)}
                                className="w-full bg-white/5 border border-gray-700 rounded-xl px-4 py-3 focus:border-red-500 focus:bg-white/10 transition-colors outline-none text-sm text-white appearance-none cursor-pointer"
                            >
                                <option className="bg-zinc-900" value="Gaming">Gaming</option>
                                <option className="bg-zinc-900" value="Education">Education</option>
                                <option className="bg-zinc-900" value="Technology">Technology</option>
                                <option className="bg-zinc-900" value="Just Chatting">Just Chatting</option>
                            </select>
                        </div>

                        <button
                            onClick={handleUpdateMetadata}
                            className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg text-sm tracking-wide shadow-red-900/20"
                        >
                            Update Metadata
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default LiveStudio;
