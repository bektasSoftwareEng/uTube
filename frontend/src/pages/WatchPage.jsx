import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { FLV_BASE_URL } from '../utils/urlHelper';
import { toast } from 'react-hot-toast';
import flvjs from 'flv.js';

const WatchPage = () => {
    const { username } = useParams();
    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);
    const chatEndRef = useRef(null);

    const [isLive, setIsLive] = useState(false);
    const [streamMetadata, setStreamMetadata] = useState(null);
    const [chatInput, setChatInput] = useState('');
    const [viewerCount, setViewerCount] = useState(0);
    const [isLiked, setIsLiked] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);

    const [chatMessages, setChatMessages] = useState([
        { id: 1, user: 'StreamBot', text: 'Welcome to the chat!', isMod: true }
    ]);

    useEffect(() => {
        // Initialize Player
        if (flvjs.isSupported()) {
            const url = `${FLV_BASE_URL}/${username}.flv`;
            const player = flvjs.createPlayer({
                type: 'flv',
                url: url,
                isLive: true,
                cors: true
            });

            player.attachMediaElement(videoRef.current);
            player.load();

            player.play().then(() => {
                setIsLive(true);
            }).catch(err => {
                console.warn("Stream not live currently:", err);
                setIsLive(false);
            });

            player.on(flvjs.Events.ERROR, (errType, errDetail) => {
                console.error("FLV Error:", errType, errDetail);
                setIsLive(false);
            });

            flvPlayerRef.current = player;
        }

        return () => {
            if (flvPlayerRef.current) {
                try {
                    flvPlayerRef.current.pause();
                    flvPlayerRef.current.unload();
                    flvPlayerRef.current.detachMediaElement();
                    flvPlayerRef.current.destroy();
                } catch (e) {
                    // Ignore destruction errors
                }
                flvPlayerRef.current = null;
            }
        };
    }, [username]);

    // Mock Viewer Count
    useEffect(() => {
        if (isLive) {
            const interval = setInterval(() => {
                setViewerCount(prev => prev + Math.floor(Math.random() * 3) - 1 + (prev === 0 ? 5 : 0));
            }, 3000);
            return () => clearInterval(interval);
        }
    }, [isLive]);

    // Auto-scroll chat
    useEffect(() => {
        if (chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatMessages]);

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        setChatMessages(prev => [...prev, { id: Date.now(), user: 'You', text: chatInput, isMod: false }]);
        setChatInput('');
    };

    const handleLike = async () => {
        try {
            await ApiClient.post(`/live/like/${username}`);
            setIsLiked(!isLiked);
            toast.success(isLiked ? "Like removed" : "Stream liked!");
        } catch (error) {
            console.error("Failed to like stream", error);
            setIsLiked(!isLiked); // Optimistic UI toggle for demo purposes if backend fails during dev
            toast.success(isLiked ? "Like removed (Fallback)" : "Stream liked! (Fallback)");
        }
    };

    const handleSubscribe = () => {
        setIsSubscribed(!isSubscribed);
        toast.success(isSubscribed ? "Unsubscribed" : "Subscribed!");
    };


    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 px-4 sm:px-6 pb-6 text-white mt-10">
            <div className="max-w-[1920px] mx-auto flex flex-col xl:flex-row gap-6 h-full items-stretch">

                {/* Center Column: Video Player & Info (75% on large screens) */}
                <div className="w-full xl:w-[75%] flex flex-col gap-6">

                    {/* Video Container */}
                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden relative flex flex-col items-center justify-center border border-zinc-700/50 shadow-2xl backdrop-blur-xl ring-1 ring-zinc-800 shrink-0">
                        <video
                            ref={videoRef}
                            autoPlay
                            controls
                            muted
                            className="w-full h-full object-contain block"
                        />

                        {!isLive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm z-40 w-full h-full">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-zinc-600 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase mb-4 text-xs text-center px-4">Stream Offline</p>
                                <p className="text-zinc-400 text-sm">{username} is currently not live.</p>
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
                            {isLive ? 'LIVE' : 'OFFLINE'}
                        </div>
                    </div>

                    {/* Stream Info & Actions */}
                    <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 shadow-xl shrink-0">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold mb-2">{username}'s Live Channel</h1>
                                <p className="text-zinc-400 text-sm flex items-center gap-4">
                                    <span className="font-semibold">{username}</span>
                                    <span className="flex items-center gap-1.5 text-zinc-300 font-mono">
                                        <span className="text-lg">👁️</span> {viewerCount} watching now
                                    </span>
                                </p>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
                                <button
                                    onClick={handleSubscribe}
                                    className={`flex-1 md:flex-none px-6 py-2.5 rounded-full font-bold text-sm transition-all ${isSubscribed ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-white text-black hover:bg-zinc-200'}`}
                                >
                                    {isSubscribed ? 'Subscribed' : 'Subscribe'}
                                </button>

                                <div className="flex items-center bg-zinc-800/50 rounded-full border border-zinc-700 overflow-hidden">
                                    <button
                                        onClick={handleLike}
                                        className={`px-4 py-2.5 hover:bg-zinc-700 transition-colors flex items-center gap-2 text-sm font-semibold border-r border-zinc-700 ${isLiked ? 'text-red-500' : 'text-zinc-300 hover:text-white'}`}
                                    >
                                        <svg className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                        Like
                                    </button>
                                    <button className="px-4 py-2.5 hover:bg-zinc-700 transition-colors text-zinc-300 hover:text-white group">
                                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Chat (25% on large screens) */}
                <div className="w-full xl:w-[25%] flex flex-col bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl h-[calc(100vh-180px)] overflow-hidden shrink-0">
                    <div className="flex border-b border-zinc-800 shrink-0 bg-white/5">
                        <div className="flex-1 px-4 py-4 text-xs font-bold tracking-widest uppercase text-white border-b-2 border-red-500">
                            Live Chat
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
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
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Send a message..."
                                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all"
                                    />
                                    <button type="submit" className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold tracking-widest uppercase transition-colors">
                                        Send
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WatchPage;
