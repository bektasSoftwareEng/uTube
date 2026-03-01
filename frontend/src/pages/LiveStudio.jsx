import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { FLV_BASE_URL, WS_BASE_URL, RTMP_URL } from '../utils/urlHelper';
import { UTUBE_TOKEN } from '../utils/authConstants';
import { toast } from 'react-hot-toast';
import flvjs from 'flv.js';
import BackgroundGalleryModal from '../components/BackgroundGalleryModal';

// ═══════════════════════════════════════════════════════════════════════════════
// LiveStudio — Creator Control Room  ▸  NEON-RGB CYBERPUNK EDITION
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIES = ['Gaming', 'IRL', 'Music', 'Technology', 'Education', 'Art'];

// ── Circular Gauge Component ─────────────────────────────────────────────────
const CircularGauge = ({ value, max = 6000, size = 80, strokeWidth = 6 }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.min(value / max, 1);
    const offset = circumference * (1 - pct);
    const color = value >= 3000 ? '#22c55e' : value >= 1000 ? '#eab308' : '#ef4444';

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={strokeWidth} />
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
                    strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference}
                    strokeDashoffset={offset} className="transition-all duration-700 ease-out"
                    style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-xs font-black" style={{ color, textShadow: `0 0 8px ${color}40` }}>
                    {value > 0 ? value : '—'}
                </span>
                <span className="text-[8px] text-white/30 uppercase tracking-widest">kbps</span>
            </div>
        </div>
    );
};

