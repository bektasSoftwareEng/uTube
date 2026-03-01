import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import { FLV_BASE_URL, WS_BASE_URL, getAvatarUrl, getValidUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';
import { UTUBE_TOKEN, UTUBE_USER } from '../utils/authConstants';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import flvjs from 'flv.js';
import axios from 'axios';

const API_BASE = 'http://' + window.location.hostname + ':8000/api/v1';

const getAuthHeaders = () => {
    const token = localStorage.getItem(UTUBE_TOKEN);
    return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};
// ═══════════════════════════════════════════════════════════════════════════════
// WatchPage — Production-Ready Live Stream Viewer
// ═══════════════════════════════════════════════════════════════════════════════
// Architecture:
//   - Metadata:   GET /auth/profile/{username} (public)
//   - Subscribe:  POST|DELETE /auth/subscribe/{user_id}
//   - FLV Player: Proxied via Vite (/live → :8080) in dev
//   - Chat:       WebSocket at /api/v1/ws/chat/{username} with JWT handshake
//   - History:    GET /api/v1/chat/history/{username}
//   - Sidebar:    GET /recommendations/recommended
// ═══════════════════════════════════════════════════════════════════════════════

const WatchPage = () => {
    const { username } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);
    const chatEndRef = useRef(null);
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectCountRef = useRef(0);
    const MAX_RECONNECT = 5;

    // ── Core State ───────────────────────────────────────────────────────
    const [isLive, setIsLive] = useState(false);
    const [stream, setStream] = useState(null);
    const [pageState, setPageState] = useState('loading'); // 'loading' | 'ready' | 'not_found' | 'error'
    const [streamMetadata, setStreamMetadata] = useState({
        userId: null,
        title: '',
        category: null,
        profileImage: null,
        subscriberCount: 0,
    });

    // ── Interaction State ────────────────────────────────────────────────
    const [isLiked, setIsLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [likeLoading, setLikeLoading] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subLoading, setSubLoading] = useState(false);

    // ── Chat State (WebSocket-powered) ──────────────────────────────────
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [wsStatus, setWsStatus] = useState('disconnected'); // 'connecting' | 'connected' | 'disconnected'

    // ── Poll State ────────────────────────────────────────────────────────
    const [activePoll, setActivePoll] = useState(null);
    const [hasVoted, setHasVoted] = useState(false);
    const [pollTimeLeft, setPollTimeLeft] = useState(0);
    const [pollPhase, setPollPhase] = useState('none'); // 'none' | 'active' | 'results'

    // ── BRB State ──────────────────────────────────────────────────────
    const [brbEnabled, setBrbEnabled] = useState(false);

    // ── Sidebar State ────────────────────────────────────────────────────
    const [recommendedVideos, setRecommendedVideos] = useState([]);

    // ── Category Icon Map ────────────────────────────────────────────────
    // ── Auth & Ownership ───────────────────────────────────────────────
    const currentUser = JSON.parse(localStorage.getItem(UTUBE_USER) || 'null');
    const isOwnChannel = currentUser?.username === username;

    const categoryIcons = {
        Gaming: '🎮', Education: '🎓', Technology: '💻', 'Just Chatting': '💬',
        Music: '🎵', Entertainment: '🎬', Sports: '🏀', News: '📰',
        Science: '🔬', Art: '🎨', Cooking: '🍳', Travel: '✈️',
    };

    // ════════════════════════════════════════════════════════════════════════
    // DATA FETCHING
    // ════════════════════════════════════════════════════════════════════════

    // ── 1. Fetch Stream Metadata ─────────────────────────────────────────
    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Link copied to clipboard!", { icon: '🔗' });
    };

    // ── 1. Fetch Stream Metadata with Polling (Heartbeat) ────────────────
    useEffect(() => {
        const fetchStream = async () => {
            try {
                const API_BASE_8000 = 'http://' + window.location.hostname + ':8000/api/v1';
                const response = await axios.get(`${API_BASE_8000}/streams/${username}`);
                const streamData = response.data;
                setStream(streamData);

                // Keep other state in sync
                const serverLive = streamData.is_live === true || streamData.stream_status === 'live';
                setIsLive(serverLive);

                setStreamMetadata({
                    userId: streamData.id,
                    title: streamData.stream_title || `${username}'s Live Stream`,
                    category: streamData.stream_category || null,
                    profileImage: streamData.profile_image || null,
                    subscriberCount: streamData.subscriber_count || 0,
                    streamKey: streamData.stream_key
                });
                setPageState('ready');
            } catch (error) {
                // GRACEFUL 404 HANDLING: If the channel doesn't exist, don't spam errors
                if (error.response?.status === 404) {
                    console.warn(`[WatchPage] Stream metadata for "${username}" not found (404).`);
                    setStream({ is_live: false });
                    setPageState('not_found');
                } else {
                    console.error("Stream fetch error:", error);
                    setStream({ is_live: false }); // Graceful fallback
                }
            }
        };

        if (username) {
            fetchStream();
            const interval = setInterval(fetchStream, 5000); // 5s Heartbeat
            return () => clearInterval(interval);
        } else {
            setPageState('error');
        }
    }, [username]);

    // ── 2. Check Subscription Status (only if logged in) ────────────────
    useEffect(() => {
        const token = localStorage.getItem(UTUBE_TOKEN);
        if (!token) return; // Skip if not logged in — prevents 401 redirect

        const checkSubscription = async () => {
            try {
                const response = await axios.get(`${API_BASE}/auth/subscriptions`, getAuthHeaders());
                const subscriptions = response.data;
                const isSubbed = subscriptions.some(user => user.username === username);
                setIsSubscribed(isSubbed);
            } catch {
                // Auth failed or error — default to not subscribed
                setIsSubscribed(false);
            }
        };

        checkSubscription();
    }, [username]);

    // ── 3. Fetch Recommended Videos (Sidebar) ───────────────────────────
    useEffect(() => {
        const fetchRecommended = async () => {
            try {
                const response = await axios.get(`${API_BASE}/recommendations/recommended`);
                setRecommendedVideos(response.data?.slice(0, 8) || []);
            } catch (error) {
                // Silently catch 404 so it never breaks the render cycle
                setRecommendedVideos([]);
            }
        };

        fetchRecommended();
    }, []);

    // ════════════════════════════════════════════════════════════════════════
    // FLV PLAYER
    // ════════════════════════════════════════════════════════════════════════

    const destroyPlayer = useCallback(() => {
        if (flvPlayerRef.current) {
            try {
                flvPlayerRef.current.pause();
                flvPlayerRef.current.unload();
                flvPlayerRef.current.detachMediaElement();
                flvPlayerRef.current.destroy();
            } catch { /* cleanup errors are safe to ignore */ }
            flvPlayerRef.current = null;
        }
    }, []);

    // ── Strict FLV Player Initialization with Live Sync ──────────────────
    useEffect(() => {
        // 1. Guard clauses: Wait for everything to be perfectly ready
        if (!stream || !stream.is_live || !stream.stream_key || !videoRef.current) {
            return;
        }

        let player = null;

        if (flvjs.isSupported()) {
            // 2. Build the exact NMS URL
            const videoUrl = `http://${window.location.hostname}:8080/live/${stream.stream_key}.flv`;
            console.log("Attempting to play FLV from:", videoUrl);

            player = flvjs.createPlayer({
                type: 'flv',
                isLive: true,
                url: videoUrl
            }, {
                enableWorker: false,
                enableStashBuffer: false
            });

            player.attachMediaElement(videoRef.current);
            player.load();
            player.play().catch(err => console.error("FLV Play Error:", err));

            // ENFORCE LIVE EDGE SYNC (Background Tab Fix)
            const handleVisibilitySync = () => {
                if (!document.hidden && videoRef.current && videoRef.current.buffered.length > 0) {
                    try {
                        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
                        // Force real-time edge
                        videoRef.current.currentTime = bufferedEnd;
                        console.log("Joined live edge after tab visibility change");
                    } catch (e) { console.warn("Live edge sync failed:", e); }
                }
            };
            document.addEventListener('visibilitychange', handleVisibilitySync);

            // 3. Cleanup on unmount or stream end
            return () => {
                document.removeEventListener('visibilitychange', handleVisibilitySync);
                if (player) {
                    player.pause();
                    player.unload();
                    player.detachMediaElement();
                    player.destroy();
                }
            };
        }
    }, [stream?.is_live, stream?.stream_key]); // Strict Dependency Array



    // ════════════════════════════════════════════════════════════════════════
    // INTERACTION HANDLERS
    // ════════════════════════════════════════════════════════════════════════

    const handleLike = async () => {
        if (likeLoading) return;
        if (!localStorage.getItem(UTUBE_TOKEN)) {
            toast.error('Please log in to like');
            return;
        }
        setLikeLoading(true);

        // Optimistic UI update
        const previousState = isLiked;
        setIsLiked(!isLiked);
        setLikeCount(prev => previousState ? Math.max(0, prev - 1) : prev + 1);

        try {
            const response = await axios.post(`${API_BASE}/auth/live/like/${username}`, {}, getAuthHeaders());
            // Sync with server truth
            setIsLiked(response.data.liked);
            setLikeCount(response.data.new_like_count);
            toast.success(response.data.liked ? 'Stream liked! ❤️' : 'Like removed');
        } catch (err) {
            // Revert optimistic update on failure
            setIsLiked(previousState);
            setLikeCount(prev => previousState ? prev + 1 : Math.max(0, prev - 1));
            if (err.response?.status === 401) {
                toast.error('Please log in to like');
            } else if (err.response?.status === 400) {
                toast.error("You can't like your own stream");
            } else {
                toast.error('Could not process like');
            }
        } finally {
            setLikeLoading(false);
        }
    };

    const handleSubscribe = async () => {
        if (subLoading || !streamMetadata.userId) return;
        if (!localStorage.getItem(UTUBE_TOKEN)) {
            toast.error('Please log in to subscribe');
            return;
        }
        setSubLoading(true);

        const previousState = isSubscribed;
        setIsSubscribed(!isSubscribed); // Optimistic

        try {
            if (previousState) {
                await axios.delete(`${API_BASE}/auth/subscribe/${streamMetadata.userId}`, getAuthHeaders());
                toast.success('Unsubscribed');
                setStreamMetadata(prev => ({
                    ...prev,
                    subscriberCount: Math.max(0, prev.subscriberCount - 1)
                }));
            } else {
                await axios.post(`${API_BASE}/auth/subscribe/${streamMetadata.userId}`, {}, getAuthHeaders());
                toast.success('Subscribed! 🔔');
                setStreamMetadata(prev => ({
                    ...prev,
                    subscriberCount: prev.subscriberCount + 1
                }));
            }
        } catch (err) {
            // Revert optimistic update on failure
            setIsSubscribed(previousState);
            if (err.response?.status === 401) {
                toast.error('Please log in to subscribe');
            } else if (err.response?.status === 400) {
                toast.error("You can't subscribe to yourself");
            } else {
                toast.error('Something went wrong');
            }
        } finally {
            setSubLoading(false);
        }
    };

    const handlePollVote = (optionIndex) => {
        if (!localStorage.getItem(UTUBE_TOKEN)) {
            toast.error('Log in to vote');
            return;
        }
        if (hasVoted || !activePoll || wsStatus !== 'connected' || !wsRef.current) return;

        wsRef.current.send(JSON.stringify({
            type: 'POLL_VOTE',
            optionIndex: optionIndex
        }));

        setHasVoted(true);
        toast.success(`Vote submitted!`);
    };

    // ── Chat: History Disabled per requirements ──────────────────────────

    // ── Chat: WebSocket Lifecycle ─────────────────────────────────────────
    useEffect(() => {
        if (pageState !== 'ready' || !username) return;

        const connectWs = () => {
            // Build WS URL with optional JWT token
            const token = localStorage.getItem(UTUBE_TOKEN);
            const tokenParam = token ? `?token=${encodeURIComponent(token)}` : '';
            const wsUrl = `${WS_BASE_URL}/api/v1/ws/chat/${username}${tokenParam}`;

            setWsStatus('connecting');
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setWsStatus('connected');
                reconnectCountRef.current = 0;
                console.log('[Chat] WebSocket connected');
            };

            ws.onmessage = (event) => {
                try {
                    const parsedMessage = JSON.parse(event.data);
                    switch (parsedMessage.type) {
                        case 'chat':
                        case 'system':
                            setChatMessages(prev => [...prev, parsedMessage]);
                            break;
                        case 'message_deleted':
                            setChatMessages(prev => prev.filter(m => m.id !== parsedMessage.msg_id));
                            break;
                        case 'POLL_START':
                            setActivePoll(parsedMessage.data);
                            setPollTimeLeft(parsedMessage.data.duration);
                            setPollPhase('active');
                            setHasVoted(false);
                            break;
                        case 'POLL_VOTE':
                            // Update vote counts
                            setActivePoll(prev => {
                                if (!prev) return prev;
                                const newOptions = [...prev.options];
                                if (parsedMessage.optionIndex !== undefined && newOptions[parsedMessage.optionIndex]) {
                                    newOptions[parsedMessage.optionIndex].votes = (newOptions[parsedMessage.optionIndex].votes || 0) + 1;
                                }
                                return { ...prev, options: newOptions };
                            });
                            break;
                        case 'POLL_END':
                            setActivePoll(null);
                            setHasVoted(false);
                            setPollPhase('none');
                            setPollTimeLeft(0);
                            break;
                        case 'status_update':
                            // Handle real-time push from backend webhooks
                            const newLiveStatus = !!parsedMessage.is_live;
                            setIsLive(newLiveStatus);
                            setStream(prev => prev ? { ...prev, is_live: newLiveStatus } : { is_live: newLiveStatus });

                            if (!newLiveStatus) {
                                // If stream went offline, clear state immediately
                                setChatMessages([]);
                                setActivePoll(null);
                                setPollPhase('none');
                                toast('Stream ended', { icon: '🛑' });
                            } else {
                                toast.success('Stream is now LIVE!', { id: 'live-notif' });
                            }
                            break;
                        case 'brb':
                            setBrbEnabled(parsedMessage.enabled);
                            break;
                        default:
                            break;
                    }
                } catch {
                    // Malformed message
                }
            };

            ws.onclose = () => {
                setWsStatus('disconnected');
                wsRef.current = null;

                if (reconnectCountRef.current < MAX_RECONNECT) {
                    reconnectCountRef.current += 1;
                    const delay = 3000 + Math.random() * 2000;
                    console.log(`[Chat] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectCountRef.current}/${MAX_RECONNECT})`);
                    reconnectTimerRef.current = setTimeout(connectWs, delay);
                } else {
                    console.warn('[Chat] Max reconnect attempts reached');
                }
            };

            ws.onerror = () => {
                // onclose will fire after this
            };

            wsRef.current = ws;
        };

        connectWs();

        return () => {
            reconnectCountRef.current = MAX_RECONNECT;
            clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [pageState, username]);

    // ── Chat: Send Message via WebSocket ──────────────────────────────────
    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            toast.error('Chat not connected');
            return;
        }
        if (!localStorage.getItem(UTUBE_TOKEN)) {
            toast.error('Please log in to chat');
            return;
        }

        wsRef.current.send(JSON.stringify({ text: chatInput.trim() }));
        setChatInput('');
    };

    // ── Auto-scroll Chat ─────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // ── Poll Timer Countdown ──────────────────────────────────────────────
    useEffect(() => {
        if (!activePoll || pollPhase !== 'active') return;
        const timer = setInterval(() => {
            setPollTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setPollPhase('results');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [activePoll, pollPhase]);

    const formatPollTime = (seconds) => {
        if (isNaN(seconds) || seconds == null) return '00:00';
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };



    // ════════════════════════════════════════════════════════════════════════
    // RENDER — ERROR & LOADING STATES
    // ════════════════════════════════════════════════════════════════════════

    if (pageState === 'loading') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white mt-10">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-zinc-700 border-t-red-500 rounded-full animate-spin"></div>
                    <p className="text-zinc-400 text-sm font-mono tracking-wider uppercase">Loading stream...</p>
                </div>
            </div>
        );
    }

    if (pageState === 'not_found') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white mt-10">
                <div className="flex flex-col items-center gap-6 text-center">
                    <svg className="w-24 h-24 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                    <h1 className="text-3xl font-bold text-zinc-300">Channel Not Found</h1>
                    <p className="text-zinc-500 max-w-md">The channel "{username}" doesn't exist or has been removed.</p>
                    <Link to="/" className="mt-4 px-6 py-2.5 bg-red-600 hover:bg-red-500 rounded-full text-sm font-bold transition-colors">
                        Back to Home
                    </Link>
                </div>
            </div>
        );
    }

    if (pageState === 'error') {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white mt-10">
                <div className="flex flex-col items-center gap-6 text-center">
                    <svg className="w-24 h-24 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-1.333-2.694-1.333-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <h1 className="text-3xl font-bold text-zinc-300">Something Went Wrong</h1>
                    <p className="text-zinc-500">Could not load this stream. Please try again later.</p>
                    <button onClick={() => window.location.reload()} className="mt-4 px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm font-bold transition-colors border border-zinc-700">
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════
    // RENDER — MAIN PAGE
    // ════════════════════════════════════════════════════════════════════════

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 px-4 sm:px-6 pb-6 text-white mt-10">
            <div className="max-w-[1920px] mx-auto flex flex-col xl:flex-row gap-6 h-full items-start">

                {/* ── LEFT: Video + Info (expanding) ─────────────────────── */}
                <div className="w-full xl:flex-1 flex flex-col gap-6 min-w-0">

                    {/* Video Container */}
                    <div className="w-full max-w-4xl mx-auto aspect-video bg-black rounded-xl overflow-hidden relative border border-zinc-700/50 shadow-2xl ring-1 ring-zinc-800">
                        <video
                            ref={videoRef}
                            autoPlay
                            controls
                            muted
                            playsInline
                            className="w-full h-full object-contain block"
                        />

                        {/* BRB Overlay */}
                        {brbEnabled && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/95 backdrop-blur-md z-50">
                                <div className="relative mb-6">
                                    <div className="absolute inset-0 bg-purple-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <span className="text-6xl relative z-10">🛡️</span>
                                </div>
                                <h2 className="text-2xl font-black text-white/80 tracking-wider uppercase">Stream Paused</h2>
                                <p className="text-zinc-500 text-sm mt-2">The streamer will be right back!</p>
                            </div>
                        )}

                        {/* Offline Overlay */}
                        {!isLive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 backdrop-blur-sm z-40">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse"></div>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-24 h-24 text-zinc-600 drop-shadow-[0_0_15px_rgba(255,255,255,0.05)] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase mb-4 text-xs">Stream Offline</p>
                                <p className="text-zinc-400 text-sm">{username} is currently not live.</p>
                            </div>
                        )}

                        {/* Live/Offline Badge */}
                        <div className={`absolute top-6 left-6 px-4 py-2 flex items-center gap-3 rounded-lg backdrop-blur-md text-xs tracking-[0.2em] uppercase font-bold border transition-all duration-500 z-20 ${isLive
                            ? 'bg-black/70 text-white border-red-500/50'
                            : 'bg-black/50 text-gray-500 border-gray-800'
                            }`}>
                            <div className="relative flex h-2.5 w-2.5 items-center justify-center">
                                {isLive && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${isLive ? 'bg-red-500' : 'bg-gray-600'}`}></span>
                            </div>
                            {isLive ? 'LIVE' : 'OFFLINE'}
                        </div>

                        {/* ── ACTIVE POLL HUD (MOVED INSIDE VIDEO) ── */}
                        {isLive && activePoll && pollPhase === 'active' && (
                            <div className="absolute top-4 left-4 z-[9999] bg-zinc-900/90 border border-zinc-700/50 rounded-xl p-3 w-64 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
                                <div className="flex items-center justify-between mb-2 border-b border-zinc-800 pb-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                        Live Poll
                                    </span>
                                    <span className={`text-[10px] font-mono font-bold ${pollTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-zinc-400'}`}>
                                        {formatPollTime(pollTimeLeft)}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-white mb-2 leading-tight">{activePoll.question}</p>
                                <div className="space-y-1.5">
                                    {activePoll.options?.map((opt, i) => {
                                        const optName = typeof opt === 'object' ? opt.text : opt;
                                        const votes = typeof opt === 'object' ? (opt.votes || 0) : 0;
                                        const total = activePoll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                                        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;

                                        return (
                                            <button
                                                key={i}
                                                onClick={() => handlePollVote(i)}
                                                disabled={hasVoted}
                                                className="relative w-full text-left bg-zinc-950/50 border border-zinc-800 hover:border-zinc-600 rounded-lg overflow-hidden transition-all group"
                                            >
                                                <div className="absolute top-0 left-0 h-full bg-red-500/20 transition-all duration-500" style={{ width: `${pct}%` }} />
                                                <div className="relative px-2.5 py-1.5 flex justify-between items-center z-10">
                                                    <span className="text-[10px] font-medium text-zinc-200 group-hover:text-white truncate pr-2">{optName}</span>
                                                    {hasVoted && <span className="text-[10px] font-mono font-bold text-zinc-400">{pct}%</span>}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                                {!hasVoted && <p className="text-[9px] text-zinc-500 text-center mt-2 italic">Click to vote</p>}
                            </div>
                        )}
                    </div>

                    {/* Stream Info & Actions */}
                    <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 shadow-xl">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div className="flex items-start gap-4 min-w-0">
                                <img
                                    src={getAvatarUrl(streamMetadata.profileImage, username)}
                                    alt={username}
                                    className="w-12 h-12 rounded-full border-2 border-zinc-700 object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                    <h1 className="text-xl sm:text-2xl font-bold mb-1 truncate">{streamMetadata.title}</h1>
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="text-zinc-400 text-sm font-semibold">{username}</span>

                                        {streamMetadata.subscriberCount > 0 && (
                                            <span className="text-zinc-500 text-xs">{streamMetadata.subscriberCount.toLocaleString()} subscribers</span>
                                        )}

                                        {streamMetadata.category && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-zinc-800/80 border border-zinc-700 rounded-full text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                                <span>{categoryIcons[streamMetadata.category] || '📁'}</span>
                                                {streamMetadata.category}
                                            </span>
                                        )}

                                        {isLive && (
                                            <span className="flex items-center gap-1.5 text-red-400 font-mono text-xs font-bold">
                                                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                                                LIVE NOW
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <div className="flex gap-2">
                                    {isOwnChannel ? (
                                        <button
                                            onClick={() => navigate('/profile')}
                                            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-bold rounded-full transition-all border border-zinc-700"
                                        >
                                            Edit Profile
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleSubscribe}
                                            disabled={subLoading}
                                            className={`px-6 py-2 text-sm font-bold rounded-full transition-all shadow-lg disabled:opacity-50 ${isSubscribed
                                                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                                                : 'bg-white text-black hover:bg-zinc-200'
                                                }`}
                                        >
                                            {subLoading ? '...' : (isSubscribed ? 'Subscribed ✓' : 'Subscribe')}
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center bg-zinc-800/50 rounded-full border border-zinc-700 overflow-hidden">
                                    <button
                                        onClick={handleLike}
                                        disabled={likeLoading}
                                        className={`px-4 py-2.5 hover:bg-zinc-700 transition-colors flex items-center gap-2 text-sm font-semibold border-r border-zinc-700 disabled:opacity-50 ${isLiked ? 'text-red-500' : 'text-zinc-300 hover:text-white'}`}
                                    >
                                        <svg className={`w-5 h-5 transition-transform ${isLiked ? 'scale-110' : ''}`} fill={isLiked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                                        </svg>
                                        Like{likeCount > 0 && ` ${likeCount}`}
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        title="Share"
                                        className="px-4 py-2.5 hover:bg-zinc-700 transition-colors text-zinc-300 hover:text-white group"
                                    >
                                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Recommended Videos (Below Video) ─────────────── */}
                    {recommendedVideos.length > 0 && (
                        <div className="bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 shadow-xl">
                            <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-400 mb-4">Recommended</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {recommendedVideos.map(video => (
                                    <Link
                                        key={video.id}
                                        to={`/video/${video.id}`}
                                        className="group rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-600 transition-all bg-zinc-900/50 hover:bg-zinc-800/50"
                                    >
                                        <div className="aspect-video relative overflow-hidden">
                                            <img
                                                src={getValidUrl(video.thumbnail_url, THUMBNAIL_FALLBACK)}
                                                alt={video.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onError={(e) => { e.target.src = THUMBNAIL_FALLBACK; }}
                                            />
                                            {video.view_count !== undefined && (
                                                <span className="absolute bottom-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] text-zinc-300 font-mono">
                                                    {video.view_count.toLocaleString()} views
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-3">
                                            <p className="text-sm font-semibold text-zinc-200 line-clamp-2 group-hover:text-white transition-colors">{video.title}</p>
                                            <p className="text-xs text-zinc-500 mt-1">{video.author?.username || 'Unknown'}</p>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Live Chat (fixed width) ────────────────────── */}
                <div className="w-full xl:w-[360px] flex flex-col bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-xl h-[calc(100vh-180px)] overflow-hidden shrink-0 xl:sticky xl:top-28">
                    <div className="flex border-b border-zinc-800 shrink-0 bg-white/5">
                        <div className="flex-1 px-4 py-4 text-xs font-bold tracking-widest uppercase text-white border-b-2 border-red-500 flex items-center justify-between">
                            <span>Live Chat</span>
                            <span className={`flex items-center gap-1.5 text-[10px] font-mono ${wsStatus === 'connected' ? 'text-green-400' :
                                wsStatus === 'connecting' ? 'text-yellow-400' : 'text-zinc-500'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-green-500' :
                                    wsStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-zinc-600'
                                    }`}></span>
                                {wsStatus === 'connected' ? 'CONNECTED' :
                                    wsStatus === 'connecting' ? 'CONNECTING' : 'OFFLINE'}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col">
                        <div className="flex flex-col h-full bg-zinc-950/50">
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                                {chatMessages.length === 0 && (
                                    <p className="text-zinc-600 text-xs text-center py-8">No messages yet. Be the first to chat!</p>
                                )}
                                {chatMessages.map(msg => (
                                    <div key={msg.id} className={`text-sm leading-relaxed ${msg.type === 'system' ? 'text-zinc-500 italic text-xs' : ''}`}>
                                        <span className="font-bold inline-flex items-center gap-1.5 align-middle mr-2">
                                            {msg.isMod && <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/50 px-1 py-0.5 rounded uppercase tracking-wider">Mod</span>}
                                            <span className={msg.isMod ? 'text-green-400/90' : 'text-blue-400/90'}>{msg.user}</span>
                                            <span className="text-zinc-600">:</span>
                                        </span>
                                        <span className="text-zinc-300 align-middle">{msg.text}</span>
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
                                        placeholder={
                                            !localStorage.getItem(UTUBE_TOKEN) ? 'Log in to chat' :
                                                wsStatus !== 'connected' ? 'Connecting...' : 'Send a message...'
                                        }
                                        disabled={wsStatus !== 'connected' || !localStorage.getItem(UTUBE_TOKEN)}
                                        className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    />
                                    <button
                                        type="submit"
                                        disabled={wsStatus !== 'connected' || !chatInput.trim() || !localStorage.getItem(UTUBE_TOKEN)}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold tracking-widest uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Send
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* ═══ FULLSCREEN RESULTS MODAL OVERRIDE ═══ */}
            {activePoll && pollPhase === 'results' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
                    <div className="bg-gray-900 border border-cyan-500 p-8 rounded-2xl w-full max-w-2xl text-center shadow-[0_0_50px_rgba(6,182,212,0.5)]">
                        <h2 className="text-4xl font-bold text-cyan-400 mb-6 uppercase tracking-wider">📊 Poll Results</h2>
                        <h3 className="text-2xl text-white mb-8">{activePoll.question}</h3>
                        <div className="space-y-4 mb-8 text-left">
                            {activePoll.options.map((opt, i) => {
                                const total = activePoll.options.reduce((sum, o) => sum + (o.votes || 0), 0);
                                const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
                                const isWinner = opt.votes > 0 && opt.votes === Math.max(...activePoll.options.map(o => o.votes || 0));
                                return (
                                    <div key={i} className="relative p-4 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                                        <div className="absolute top-0 left-0 h-full bg-cyan-600/50 transition-all duration-1000" style={{ width: `${pct}%` }}></div>
                                        <div className="relative z-10 flex justify-between text-xl text-white font-bold">
                                            <span>{opt.text} {isWinner && '👑 WINNER'}</span>
                                            <span>{pct}% ({opt.votes || 0})</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <button onClick={() => { setActivePoll(null); setPollPhase(null); }} className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xl transition-colors">
                            CLOSE RESULTS
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WatchPage;