const LiveStudio = () => {
    // ── Stream Settings ──────────────────────────────────────────────────
    const [streamTitle, setStreamTitle] = useState('');
    const [streamCategory, setStreamCategory] = useState('Gaming');
    const [streamDescription, setStreamDescription] = useState('');
    const [streamVisibility, setStreamVisibility] = useState('Public');
    const [streamTags, setStreamTags] = useState('');
    const [streamingQuality, setStreamingQuality] = useState('1080p');
    const [audioInputId, setAudioInputId] = useState('');
    const [videoInputId, setVideoInputId] = useState('');
    const [audioDevices, setAudioDevices] = useState([]);
    const [videoDevices, setVideoDevices] = useState([]);
    const [showTestCamera, setShowTestCamera] = useState(false);
    const [testMic, setTestMic] = useState(false);
    const testVideoRef = useRef(null);

    // Mic Test state
    const [isMicTestRunning, setIsMicTestRunning] = useState(false);
    const [micVolumeLevel, setMicVolumeLevel] = useState(0);
    const [micSensitivity, setMicSensitivity] = useState(100);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const gainNodeRef = useRef(null);
    const microphoneRef = useRef(null);
    const numRafRef = useRef(null);
    const micStreamRef = useRef(null);

    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioIns = devices.filter(d => d.kind === 'audioinput');
                const videoIns = devices.filter(d => d.kind === 'videoinput');
                setAudioDevices(audioIns);
                setVideoDevices(videoIns);
            } catch (e) { }
        };
        getDevices();
        navigator.mediaDevices.addEventListener('devicechange', getDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', getDevices);
    }, []);
    const [peakViewers, setPeakViewers] = useState(0);
    const [totalWatchTime, setTotalWatchTime] = useState(0);
    const [newSubscribersCount, setNewSubscribersCount] = useState(0);
    const [messageRate, setMessageRate] = useState(0);
    const [showKey, setShowKey] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [streamKey, setStreamKey] = useState('');
    const [isLoadingKey, setIsLoadingKey] = useState(true);
    const [showStopModal, setShowStopModal] = useState(false);
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [isLive, setIsLive] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // ── Poll State ────────────────────────────────────────────────────────
    const [showPollModal, setShowPollModal] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [pollDuration, setPollDuration] = useState(60);

    // Smart Chat Scroll State
    const [isUserScrolling, setIsUserScrolling] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('user')) || null;
        } catch { return null; }
    });
    const [uptime, setUptime] = useState(0);

    // ── UI State ─────────────────────────────────────────────────────────
    const [activeRightTab, setActiveRightTab] = useState('settings');
    const [bitrateData, setBitrateData] = useState(Array(20).fill(0));
    const [streamStats, setStreamStats] = useState({ bitrate: 0, fps: 0, resolution: '' });
    const [compactActivity, setCompactActivity] = useState(false);

    // ── Accordion State ──────────────────────────────────────────────────
    const [isEquipmentOpen, setIsEquipmentOpen] = useState(true);
    const [isPerfOpen, setIsPerfOpen] = useState(false);
    const [isBgOpen, setIsBgOpen] = useState(false);

    // ── Pro Telemetry & Controls ─────────────────────────────────────────
    const [droppedFrames, setDroppedFrames] = useState(0);
    const [audioLevel, setAudioLevel] = useState(0);
    const [scenePreset, setScenePreset] = useState(() => localStorage.getItem('uTube_scene') || 'A');
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    // ── Dual-State Mode ──────────────────────────────────────────────────
    const [studioMode, setStudioMode] = useState(() => localStorage.getItem('uTube_studioMode') || 'setup'); // 'setup' | 'broadcast'
    const [equipment, setEquipment] = useState({ mic: false, camera: false, network: navigator.onLine });

    useEffect(() => {
        localStorage.setItem('uTube_studioMode', studioMode);
    }, [studioMode]);

    const [activeBgUrl, setActiveBgUrl] = useState(() => localStorage.getItem('uTube_studioBg') || '');
    const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`;
    const WS_BASE = `ws://${window.location.hostname}:8000/api/v1/ws`;
    const FLV_BASE = `http://${window.location.hostname}:8080`;
    const MEDIA_API_BASE = `http://${window.location.hostname}:8080/api`;

    const API_BASE_URL = import.meta.env.VITE_API_URL || API_BASE;
    const [overlayOpacity, setOverlayOpacity] = useState(() => {
        const stored = localStorage.getItem('studio_bg_darkness');
        return stored !== null ? Number(stored) : 0.4; // 0.4 equals roughly 50% darkness
    });
    const [signalDetected, setSignalDetected] = useState(false);

    // ── Background Library State ─────────────────────────────────────────
    const [showBackgroundModal, setShowBackgroundModal] = useState(false);
    const [customBackgrounds, setCustomBackgrounds] = useState([]);

    // File Input Refs
    const thumbInputRef = useRef(null);
    const [isUploadingThumb, setIsUploadingThumb] = useState(false);

    // Use empty string to leverage Vite Proxy instead of throwing CORS errors
    const NMS_API = import.meta.env.VITE_NMS_API_URL || '';
    const [backendOnline, setBackendOnline] = useState(true);

    // ── Chat State (WebSocket-powered) ───────────────────────────────────
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);
    const [wsStatus, setWsStatus] = useState('disconnected');
    const [slowModeEnabled, setSlowModeEnabled] = useState(false);
    const [fetchErrorCount, setFetchErrorCount] = useState(0);
    const [isPollingStopped, setIsPollingStopped] = useState(false);

    // ── Hype Meter ────────────────────────────────────────────────────────
    const [hypeLevel, setHypeLevel] = useState(0);
    const messageTimestampsRef = useRef([]);

    const [activePoll, setActivePoll] = useState(null);
    const [pollTimeLeft, setPollTimeLeft] = useState(0);
    const [pollPhase, setPollPhase] = useState('none'); // 'none' | 'active' | 'results'

    // ── BRB Shield ─────────────────────────────────────────────────────
    const [brbEnabled, setBrbEnabled] = useState(false);

    // ── Activity Feed (Real-time) ────────────────────────────────────────
    const [activities, setActivities] = useState([]);

    // ── Viewer List ──────────────────────────────────────────────────────
    const [viewers, setViewers] = useState([]);
    const [viewerCount, setViewerCount] = useState(0);
    const [showViewerList, setShowViewerList] = useState(false);
    const [signalHalt, setSignalHalt] = useState(false);

    // ── Refs ─────────────────────────────────────────────────────────────
    const videoRef = useRef(null);
    const flvPlayerRef = useRef(null);
    const chatEndRef = useRef(null);
    const wsRef = useRef(null);
    const reconnectTimerRef = useRef(null);
    const reconnectCountRef = useRef(0);
    const retryTimerRef = useRef(null);
    const MAX_RECONNECT = 5;
    const MAX_PREVIEW_RETRIES = 5;
    const previewRetryCount = useRef(0);
    const rtmpUrl = RTMP_URL;

    // ── Auto-switch mode when stream goes live/offline ────────────────────
    useEffect(() => {
        if (isLive) {
            setStudioMode('broadcast');
        } else {
            // We no longer automatically force 'setup' mode when isLive drops.
            // The checkSignal polling grace period handles kicking dead streams to setup.
            setSignalDetected(false);
        }
    }, [isLive]);

    // ── Signal Heartbeat (detect stream in setup mode or connection recovery) ────────────────
    useEffect(() => {
        if (isLive || !currentUser?.username || isPollingStopped || signalHalt) return;
        let active = true;
        let localMissCount = 0;

        const checkSignal = async () => {
            if (!active) return;
            try {
                let found = false;
                let fetchError = false;
                let res;
                try {
                    res = await fetch(`${MEDIA_API_BASE}/streams`);
                    if (!res.ok && res.status === 404) {
                        res = await fetch(`${MEDIA_API_BASE}/server/streams`);
                    }

                    if (res && res.status === 404) {
                        setSignalHalt(true);
                        setTimeout(() => setSignalHalt(false), 30000);
                    } else if (res && res.ok) {
                        setFetchErrorCount(0);
                    }
                } catch (e) {
                    setSignalHalt(true);
                    setTimeout(() => setSignalHalt(false), 30000);
                    setBackendOnline(false);
                }

                if (!fetchError) setBackendOnline(true);

                if (res && res.ok) {
                    const data = await res.json();
                    const liveStreams = data?.live || data?.['live'] || {};
                    for (const key of Object.keys(liveStreams)) {
                        if (liveStreams[key]?.publisher && (key === streamKey || key.includes(streamKey))) {
                            found = true;
                            break;
                        }
                    }
                } else if (res?.status === 404 && fetchErrorCount < 3) {
                    // Attempt blind fallback if still under retry limit
                    found = await new Promise((resolve) => {
                        if (!flvjs.isSupported()) return resolve(false);
                        const testUrl = `${FLV_BASE}/${streamKey}.flv`;
                        const testPlayer = flvjs.createPlayer({ type: 'flv', url: testUrl, isLive: true, cors: true });
                        const cleanup = (result) => {
                            try { testPlayer.unload(); testPlayer.destroy(); } catch (e) { }
                            resolve(result);
                        };
                        const timeout = setTimeout(() => cleanup(false), 2000);
                        testPlayer.on(flvjs.Events.METADATA_ARRIVED, () => { clearTimeout(timeout); cleanup(true); });
                        testPlayer.on(flvjs.Events.STATISTICS_INFO, () => { clearTimeout(timeout); cleanup(true); });
                        testPlayer.on(flvjs.Events.ERROR, () => { clearTimeout(timeout); cleanup(false); });
                        try { testPlayer.load(); } catch (e) { cleanup(false); }
                    });
                }

                if (active) {
                    if (found) {
                        localMissCount = 0;
                        setSignalDetected(true);
                    } else {
                        localMissCount += 1;
                        if (localMissCount >= 2) {
                            setSignalDetected(false);
                            setStudioMode(prev => prev === 'broadcast' ? 'setup' : prev);
                        }
                    }
                }
            } catch { }
        };

        checkSignal();
        const interval = setInterval(checkSignal, 3000);
        return () => { active = false; clearInterval(interval); };
    }, [isLive, streamKey, NMS_API, signalHalt, isPollingStopped]);

    // ── Equipment checklist detection (Real Hardware Sync) ────────────────
    useEffect(() => {
        const checkEquipment = async () => {
            try {
                // Request actual permissions to ensure they are available and not blocked
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
                setEquipment({ mic: true, camera: true });
                // Instantly stop the tracks so we don't hold the camera light on
                stream.getTracks().forEach(track => track.stop());
            } catch (err) {
                // Determine what failed
                const errStr = err.toString().toLowerCase();
                setEquipment({
                    mic: !errStr.includes('audio') && !errStr.includes('microphone'),
                    camera: !errStr.includes('video') && !errStr.includes('camera')
                });
            }
        };
        checkEquipment();
    }, []);

    // ── Pro Telemetry & Audio Simulation (Real-time Mock) ─────────────────
    useEffect(() => {
        if (!isLive && !signalDetected) {
            setAudioLevel(0);
            setStreamStats(prev => ({ ...prev, bitrate: 0, fps: 0 }));
            return;
        }
        const interval = setInterval(() => {
            if (micEnabled) {
                setAudioLevel(Math.floor(Math.random() * 50) + 30 + (Math.random() > 0.8 ? 20 : 0));
            } else {
                setAudioLevel(0);
            }
            setStreamStats(prev => ({
                ...prev,
                bitrate: 5500 + Math.floor(Math.random() * 600),
                fps: 59 + (Math.random() > 0.5 ? 1 : 0)
            }));
            if (Math.random() > 0.95) setDroppedFrames(prev => prev + Math.floor(Math.random() * 3) + 1);
        }, 500);
        return () => clearInterval(interval);
    }, [isLive, signalDetected, micEnabled]);

    // ── Device Enumeration ────────────────────────────────────────────────
    useEffect(() => {
        const getDevices = async () => {
            try {
                const devices = await navigator.mediaDevices.enumerateDevices();
                setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
                setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
            } catch (err) {
                console.warn("Device enumeration failed", err);
            }
        };
        getDevices();
    }, []);

    // ── Test Camera Effect ────────────────────────────────────────────────
    useEffect(() => {
        let stream;
        if (showTestCamera && testVideoRef.current) {
            navigator.mediaDevices.getUserMedia({ video: videoInputId ? { deviceId: videoInputId } : true })
                .then(s => {
                    stream = s;
                    if (testVideoRef.current) testVideoRef.current.srcObject = s;
                })
                .catch(e => console.error("Camera test failed", e));
        }
        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [showTestCamera, videoInputId]);

    // ── Hype / Watch Time / Peak ──────────────────────────────────────────
    useEffect(() => {
        const rateInterval = setInterval(() => {
            const now = Date.now();
            const recentMessages = messageTimestampsRef.current.filter(t => now - t < 60000);
            setMessageRate(recentMessages.length);
        }, 2000);
        return () => clearInterval(rateInterval);
    }, []);

    useEffect(() => {
        if (viewerCount > peakViewers) setPeakViewers(viewerCount);
    }, [viewerCount, peakViewers]);

    useEffect(() => {
        let wtInterval;
        if (isLive) {
            wtInterval = setInterval(() => setTotalWatchTime(p => p + viewerCount), 1000);
        }
        return () => clearInterval(wtInterval);
    }, [isLive, viewerCount]);

    const formatWatchTime = (sec) => {
        return (sec / 3600).toFixed(1) + 'h';
    };

    const isCameraReady = equipment.camera || videoDevices.length > 0;
    const isMicReady = equipment.mic || audioDevices.length > 0;
    const canStartBroadcast = streamTitle.trim().length > 0 && !!streamCategory && streamDescription.trim().length > 0 && isCameraReady && isMicReady;

    // ════════════════════════════════════════════════════════════════════════
    // FLV PLAYER & EFFECTS
    // ════════════════════════════════════════════════════════════════════════


    const initPlayer = () => {
        if (!videoRef.current || !currentUser?.username) return;
        setIsConnecting(true);

        if (flvPlayerRef.current) {
            try { flvPlayerRef.current.pause(); flvPlayerRef.current.unload(); flvPlayerRef.current.detachMediaElement(); flvPlayerRef.current.destroy(); } catch (e) { }
            flvPlayerRef.current = null;
        }

        const streamUrl = `${FLV_BASE}/live/${streamKey}.flv`;
        const player = flvjs.createPlayer(
            { type: 'flv', isLive: true, hasAudio: true, hasVideo: true, url: streamUrl, cors: true },
            { enableWorker: false, enableStashBuffer: false, stashInitialSize: 128 }
        );

        player.attachMediaElement(videoRef.current);
        player.load();

        player.play().then(() => {
            setIsLive(true);
            setIsConnecting(false);
            previewRetryCount.current = 0;
            setBackendOnline(true);
            // Strict Wipe on Stream Start
            setChatMessages([]);
            setActivePoll(null);
            setShowPollModal(false);
        }).catch(() => {
            setIsConnecting(false);
            if (previewRetryCount.current < MAX_PREVIEW_RETRIES) {
                previewRetryCount.current += 1;
                toast(`Retrying preview... (${previewRetryCount.current}/${MAX_PREVIEW_RETRIES})`, { icon: '🔄', style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } });
                retryTimerRef.current = setTimeout(initPlayer, 3000);
            } else {
                toast.error('Could not connect to OBS. Make sure your stream is running.');
                previewRetryCount.current = 0;
            }
        });

        player.on(flvjs.Events.ERROR, () => {
            if (flvPlayerRef.current) { try { flvPlayerRef.current.unload(); flvPlayerRef.current.detachMediaElement(); flvPlayerRef.current.destroy(); } catch (e) { } flvPlayerRef.current = null; }
            setIsLive(false); setIsConnecting(false);
        });

        flvPlayerRef.current = player;
    };

    const handleStopBroadcast = () => {
        if (flvPlayerRef.current) {
            try {
                flvPlayerRef.current.pause();
                flvPlayerRef.current.unload();
                flvPlayerRef.current.detachMediaElement();
                flvPlayerRef.current.destroy();
            } catch (err) { }
            flvPlayerRef.current = null;
        }
        setIsLive(false);
        setStudioMode('setup');
        setShowStopModal(false);

        // CRITICAL UI REQ: Clear chat session history when broadcast ends
        setChatMessages([]);
        setActivePoll(null); // ERADICATE GHOST POLLS
        setPollPhase('none');
        setShowPollModal(false); // NO STREAM NO POLLS

        toast.success("Broadcast stopped safely");
    };

    // ════════════════════════════════════════════════════════════════════════
    // EFFECTS (all business logic unchanged)
    // ════════════════════════════════════════════════════════════════════════

    useEffect(() => {
        if (!currentUser?.username) return;

        let retryCount = 0;
        const maxRetries = 10;
        const baseDelay = 1000;
        let isComponentMounted = true;

        const connectWs = () => {
            if (!isComponentMounted) return;

            const token = localStorage.getItem(UTUBE_TOKEN);
            if (!token) return;

            const wsUrl = `${WS_BASE}/chat/${currentUser.username}?token=${encodeURIComponent(token)}`;
            setWsStatus(retryCount === 0 ? 'connecting' : 'reconnecting');
            const ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                if (!isComponentMounted) { ws.close(); return; }
                setWsStatus('connected'); retryCount = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const parsedMessage = JSON.parse(event.data);
                    switch (parsedMessage.type) {
                        case 'chat': case 'system':
                            setChatMessages(prev => [...prev, parsedMessage].slice(-200));
                            if (parsedMessage.type === 'chat') messageTimestampsRef.current.push(Date.now());
                            break;
                        case 'activity':
                            setActivities(prev => [parsedMessage, ...prev].slice(0, 50));
                            if (parsedMessage.activity_type === 'subscribe') setNewSubscribersCount(p => p + 1);
                            break;
                        case 'viewer_list': setViewers(parsedMessage.viewers || []); setViewerCount(parsedMessage.count || 0); break;
                        case 'slow_mode': setSlowModeEnabled(parsedMessage.enabled); break;
                        case 'message_deleted': setChatMessages(prev => prev.filter(m => m.id !== parsedMessage.msg_id)); break;
                        case 'POLL_START':
                            setActivePoll(parsedMessage.data);
                            setPollTimeLeft(parsedMessage.data.duration);
                            setPollPhase('active');
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
                            setPollPhase('none');
                            setPollTimeLeft(0);
                            break;
                        case 'brb': setBrbEnabled(parsedMessage.enabled); break;
                        case 'status_update':
                            // Sync local isLive state with backend webhook truth
                            const newLiveStatus = !!parsedMessage.is_live;
                            setIsLive(newLiveStatus);
                            if (!newLiveStatus) {
                                // If webhook says we are done, perform cleanup
                                setChatMessages([]);
                                setActivePoll(null);
                                setPollPhase('none');
                                toast('Stream stopped (from server)', { icon: '⏹️' });
                            }
                            break;
                        default: break;
                    }
                } catch { }
            };

            ws.onclose = () => {
                if (!isComponentMounted) return;

                setWsStatus('disconnected'); wsRef.current = null;

                if (retryCount < maxRetries) {
                    const delay = 5000; // Strict 5-second delay before any reconnection attempt
                    retryCount += 1;
                    console.log(`WebSocket reconnecting in ${Math.round(delay / 1000)}s... (Attempt ${retryCount}/${maxRetries})`);
                    reconnectTimerRef.current = setTimeout(connectWs, delay);
                } else {
                    toast.error('Chat connection lost. Please refresh the page.', { id: 'ws-fail' });
                }
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setWsStatus('disconnected');
            };
            wsRef.current = ws;
        };

        connectWs();

        return () => {
            isComponentMounted = false;
            clearTimeout(reconnectTimerRef.current);
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
        };
    }, [currentUser?.username]);

    // ── FIX: Background Tab Freeze (Live Edge Catch-up) ──────────────────
    useEffect(() => {
        const handleVisibility = () => {
            if (!document.hidden && videoRef.current && videoRef.current.buffered.length > 0) {
                const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
                if (bufferedEnd - videoRef.current.currentTime > 2) {
                    videoRef.current.currentTime = bufferedEnd; // Jump to live edge
                }
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, []);

    // ── THE BULLETPROOF TIMER ──
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

    useEffect(() => {
        let heartbeatInterval;
        let lastTime = videoRef.current?.currentTime !== undefined ? videoRef.current.currentTime : -1;
        if (isLive) {
            heartbeatInterval = setInterval(() => {
                if (document.hidden || !videoRef.current) return;
                const currentTime = videoRef.current.currentTime;
                if (lastTime !== -1 && Math.abs(currentTime - lastTime) < 0.1) {
                    if (flvPlayerRef.current) { try { flvPlayerRef.current.unload(); flvPlayerRef.current.detachMediaElement(); flvPlayerRef.current.destroy(); } catch (e) { } flvPlayerRef.current = null; }
                    setIsLive(false); setIsConnecting(false);
                    setChatMessages([]); // GLOBAL CHAT WIPE
                    setActivePoll(null); // ERADICATE GHOST POLLS
                    setPollPhase('none');
                    toast.error('Stream connection lost (OBS stopped).');
                }
                lastTime = currentTime;
            }, 3000);
        }
        return () => clearInterval(heartbeatInterval);
    }, [isLive]);

    useEffect(() => {
        let uptimeInterval;
        if (isLive) { uptimeInterval = setInterval(() => setUptime(prev => prev + 1), 1000); } else { setUptime(0); }
        return () => clearInterval(uptimeInterval);
    }, [isLive]);

    const formatUptime = (seconds) => {
        const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${hrs}:${mins}:${secs}`;
    };

    // ── Poll Timer Countdown ──────────────────────────────────────────────
    useEffect(() => {
        let timer;
        if (activePoll && pollPhase === 'active') {
            timer = setInterval(() => {
                setPollTimeLeft(prev => {
                    if (prev <= 1) {
                        setPollPhase('results');
                        clearInterval(timer);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [activePoll, pollPhase]);

    const formatPollTime = (seconds) => {
        if (isNaN(seconds) || seconds == null) return '00:00';
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const toggleMicTest = async () => {
        if (isMicTestRunning) {
            if (numRafRef.current) cancelAnimationFrame(numRafRef.current);
            if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
            if (audioContextRef.current) {
                if (gainNodeRef.current) gainNodeRef.current.disconnect();
                if (microphoneRef.current) microphoneRef.current.disconnect();
                if (analyserRef.current) analyserRef.current.disconnect();
                audioContextRef.current.close().catch(() => { });
            }
            audioContextRef.current = null;
            analyserRef.current = null;
            gainNodeRef.current = null;
            microphoneRef.current = null;
            micStreamRef.current = null;
            setMicVolumeLevel(0);
            setIsMicTestRunning(false);
        } else {
            try {
                // Determine exact device ID constraint
                const constraints = audioInputId && audioDevices.some(d => d.deviceId === audioInputId)
                    ? { deviceId: { exact: audioInputId } }
                    : true;
                const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
                micStreamRef.current = stream;

                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioContext();
                audioContextRef.current = audioCtx;

                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyser.smoothingTimeConstant = 0.5;
                analyserRef.current = analyser;

                const source = audioCtx.createMediaStreamSource(stream);
                microphoneRef.current = source;

                const gainNode = audioCtx.createGain();
                gainNode.gain.value = inputSensitivity;
                gainNodeRef.current = gainNode;

                source.connect(gainNode);
                gainNode.connect(analyser);
                gainNode.connect(audioCtx.destination);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                const updateVolume = () => {
                    if (!analyserRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                    const avg = sum / dataArray.length;
                    setMicVolumeLevel(Math.min(100, (avg / 256) * 100 * 1.5));
                    numRafRef.current = requestAnimationFrame(updateVolume);
                };
                updateVolume();
                setIsMicTestRunning(true);
            } catch (err) {
                toast.error('Could not access microphone.');
            }
        }
    };

    // Removed duplicate audio/mic logic that caused syntax errors

    useEffect(() => {
        return () => {
            if (numRafRef.current) cancelAnimationFrame(numRafRef.current);
            if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
            if (audioContextRef.current) {
                if (gainNodeRef.current) gainNodeRef.current.disconnect();
                if (microphoneRef.current) microphoneRef.current.disconnect();
                if (analyserRef.current) analyserRef.current.disconnect();
                audioContextRef.current.close().catch(() => { });
            }
        };
    }, []);

    // ── Safe Broadcast Hooks ──────────────────────────────────────────────────────────

    useEffect(() => {
        if (!isUserScrolling) {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } else {
            setUnreadCount(prev => prev + 1);
        }
    }, [chatMessages]);

    const handleChatScroll = (e) => {
        const { scrollTop, scrollHeight, clientHeight } = e.target;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

        if (isAtBottom) {
            setIsUserScrolling(false);
            setUnreadCount(0);
        } else {
            setIsUserScrolling(true);
        }
    };

    useEffect(() => {
        let statsInterval;
        if (studioMode === 'broadcast' && isLive && currentUser?.username) {
            const fetchDashboardStats = async () => {
                try {
                    const res = await ApiClient.get(`/streams/${currentUser.username}/stats`);
                    const data = res.data;

                    setViewerCount(data.current_viewers || 0);
                    setPeakViewers(currentPeak => Math.max(currentPeak, data.current_viewers || 0));
                    setMessageRate(data.chat_rate || 0);
                    setNewSubscribersCount(data.new_subs || 0);

                    // Watch time artificially increases per user.
                    // If we had absolute actual users across the entire video, 
                    // the backend would compile `sum(user_session_duration)`
                    setTotalWatchTime(prev => prev + ((data.current_viewers || 0) * 10));
                } catch (error) {
                    console.error("Dashboard Stats Error:", error);
                }
            };

            // Intial fetch immediately
            fetchDashboardStats();
            // Strict 10-second polling to save DB load
            statsInterval = setInterval(fetchDashboardStats, 10000);
        } else {
            // Drop to zero immediately if not broadcasting
            setViewerCount(0);
            setMessageRate(0);
            setNewSubscribersCount(0);
        }
        return () => clearInterval(statsInterval);
    }, [studioMode, isLive, currentUser?.username]);

    // ────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        if (activeRightTab === 'chat' && chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }, [chatMessages, activeRightTab]);

    useEffect(() => {
        const hypeInterval = setInterval(() => {
            const now = Date.now();
            messageTimestampsRef.current = messageTimestampsRef.current.filter(t => now - t < 10000);
            setHypeLevel(Math.round((messageTimestampsRef.current.length / 10) * 10) / 10);
        }, 1000);
        return () => clearInterval(hypeInterval);
    }, []);

    useEffect(() => {
        let statsInterval;
        if (isLive && streamKey) {
            const fetchStats = async () => {
                try {
                    const res = await fetch(`${NMS_API}/api/streams`);
                    if (!res.ok) throw new Error('NMS unreachable');
                    const data = await res.json();
                    const liveStreams = data?.live || {};
                    let found = null;
                    for (const key of Object.keys(liveStreams)) {
                        const pub = liveStreams[key]?.publisher;
                        if (pub && (key === streamKey || key.includes(streamKey))) { found = pub; break; }
                    }
                    if (found) {
                        const bitrate = Math.round((found.bytes || 0) / 1024) || found.videoBitrate || 0;
                        const realBitrate = found.videoBitrate || found.bitrate || bitrate;
                        setStreamStats({ bitrate: realBitrate, fps: found.videoFps || found.fps || 0, resolution: found.videoWidth && found.videoHeight ? `${found.videoWidth}x${found.videoHeight}` : '' });
                        setBitrateData(prev => [...prev.slice(1), realBitrate]);
                    }
                } catch { }
            };
            fetchStats();
            statsInterval = setInterval(fetchStats, 2000);
        } else {
            setBitrateData(Array(20).fill(0));
            setStreamStats({ bitrate: 0, fps: 0, resolution: '' });
        }
        return () => clearInterval(statsInterval);
    }, [isLive, streamKey]);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const keyResponse = await ApiClient.get('/auth/stream-key');
                setStreamKey(keyResponse.data.stream_key);
                const userResponse = await ApiClient.get('/auth/me');

                // Hydrate thumbnail from localStorage if it exists and backend doesn't provide it
                const localUser = JSON.parse(localStorage.getItem('user') || '{}');
                const mergedThumb = userResponse.data.stream_thumbnail || localUser.stream_thumbnail;

                const finalUser = { ...userResponse.data, stream_thumbnail: mergedThumb };
                setCurrentUser(finalUser);
                localStorage.setItem('user', JSON.stringify(finalUser));

                if (userResponse.data.stream_title) setStreamTitle(userResponse.data.stream_title);
                if (userResponse.data.stream_category) setStreamCategory(userResponse.data.stream_category);
                // Background & Thumbnail data is available inside currentUser
                if (userResponse.data.studio_bg_url) {
                    setActiveBgUrl(userResponse.data.studio_bg_url);
                    localStorage.setItem('uTube_studioBg', userResponse.data.studio_bg_url);
                }
                setBackendOnline(true);
            } catch (error) {
                if (error.code === 'ERR_NETWORK' || error.message.toLowerCase().includes('network error') || error.code === 'ECONNABORTED') {
                    setBackendOnline(false);
                }
                // Silently handle offline backend instead of spamming toast loop errors during offline mode
            } finally { setIsLoadingKey(false); }
        };
        fetchInitialData();
        return () => {
            clearTimeout(retryTimerRef.current);
            if (flvPlayerRef.current) { try { flvPlayerRef.current.pause(); flvPlayerRef.current.unload(); flvPlayerRef.current.detachMediaElement(); flvPlayerRef.current.destroy(); } catch (err) { } flvPlayerRef.current = null; }
        };
    }, []);

    // Fetch custom backgrounds when modal opens
    useEffect(() => {
        if (showBackgroundModal) {
            ApiClient.get('/auth/backgrounds').then(res => {
                setCustomBackgrounds(res.data);
            }).catch(() => toast.error("Could not load backgrounds"));
        }
    }, [showBackgroundModal]);

    const handleSelectBackground = async (bgId, url) => {
        try {
            if (bgId !== 'default') {
                await ApiClient.put(`/auth/backgrounds/${bgId}/select`);
            } else {
                // If there was an endpoint to clear default we would call it, 
                // but setting local overrides works for UX right now
            }
            setActiveBgUrl(url);
            localStorage.setItem('uTube_studioBg', url);
            toast.success('Background applied!', { style: { background: '#0a0a0a', color: '#fff' } });
        } catch {
            toast.error("Could not apply background.");
        }
    };

    const handleUploadThumbnail = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingThumb(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await ApiClient.post('/auth/live/thumbnail', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const newPath = res.data?.path || res.data?.stream_thumbnail;
            setCurrentUser(prev => {
                const updated = { ...prev, stream_thumbnail: newPath };
                try {
                    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
                    localStorage.setItem('user', JSON.stringify({ ...storedUser, stream_thumbnail: newPath }));
                } catch (e) { console.error('Storage error', e); }
                return updated;
            });
            toast.success("Thumbnail updated!");
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.detail || "Failed to upload thumbnail.");
        } finally {
            setIsUploadingThumb(false);
            if (thumbInputRef.current) thumbInputRef.current.value = '';
        }
    };

    useEffect(() => {
        // Activity & Chat History Fetch strictly disabled per "No Data" rules
        setActivities([]);
    }, [currentUser?.username]);

    useEffect(() => {
        // Chat History Fetch Disabled per requirements
        if (!isLive) {
            setChatMessages([]);
            setActivePoll(null);
            setShowPollModal(false);
        }
    }, [isLive]);

    // (Removed corrupted duplicate and nested WebSocket logic)

    const handleUpdateMetadata = async () => {
        setIsSubmitting(true);
        try { await ApiClient.put('/auth/live-metadata', { title: streamTitle, category: streamCategory }); toast.success("Metadata updated!", { icon: '📝', style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }); }
        catch { toast.error("Failed to update metadata."); }
        finally { setIsSubmitting(false); }
    };

    const handleRegenerateKey = async () => {
        setIsLoadingKey(true);
        try { const response = await ApiClient.post('/auth/stream-key/reset'); setStreamKey(response.data.stream_key); setShowKey(false); setShowRegenerateModal(false); toast.success("Stream key regenerated!", { icon: '🔄', style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }); }
        catch { toast.error("Failed to regenerate key."); }
        finally { setIsLoadingKey(false); }
    };

    const copyToClipboard = (text) => { navigator.clipboard.writeText(text); toast.success("Copied!", { id: 'copy-toast', icon: '📋', style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }); };

    const handleSendChat = (e) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) { toast.error('Chat not connected'); return; }
        wsRef.current.send(JSON.stringify({ text: chatInput.trim() }));
        setChatInput('');
    };

    const handleDeleteMessage = (msgId) => { if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return; wsRef.current.send(JSON.stringify({ type: 'command', action: 'delete_message', msg_id: msgId })); };
    const handleToggleSlowMode = () => { if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return; wsRef.current.send(JSON.stringify({ type: 'command', action: 'slow_mode', enabled: !slowModeEnabled })); };

    const handleStartPoll = (e) => {
        if (e) e.preventDefault();
        const validOptions = pollOptions.filter(opt => opt.trim());
        if (!pollQuestion.trim() || validOptions.length < 2) {
            toast.error("Enter a question and at least 2 options.");
            return;
        }
        if (wsStatus !== 'connected' || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            toast.error('WebSocket not connected');
            return;
        }

        const finalDuration = parseInt(pollDuration, 10);
        if (isNaN(finalDuration) || finalDuration <= 0) return; // Stop if invalid

        const formattedOptions = validOptions.map(opt => ({ text: opt, votes: 0 }));
        const question = pollQuestion.trim();
        const ws = wsRef.current;

        const pollPayload = {
            type: 'POLL_START',
            data: { question, options: formattedOptions, duration: finalDuration }
        };
        ws.send(JSON.stringify(pollPayload));

        // Set local state so streamer sees it too
        setActivePoll(pollPayload.data);
        setPollTimeLeft(finalDuration);
        setPollPhase('active');

        toast.success("Live Poll Started!");
        setShowPollModal(false);
        setPollQuestion('');
        setPollOptions(['', '']);
    };

    const handleCreateClip = async () => {
        if (wsStatus !== 'connected') { toast.error('WebSocket not connected'); return; }
        const toastId = toast.loading('🎬 Recording clip... (15s)', { style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }, duration: 15000 });
        try { await ApiClient.post('/live/clip'); setTimeout(() => { toast.success('Clip saved!', { id: toastId }); }, 15000); } catch { toast.error('Failed to log clip', { id: toastId }); }
    };

    const handleToggleBrb = () => {
        if (wsStatus !== 'connected') { toast.error('WebSocket not connected'); return; }
        const newState = !brbEnabled;
        wsRef.current.send(JSON.stringify({ type: 'command', action: 'brb', enabled: newState }));
        setBrbEnabled(newState);
    };

    const handleStreamMarker = async () => {
        if (wsStatus !== 'connected') { toast.error('WebSocket not connected'); return; }
        try {
            await ApiClient.post('/live/marker');
            toast.success('📍 Marker saved!', { style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } });
        } catch { toast.error('Failed to save marker'); }
    };

    const formatActivityTime = (timestamp) => {
        if (!timestamp) return '';
        const diff = Math.floor((Date.now() - timestamp) / 1000);
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    // ── Hype label helper ────────────────────────────────────────────────
    const hypeColor = hypeLevel >= 3 ? 'text-orange-400' : hypeLevel >= 1.5 ? 'text-yellow-400' : hypeLevel >= 0.5 ? 'text-cyan-400' : 'text-white/20';
    const hypeLabel = hypeLevel >= 3 ? '🔥 FIRE' : hypeLevel >= 1.5 ? '🔥 HOT' : hypeLevel >= 0.5 ? '✨ Warm' : '😴 Quiet';
    const hypeBarColor = hypeLevel >= 3 ? 'from-orange-500 to-red-500' : hypeLevel >= 1.5 ? 'from-yellow-500 to-orange-500' : hypeLevel >= 0.5 ? 'from-cyan-500 to-blue-500' : 'from-white/10 to-white/5';

    // ════════════════════════════════════════════════════════════════════════
    // RENDER — CYBER NOIR
    // ════════════════════════════════════════════════════════════════════════

    const getBgUrl = (url) => {
        if (!url || url === 'default') return '/videos/default_bg.mp4';
        if (url.startsWith('blob:')) return url;
        if (url.startsWith('http') || url.startsWith('/videos/')) return url + "#t=0.1";
        if (url.startsWith('/backgrounds')) return `${API_BASE_URL}/uploads${url}#t=0.1`;
        return `${API_BASE_URL}${url}#t=0.1`;
    };

    return (
        <div className="min-h-screen bg-[#050505] mt-1 pt-1 px-4 sm:px-6 pb-2 text-white relative overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* ── Video Background Layer ── */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <video key={activeBgUrl || 'default'} src={getBgUrl(activeBgUrl)} crossOrigin="anonymous" preload="auto" autoPlay muted loop playsInline className="w-full h-full object-cover" style={{ opacity: 0.2 }} />
                <div className="absolute inset-0 bg-black transition-opacity duration-300" style={{ opacity: overlayOpacity }} />
            </div>

            {/* ── Backend Health Check Banner ── */}
            <AnimatePresence>
                {!backendOnline && (
                    <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}
                        className="fixed top-0 left-0 right-0 z-50 flex justify-center mt-4 pointer-events-none">
                        <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-xl px-6 py-2 rounded-full shadow-[0_0_20px_rgba(239,68,68,0.2)] flex items-center gap-3">
                            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}
                                className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                            <span className="text-red-400 font-jet font-bold text-[10px] tracking-[0.2em] uppercase">Backend Offline - Connection Refused</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="relative z-10">
                {/* ── Fonts + Neon RGB Keyframes ── */}
                <style>{`
                @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&display=swap');
                .font-jet { font-family: 'JetBrains Mono', monospace; }
                @keyframes neonBorderCycle {
                    0%   { border-color: rgba(239,68,68,0.4); box-shadow: 0 0 8px rgba(239,68,68,0.15), inset 0 0 6px rgba(239,68,68,0.05); }
                    50%  { border-color: rgba(6,182,212,0.4); box-shadow: 0 0 8px rgba(6,182,212,0.15), inset 0 0 6px rgba(6,182,212,0.05); }
                    100% { border-color: rgba(239,68,68,0.4); box-shadow: 0 0 8px rgba(239,68,68,0.15), inset 0 0 6px rgba(239,68,68,0.05); }
                }
                .neon-panel {
                    border: 1px solid rgba(239,68,68,0.3);
                    animation: neonBorderCycle 4s ease-in-out infinite;
                }
                @keyframes traverseNeon {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .text-traverse-neon {
                    background: linear-gradient(90deg, #06b6d4, #3b82f6, #06b6d4);
                    background-size: 200% auto;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: traverseNeon 3s linear infinite;
                    text-shadow: 0 0 10px rgba(6, 182, 212, 0.3);
                }
                @keyframes neonTextGlow {
                    0%   { text-shadow: 0 0 6px #ef444480; }
                    33%  { text-shadow: 0 0 6px #22c55e80; }
                    66%  { text-shadow: 0 0 6px #3b82f680; }
                    100% { text-shadow: 0 0 6px #ef444480; }
                }
                .neon-text { animation: neonTextGlow 6s ease-in-out infinite; }
                @keyframes neonInputFocus {
                    0%   { border-color: #ef4444; box-shadow: 0 0 6px #ef444430; }
                    33%  { border-color: #3b82f6; box-shadow: 0 0 6px #3b82f630; }
                    66%  { border-color: #a855f7; box-shadow: 0 0 6px #a855f730; }
                    100% { border-color: #ef4444; box-shadow: 0 0 6px #ef444430; }
                }
                .neon-input:focus { animation: neonInputFocus 4s linear infinite; }
                input[type="range"]::-webkit-slider-thumb {
                    -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%;
                    background: #06b6d4; box-shadow: 0 0 8px rgba(6,182,212,0.6), 0 0 16px rgba(6,182,212,0.2);
                    cursor: pointer; border: 2px solid rgba(255,255,255,0.15);
                }
                input[type="range"]::-moz-range-thumb {
                    width: 14px; height: 14px; border-radius: 50%;
                    background: #06b6d4; box-shadow: 0 0 8px rgba(6,182,212,0.6); cursor: pointer; border: 2px solid rgba(255,255,255,0.15);
                }
            `}</style>

                {/* ═══ Top Bar (Zero-Gap Title) ═══ */}
                <div className="max-w-[1920px] mx-auto mt-1 mb-2 flex flex-col md:flex-row items-start md:items-center justify-between pb-2 border-b border-white/5 gap-3">
                    <div className="flex items-center gap-6">
                        <h1 className="text-xl font-black flex items-center gap-2 tracking-tight">
                            {studioMode === 'broadcast' && (
                                <motion.span
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                                />
                            )}
                            <span className="text-traverse-neon" style={{ fontFamily: "'Orbitron', sans-serif" }}>CONTROL ROOM</span>
                        </h1>

                        {/* ═══ Stream Health Ribbon (Axis-Aligned with Title) ═══ */}
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-white/[0.04] border border-white/10 rounded-full backdrop-blur-md">
                            <span className="text-[10px] font-jet uppercase tracking-widest text-white/50 flex items-center gap-2">
                                [
                                <span className={equipment.mic ? 'text-emerald-400' : 'text-red-400'}>{equipment.mic ? 'RDY 🎙️' : 'ERR 🎙️'}</span> |
                                <span className={equipment.camera ? 'text-emerald-400' : 'text-red-400'}>{equipment.camera ? 'RDY 📷' : 'ERR 📷'}</span> |
                                BITRATE: <span className="text-cyan-400 font-bold">{streamStats.bitrate}</span> |
                                FPS: <span className="text-yellow-400 font-bold">{streamStats.fps}</span>
                                ]
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {studioMode === 'broadcast' && (
                            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={() => setShowViewerList(!showViewerList)}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:border-white/20 transition-colors text-sm backdrop-blur-3xl"
                            >
                                <span>👁️</span>
                                <span className="font-jet font-bold text-xs">{viewerCount}</span>
                                <span className="text-white/30 text-[10px]">viewers</span>
                            </motion.button>
                        )}
                        {studioMode === 'broadcast' && (
                            <span className={`flex items-center gap-1.5 text-[9px] font-jet ${wsStatus === 'connected' ? 'text-emerald-400' : wsStatus === 'connecting' ? 'text-yellow-400' : 'text-white/20'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500' : wsStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-white/20'}`} style={wsStatus === 'connected' ? { boxShadow: '0 0 6px #22c55e' } : {}} />
                                {wsStatus === 'connected' ? 'WS ONLINE' : wsStatus === 'connecting' ? 'CONNECTING' : 'WS OFFLINE'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Viewer List Dropdown */}
                <AnimatePresence>
                    {showViewerList && (
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            className="max-w-[1920px] mx-auto mb-4"
                        >
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-w-xs backdrop-blur-3xl">
                                <h3 className="text-[10px] font-jet font-bold uppercase tracking-[0.2em] text-white/40 mb-3">Active Viewers ({viewerCount})</h3>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {viewers.length === 0 && <p className="text-white/20 text-xs">No viewers yet</p>}
                                    {viewers.map((name, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" style={{ boxShadow: '0 0 4px #22c55e' }} />
                                            <span className={name === currentUser?.username ? 'text-red-400 font-bold' : 'text-white/60'}>{name}</span>
                                            {name === currentUser?.username && <span className="text-[8px] bg-red-500/15 text-red-400 px-1 rounded uppercase font-jet">You</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ Mode Toggle ═══ */}
                <div className="max-w-[1920px] mx-auto flex justify-center mt-8 pt-4 mb-2 relative z-20">
                    <div className="relative flex bg-white/[0.04] backdrop-blur-3xl rounded-full p-0.5 border border-white/[0.08]">
                        {['setup', 'broadcast'].map(mode => (
                            <button key={mode} onClick={() => { if (mode === 'broadcast' && !isLive) return; setStudioMode(mode); }}
                                className={`relative z-10 px-4 py-1.5 text-[10px] font-jet font-bold tracking-[0.2em] uppercase transition-colors duration-300 rounded-full ${studioMode === mode ? 'text-white' : mode === 'broadcast' && !isLive ? 'text-white/10 cursor-not-allowed' : 'text-white/30 hover:text-white/50'
                                    }`}>
                                {mode === 'setup' ? '⚙️ Setup' : '📡 Broadcast'}
                            </button>
                        ))}
                        <motion.div layoutId="modeIndicator" className="absolute inset-y-1 rounded-full neon-panel"
                            style={{ width: '50%', left: studioMode === 'setup' ? '0%' : '50%' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                    </div>
                </div>
                <AnimatePresence mode="wait">
                    {studioMode === 'setup' ? (
                        <motion.div key="setup" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }} className="max-w-[1920px] mx-auto">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-2">
                                {/* Left Column: Preview Monitor (Compact) */}
                                <div className="lg:col-span-4 flex flex-col gap-4 max-w-md">
                                    <div className="bg-white/[0.03] backdrop-blur-3xl neon-panel rounded-2xl p-4 flex flex-col gap-3">
                                        <h2 className="text-[10px] font-bold neon-text uppercase tracking-[0.2em] border-b border-white/10 pb-2">Feed Preview</h2>
                                        <div className="w-full aspect-video bg-black/60 rounded-xl overflow-hidden relative border border-white/10 flex items-center justify-center shadow-2xl">
                                            {showTestCamera ? (
                                                <video ref={testVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex flex-col items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                                        <span className="text-white/20 text-2xl">📷</span>
                                                    </div>
                                                    <span className="text-[9px] font-jet uppercase tracking-widest text-white/30">Camera Standby</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button onClick={() => setShowTestCamera(!showTestCamera)}
                                                className={`w-full py-3 rounded-xl text-[10px] font-jet uppercase tracking-widest font-bold transition-all border ${showTestCamera ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60'}`}>
                                                {showTestCamera ? 'Stop Preview' : 'Start Preview Monitor'}
                                            </button>

                                            <motion.button
                                                whileHover={canStartBroadcast ? { scale: 1.02 } : {}}
                                                whileTap={canStartBroadcast ? { scale: 0.98 } : {}}
                                                onClick={() => {
                                                    if (!canStartBroadcast) {
                                                        toast.error("Please complete the checklist first.");
                                                        return;
                                                    }
                                                    handleUpdateMetadata();
                                                    setStudioMode('broadcast');
                                                    initPlayer();
                                                }}
                                                className={`w-full py-4 rounded-xl text-xs font-black tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 ${canStartBroadcast ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30' : 'bg-white/[0.02] text-white/10 border border-white/5 cursor-not-allowed'}`}
                                            >
                                                READY TO GO LIVE 🚀
                                            </motion.button>
                                        </div>
                                    </div>

                                    {/* Pre-Flight Checklist (Inlined) */}
                                    <div className="bg-white/[0.03] backdrop-blur-3xl neon-panel rounded-2xl p-5 flex flex-col gap-3">
                                        <h2 className="text-[10px] font-bold neon-text uppercase tracking-[0.2em] border-b border-white/10 pb-2">Pre-Flight Checklist</h2>
                                        <div className="space-y-2">
                                            {[
                                                { label: 'Title & Meta', checked: streamTitle.trim().length > 0 },
                                                { label: 'Description', checked: streamDescription.trim().length > 0 },
                                                { label: 'Camera Link', checked: isCameraReady },
                                                { label: 'Audio Signal', checked: isMicReady },
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${item.checked ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-white/5 border-white/20 text-white/20'}`}>
                                                        {item.checked ? <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg> : <span className="text-[8px] font-bold">!</span>}
                                                    </div>
                                                    <span className={`text-[11px] ${item.checked ? 'text-white/80' : 'text-white/40'}`}>{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Configuration & Setup */}
                                <div className="lg:col-span-8 flex flex-col gap-4">
                                    <div className="bg-white/[0.03] backdrop-blur-3xl neon-panel rounded-2xl p-6 flex flex-col gap-5">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-1">Stream Title</label>
                                                    <input type="text" value={streamTitle} onChange={(e) => setStreamTitle(e.target.value)} placeholder="Catchy title..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 outline-none focus:border-red-500/50 transition-colors neon-input" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-1">Stream Description</label>
                                                    <textarea value={streamDescription} onChange={(e) => setStreamDescription(e.target.value)} placeholder="What's happening?" rows={2} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 outline-none focus:border-red-500/50 transition-colors neon-input resize-none" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-1">Stream Category</label>
                                                    <select value={streamCategory} onChange={(e) => setStreamCategory(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/90 outline-none focus:border-red-500/50 transition-colors cursor-pointer neon-input appearance-none">
                                                        {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0f0f0f]">{c}</option>)}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-2">Thumbnail</label>
                                                    <div onClick={() => !isUploadingThumb && thumbInputRef.current?.click()} className="w-full h-[155px] border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-red-500/30 transition-all group relative overflow-hidden bg-black/40 shadow-inner">
                                                        <input type="file" ref={thumbInputRef} accept="image/*" className="hidden" onChange={handleUploadThumbnail} />
                                                        {currentUser?.stream_thumbnail && currentUser.stream_thumbnail !== 'null' ? (
                                                            <img src={currentUser.stream_thumbnail} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover transition-opacity group-hover:opacity-40" />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 opacity-20 group-hover:opacity-50 transition-all pointer-events-none">
                                                                <svg className="w-12 h-12 text-white/40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                </svg>
                                                                <span className="text-[8px] font-jet uppercase tracking-widest">Static Placeholder</span>
                                                            </div>
                                                        )}
                                                        <div className="relative z-10 flex flex-col items-center gap-1 pointer-events-none">
                                                            {isUploadingThumb ? (
                                                                <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <span className="text-[9px] font-jet text-white/20 group-hover:text-white transition-colors uppercase tracking-widest">{currentUser?.stream_thumbnail ? 'Change Image' : 'Click to Upload'}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ══ Stream Key & RTMP URL Panel ══ */}
                                        <div className="pt-2 border-t border-white/5">
                                            <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                                                <h3 className="text-[10px] font-bold neon-text uppercase tracking-[0.2em] flex items-center gap-2">
                                                    <span>🔑</span> STREAM KEY & URL
                                                </h3>

                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-1">RTMP Server URL</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type="text" readOnly value={`rtmp://${window.location.hostname}:1935/live`} className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-white/70 font-jet outline-none" />
                                                            <button onClick={() => { navigator.clipboard.writeText(`rtmp://${window.location.hostname}:1935/live`).then(() => toast.success("RTMP URL copied!", { style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } })) }} className="px-3 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-white/60 transition-colors">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-1">Stream Key</label>
                                                        <div className="flex items-center gap-2">
                                                            <input type={showKey ? "text" : "password"} readOnly value={streamKey || ''} placeholder="Loading key..." className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-emerald-400 font-jet outline-none" />
                                                            <button onClick={() => setShowKey(!showKey)} className="px-3 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-white/60 transition-colors">
                                                                {showKey ? (
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.053-3.064c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" /></svg>
                                                                ) : (
                                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                                )}
                                                            </button>
                                                            <button onClick={() => { navigator.clipboard.writeText(streamKey || '').then(() => toast.success("Stream key copied! Keep it secret.", { icon: '🔐', style: { background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } })) }} className="px-3 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-white/60 transition-colors">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                            </button>
                                                        </div>
                                                        <div className="mt-3 flex justify-end">
                                                            <button onClick={() => setShowRegenerateModal(true)} disabled={isLoadingKey} className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/25 rounded-md text-[9px] font-jet uppercase tracking-widest text-red-500 transition-colors flex items-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.1)]">
                                                                {isLoadingKey ? <span className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin inline-block" /> : <span>⚠️</span>}
                                                                Regenerate Key
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ══ Studio Background Controls (Horizontal Alignment Enforcement) ══ */}
                                        <div className="pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-6 bg-black/20 p-3 rounded-xl border border-white/5">
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="text-[10px] font-jet text-white/30 uppercase tracking-[0.2em]">Studio BG</span>
                                                    <button onClick={() => setShowBackgroundModal(true)} className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-lg text-[9px] font-jet uppercase tracking-widest transition-all">Library</button>
                                                </div>
                                                <div className="flex-1 flex items-center gap-4 px-2">
                                                    <input type="range" min="0" max="0.8" step="0.01" value={overlayOpacity} onChange={(e) => { const v = parseFloat(e.target.value); setOverlayOpacity(v); localStorage.setItem('studio_bg_darkness', v); }} className="flex-1 accent-cyan-500 bg-white/5 h-1 rounded-full appearance-none outline-none cursor-pointer" />
                                                    <span className="text-[10px] font-jet text-cyan-400 font-bold w-10 text-right">{Math.round((0.8 - overlayOpacity) * 125)}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ══ Discord-Style Microphone Test Panel ══ */}
                                        <div className="pt-2 border-t border-white/5">
                                            <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex flex-col gap-4">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-[10px] font-bold neon-text uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <span>🎙️</span> MICROPHONE TEST
                                                    </h3>
                                                    <button onClick={toggleMicTest} className={`px-3 py-1.5 border rounded-lg text-[9px] font-jet uppercase tracking-widest transition-all ${isMicTestRunning ? 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30' : 'bg-white/5 hover:bg-emerald-500/20 text-white/60 hover:text-emerald-400 border-white/10 hover:border-emerald-500/50'}`}>
                                                        {isMicTestRunning ? 'Stop Test' : 'Start Test'}
                                                    </button>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-[9px] uppercase tracking-[0.2em] text-white/40 font-jet ml-1 block mb-1.5">Input Device</label>
                                                        <select value={audioInputId} onChange={(e) => setAudioInputId(e.target.value)} disabled={isMicTestRunning} className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 outline-none cursor-pointer disabled:opacity-50">
                                                            {audioDevices.length > 0 ? (
                                                                audioDevices.map(device => (
                                                                    <option key={device.deviceId} value={device.deviceId} className="bg-[#0f0f0f]">
                                                                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}...`}
                                                                    </option>
                                                                ))
                                                            ) : (
                                                                <option value="" className="bg-[#0f0f0f]">Default Microphone</option>
                                                            )}
                                                        </select>
                                                    </div>

                                                    <div className="flex flex-col justify-end pb-1 gap-2">
                                                        <div className="flex items-center justify-between text-[8px] font-jet text-white/30 uppercase tracking-widest px-1">
                                                            <span>Input Sensitivity</span>
                                                            <span>{micSensitivity}%</span>
                                                        </div>
                                                        <input type="range" min="0" max="200" value={micSensitivity} onChange={(e) => {
                                                            const val = Number(e.target.value);
                                                            setMicSensitivity(val);
                                                            if (gainNodeRef.current) {
                                                                gainNodeRef.current.gain.value = val / 100;
                                                            }
                                                        }} className="w-full accent-emerald-500 bg-white/5 h-1 rounded-full appearance-none outline-none cursor-pointer" />
                                                    </div>
                                                </div>

                                                {/* VU Meter Visualizer */}
                                                <div className="w-full h-2 bg-black/60 border border-white/5 rounded-full overflow-hidden mt-1 relative flex">
                                                    <div className="h-full absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-500 via-yellow-400 to-red-500 shadow-[0_0_10px_#22c55e] transition-all duration-75 ease-out" style={{ width: `${micVolumeLevel}%` }} />

                                                    {/* Peak Indicator Marker */}
                                                    <div className="absolute top-0 bottom-0 left-[75%] w-[1px] bg-red-500/50 z-10" />
                                                    <div className="absolute top-0 bottom-0 left-[90%] w-[1px] bg-red-500/80 z-10" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Temporary Test Camera Modal */}
                                    {showTestCamera && (
                                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
                                            <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col items-center">
                                                <h3 className="text-sm font-bold mb-4 text-white/80 uppercase tracking-widest font-jet border-b border-white/10 w-full text-center pb-2">Camera Test</h3>
                                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden mb-4 border border-white/5 relative flex items-center justify-center">
                                                    {videoDevices.length > 0 ? (
                                                        <video ref={testVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                                                    ) : (
                                                        <span className="text-white/30 text-xs uppercase tracking-widest font-jet">No camera detected</span>
                                                    )}
                                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] font-jet text-white/70">
                                                        {videoDevices.find(d => d.deviceId === videoInputId)?.label || 'Test Preview'}
                                                    </div>
                                                </div>
                                                <button onClick={() => setShowTestCamera(false)} className="px-8 py-3 bg-red-500/20 text-red-400 border border-red-500/50 rounded-xl font-bold uppercase tracking-widest hover:bg-red-500/30 transition-colors">Close Test</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div key="broadcast" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="flex w-full h-full max-w-[1920px] mx-auto gap-5 mt-4">
                            {/* Center Column: Main Preview & controls */}
                            <div className="flex-1 flex flex-col gap-5">

                                {/* Dashboard Stats Row */}
                                <div className="grid grid-cols-5 gap-3 shrink-0">
                                    {[
                                        { label: 'Current Viewers', value: viewerCount, icon: '👁️', color: 'text-emerald-400' },
                                        { label: 'Peak Viewers', value: peakViewers, icon: '📈', color: 'text-cyan-400' },
                                        { label: 'Total Watch Time', value: formatWatchTime(totalWatchTime), icon: '⏱️', color: 'text-purple-400' },
                                        { label: 'New Subs', value: newSubscribersCount, icon: '⭐', color: 'text-yellow-400' },
                                        { label: 'Chat Rate (msg/m)', value: messageRate, icon: '💬', color: 'text-pink-400' },
                                    ].map((stat, i) => (
                                        <div key={i} className="bg-white/[0.03] backdrop-blur-3xl neon-panel rounded-xl p-4 flex flex-col gap-1 border border-white/5 transition-all hover:bg-white/[0.05]">
                                            <div className="flex items-center gap-2 text-white/40 text-[10px] uppercase font-jet tracking-widest">
                                                <span>{stat.icon}</span> {stat.label}
                                            </div>
                                            <div className={`text-xl font-bold font-jet ${stat.color}`} style={{ textShadow: `0 0 10px currentColor` }}>
                                                {stat.value}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Main Video View */}
                                <div className="w-full max-w-4xl mx-auto aspect-video bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center neon-panel shadow-2xl shrink-0 border border-white/10 group">
                                    <video ref={videoRef} autoPlay muted className="w-full h-full object-contain block" />

                                    {!isLive && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]/95 z-40">
                                            <div className="relative mb-5 mt-[-20px]">
                                                <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-0 bg-red-500/10 blur-3xl rounded-full scale-150" />
                                                <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 text-white/10 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.8} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            </div>
                                            <p className="text-white/30 font-jet font-bold tracking-[0.4em] uppercase mb-6 text-xs text-center">
                                                {signalDetected ? 'Signal Detected. Ready to cut live.' : 'Awaiting Video Signal'}
                                            </p>
                                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} onClick={initPlayer} disabled={isConnecting} className={`relative z-50 px-10 py-4 rounded-xl text-sm font-black tracking-[0.2em] uppercase transition-all overflow-hidden ${isConnecting ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5' : 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30'}`} style={!isConnecting ? { textShadow: '0 0 15px rgba(239,68,68,0.5)', boxShadow: '0 0 20px rgba(239,68,68,0.2)' } : {}}>
                                                {isConnecting ? 'CONNECTING...' : 'FORCE REFRESH FEED'}
                                            </motion.button>
                                        </div>
                                    )}

                                    {/* Broadcast Top HUD Overlay */}
                                    <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none bg-gradient-to-b from-black/80 to-transparent z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                        <div className={`px-3 py-1.5 flex items-center gap-2 rounded-lg text-[10px] font-jet font-bold tracking-[0.25em] uppercase border backdrop-blur-xl ${isLive ? 'bg-red-500/20 text-red-400 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-black/60 text-white/40 border-white/10'}`}>
                                            {isLive && <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />}
                                            {!isLive && <span className="w-2 h-2 rounded-full bg-white/20 inline-block" />}
                                            {isLive ? 'ON AIR' : 'OFFLINE'}
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg backdrop-blur-md flex items-center gap-2 font-jet text-[10px] text-white/70 tracking-widest">
                                                ⏱ <span className="font-bold">{formatUptime(uptime)}</span>
                                            </div>
                                            <div className="px-3 py-1.5 bg-black/60 border border-white/10 rounded-lg backdrop-blur-md flex items-center gap-2 font-jet text-[10px] text-white/70 tracking-widest">
                                                📡 <span className="font-bold text-cyan-400">{streamStats.bitrate} kbps</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Simplified Action Bar */}
                                <div className="bg-white/[0.03] backdrop-blur-3xl neon-panel rounded-2xl p-4 grid grid-cols-3 items-center border border-white/5 shrink-0">
                                    {/* Left Alignment: Live Indicator */}
                                    <div className="flex justify-start">
                                        <div className={`px-4 py-2 flex items-center gap-2 rounded-lg text-xs font-jet font-bold tracking-[0.2em] uppercase border backdrop-blur-xl ${isLive ? 'bg-red-500/10 text-red-500 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-black/40 text-white/30 border-white/10'}`}>
                                            {isLive && <motion.span animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />}
                                            {!isLive && <span className="w-2.5 h-2.5 rounded-full bg-white/20 inline-block" />}
                                            {isLive ? 'BROADCASTING' : 'OFFLINE'}
                                        </div>
                                    </div>

                                    {/* Center Alignment: Action Controls */}
                                    <div className="flex gap-4 justify-center">
                                        <button onClick={() => setShowPollModal(true)} disabled={!isLive} className={`px-6 py-3 rounded-xl border border-fuchsia-500/30 text-fuchsia-400 text-xs font-jet uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(217,70,239,0.1)] flex items-center gap-2 ${isLive ? 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20' : 'bg-black/40 opacity-30 cursor-not-allowed'}`}>
                                            📊 Start Poll
                                        </button>
                                        <button onClick={() => copyToClipboard(`https://utube.test/live/${currentUser?.username}`)} className="px-6 py-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-jet uppercase tracking-widest transition-all shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                                            🔗 Share Link
                                        </button>
                                        <motion.button
                                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                            onClick={() => setShowStopModal(true)}
                                            className="px-8 py-3 rounded-xl border border-red-500 bg-red-500/20 hover:bg-red-500/40 text-red-500 font-black text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-2"
                                            disabled={!isLive}
                                            style={!isLive ? { opacity: 0.3, cursor: 'not-allowed', filter: 'grayscale(1)' } : {}}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                            </svg>
                                            Stop Broadcasting
                                        </motion.button>
                                    </div>

                                    {/* Right Alignment: Spacer */}
                                    <div className="flex justify-end"></div>
                                </div>
                            </div>

                            {/* Right Column: Chat UI */}
                            <div className="w-[380px] flex flex-col bg-white/[0.03] backdrop-blur-3xl neon-panel rounded-2xl shadow-xl h-[calc(100vh-140px)] max-h-[85vh] overflow-hidden shrink-0">
                                <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0 bg-black/20">
                                    <h2 className="text-sm font-bold neon-text uppercase tracking-widest">Live Chat</h2>
                                    <span className={`flex items-center gap-1.5 text-[9px] font-jet ${wsStatus === 'connected' ? 'text-emerald-400' : 'text-yellow-400'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#22c55e]' : 'bg-yellow-500 animate-pulse shadow-[0_0_8px_#eab308]'}`} />
                                        {wsStatus === 'connected' ? 'ONLINE' : 'CONNECTING...'}
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/10 relative" onScroll={handleChatScroll}>
                                    {chatMessages.length === 0 && <p className="text-white/10 text-[11px] text-center py-8 font-jet">Silence in the chat...</p>}
                                    {chatMessages.map((msg, idx) => (
                                        <div key={msg.id || idx} className="text-[12px] leading-relaxed group flex items-start justify-between gap-1">
                                            <div>
                                                <span className="inline-flex items-center gap-1 mr-1.5">
                                                    {msg.isMod && <span className="text-[8px] bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20 px-1 rounded font-jet uppercase tracking-wider" style={{ textShadow: '0 0 6px #22c55e60' }}>Mod</span>}
                                                    <span className={msg.isMod ? 'text-emerald-400 font-semibold' : 'text-cyan-400/70 font-medium'} style={msg.isMod ? { textShadow: '0 0 8px #22c55e40' } : { textShadow: '0 0 6px #06b6d430' }}>{msg.user}</span>
                                                </span>
                                                <span className="text-white/80">{msg.text}</span>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />

                                    {/* Unread Messages Badge */}
                                    <AnimatePresence>
                                        {isUserScrolling && unreadCount > 0 && (
                                            <motion.button
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 10 }}
                                                onClick={() => {
                                                    setIsUserScrolling(false);
                                                    setUnreadCount(0);
                                                    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                                }}
                                                className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-[#0a0a0a]/90 backdrop-blur-md border border-cyan-500/50 rounded-full text-[10px] font-jet font-bold text-cyan-400 tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:bg-[#0a0a0a] transition-all z-20"
                                            >
                                                👇 {unreadCount} New Message{unreadCount !== 1 ? 's' : ''}
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="p-3 bg-white/[0.02] border-t border-white/5 shrink-0 bg-black/40">
                                    <form onSubmit={handleSendChat} className="flex gap-2">
                                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                                            placeholder={wsStatus !== 'connected' ? 'Connecting...' : (!isLive ? 'Chat is offline...' : 'Type a message...')}
                                            disabled={wsStatus !== 'connected' || !isLive}
                                            className="flex-1 bg-white/[0.05] border border-white/[0.1] rounded-lg px-4 py-3 text-xs text-white/90 outline-none transition-all disabled:opacity-20 font-jet placeholder:text-white/30 focus:border-cyan-500/50" />
                                        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit"
                                            disabled={wsStatus !== 'connected' || !chatInput.trim() || !isLive}
                                            className="px-5 py-3 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs font-jet font-bold tracking-widest uppercase disabled:opacity-20 cursor-pointer hover:bg-cyan-500/30 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                                            Send
                                        </motion.button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ Poll Modal ═══ */}
                <AnimatePresence>
                    {showPollModal && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                                <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-white/80"><span>📊</span> CREATE LIVE POLL</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-jet ml-1">Question</label>
                                        <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="What should I play next?" autoFocus
                                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/70 outline-none focus:border-red-500/30 mt-1" />
                                    </div>
                                    {pollOptions.map((opt, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between items-center ml-1">
                                                <label className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-jet">Option {i + 1}</label>
                                                {i >= 2 && (
                                                    <button type="button" onClick={() => setPollOptions(prev => prev.filter((_, idx) => idx !== i))} className="text-[9px] text-red-500/70 hover:text-red-500 font-jet tracking-wider uppercase">Remove</button>
                                                )}
                                            </div>
                                            <input type="text" value={opt} onChange={(e) => {
                                                const newOpts = [...pollOptions];
                                                newOpts[i] = e.target.value;
                                                setPollOptions(newOpts);
                                            }} placeholder={`Option ${i + 1}`}
                                                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/70 outline-none focus:border-red-500/30 mt-1" />
                                        </div>
                                    ))}
                                    {pollOptions.length < 4 && (
                                        <button type="button" onClick={() => setPollOptions(prev => [...prev, ''])} className="w-full py-2 bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] border-dashed rounded-lg text-[10px] text-white/40 font-jet tracking-widest uppercase transition-colors mt-2">
                                            + Add Option
                                        </button>
                                    )}
                                    <div>
                                        <label className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-jet ml-1">Duration (Seconds)</label>
                                        <input type="number" min="10" max="300" value={pollDuration} onChange={(e) => setPollDuration(Number(e.target.value) || 60)} placeholder="60"
                                            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white/70 outline-none focus:border-red-500/30 mt-1" />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-5">
                                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setShowPollModal(false)}
                                        className="flex-1 py-2.5 bg-white/5 text-white/40 rounded-lg text-[10px] font-jet font-bold tracking-[0.15em] uppercase">CANCEL</motion.button>
                                    <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleStartPoll}
                                        className="flex-1 py-2.5 bg-white/5 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-jet font-bold tracking-[0.15em] uppercase"
                                        style={{ textShadow: '0 0 10px rgba(239,68,68,0.4)' }}>LAUNCH POLL</motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ═══ Active Poll HUD ═══ */}
                <AnimatePresence>
                    {isLive && activePoll && pollPhase === 'active' && (
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                            className="fixed bottom-6 left-6 z-[90] bg-[#0a0a0a]/95 border border-white/10 rounded-2xl p-4 w-80 shadow-2xl backdrop-blur-3xl">
                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                <span className={`text-[9px] font-jet font-bold uppercase tracking-[0.2em] ${pollPhase === 'results' ? 'text-yellow-400' : 'text-red-400'}`} style={pollPhase === 'results' ? { textShadow: '0 0 8px rgba(250,204,21,0.3)' } : { textShadow: '0 0 8px rgba(239,68,68,0.3)' }}>
                                    {pollPhase === 'results' ? '🏆 Poll Results' : '📊 Live Poll'}
                                </span>
                                <div className="flex items-center gap-3">
                                    {pollPhase === 'active' && (
                                        <span className={`text-[10px] font-jet font-bold ${pollTimeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-white/60'}`}>
                                            ⏱️ {formatPollTime(pollTimeLeft)}
                                        </span>
                                    )}
                                    <span className="text-[9px] text-white/20 font-jet">{activePoll.total || 0} votes</span>
                                </div>
                            </div>
                            <p className="text-xs font-bold text-white/70 mb-3">{activePoll.question}</p>
                            <div className="space-y-2">
                                {(() => {
                                    // Calculate total votes safely
                                    const totalVotes = activePoll.options?.reduce((sum, opt) => {
                                        const v = typeof opt === 'object' ? (opt.votes || 0) : (activePoll.votes?.[opt] || 0);
                                        return sum + v;
                                    }, 0) || 0;

                                    // Calculate winner for results phase
                                    let maxVotes = -1;
                                    let winningOption = null;
                                    if (pollPhase === 'results') {
                                        activePoll.options?.forEach(opt => {
                                            const v = typeof opt === 'object' ? (opt.votes || 0) : (activePoll.votes?.[opt] || 0);
                                            if (v > maxVotes) { maxVotes = v; winningOption = opt; }
                                        });
                                    }

                                    return activePoll.options?.map((opt, i) => {
                                        const optName = typeof opt === 'object' ? opt.name : opt;
                                        const votes = typeof opt === 'object' ? (opt.votes || 0) : (activePoll.votes?.[opt] || 0);

                                        // Safely calculate percentage
                                        const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                        const isWinner = pollPhase === 'results' && opt === winningOption && votes > 0;

                                        return (
                                            <div key={optName || i} className={`relative rounded-lg overflow-hidden border ${isWinner ? 'border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'bg-white/[0.03] border-white/[0.04]'}`}>
                                                <div
                                                    className={`absolute top-0 left-0 h-full transition-all duration-500 ease-out rounded ${isWinner ? 'bg-yellow-500/20' : 'bg-emerald-500/30'}`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                                <div className="relative flex justify-between items-center px-3 py-2 z-10">
                                                    <span className={`text-[11px] font-bold flex items-center gap-1.5 ${isWinner ? 'text-yellow-400' : 'text-white/70'}`}>
                                                        {isWinner && <span className="mr-1 text-[9px] uppercase tracking-wider">👑 Winner</span>}
                                                        {optName}
                                                    </span>
                                                    <span className={`text-[10px] font-jet ${isWinner ? 'text-yellow-400' : 'text-white/30'}`}>{pct}%</span>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            {/* Close Results Button */}
                            {pollPhase === 'results' && (
                                <button
                                    onClick={() => {
                                        setActivePoll(null);
                                        setPollPhase('none');
                                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                                            wsRef.current.send(JSON.stringify({ type: 'command', action: 'poll_end' }));
                                        }
                                    }}
                                    className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-jet uppercase tracking-widest text-white/50 hover:text-white transition-all">
                                    Close Results
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Background Library Modal Drop-in */}
                <BackgroundGalleryModal
                    isOpen={showBackgroundModal}
                    onClose={() => setShowBackgroundModal(false)}
                    activeBgUrl={activeBgUrl}
                    onBackgroundSelect={handleSelectBackground}
                    getBgUrl={getBgUrl}
                    customBackgrounds={customBackgrounds}
                    setCustomBackgrounds={setCustomBackgrounds}
                />

                {/* Unified Regenerate Key & Stop Broadcast Modal */}
                <AnimatePresence>
                    {(showRegenerateModal || showStopModal) && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
                            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                                className="bg-[#0a0a0a] border border-red-500/20 rounded-2xl p-6 w-full max-w-md shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                                <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-red-500 font-jet tracking-widest uppercase">
                                    <span>⚠️</span> {showStopModal ? 'END BROADCAST' : 'WARNING'}
                                </h3>
                                <p className="text-white/70 text-sm mb-6 leading-relaxed">
                                    {showStopModal
                                        ? "Are you sure you want to end your stream? This will disconnect viewers immediately."
                                        : "Are you sure? This will disconnect any active streams immediately and permanently invalidate your current stream key. You will need to update OBS with the new key."}
                                </p>
                                <div className="flex gap-3">
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowRegenerateModal(false); setShowStopModal(false); }}
                                        className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white/60 rounded-lg text-[10px] font-jet font-bold tracking-[0.15em] uppercase transition-colors">
                                        Cancel
                                    </motion.button>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => {
                                        if (showRegenerateModal) {
                                            handleRegenerateKey();
                                        } else if (showStopModal) {
                                            if (flvPlayerRef.current) {
                                                try { flvPlayerRef.current.unload(); flvPlayerRef.current.detachMediaElement(); flvPlayerRef.current.destroy(); } catch (e) { } flvPlayerRef.current = null;
                                            }
                                            setIsLive(false);
                                            setIsConnecting(false);
                                            setStudioMode('setup');
                                            setShowStopModal(false);
                                            setChatMessages([]);
                                            setActivePoll(null); // ERADICATE GHOST POLLS
                                            setPollPhase('none');
                                            setShowPollModal(false);
                                            toast.success("Broadcast Stopped");
                                        }
                                    }}
                                        className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-500 rounded-lg text-[10px] font-jet font-bold tracking-[0.15em] uppercase transition-colors shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                                        {showStopModal ? 'Confirm Stop' : 'Confirm Regenerate'}
                                    </motion.button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
        </div>
    );
};

export default LiveStudio;
