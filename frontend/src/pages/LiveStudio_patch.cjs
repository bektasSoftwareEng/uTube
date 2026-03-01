const fs = require('fs');
const file = 'c:\\\\Users\\\\smila\\\\Desktop\\\\Project github\\\\uTube\\\\frontend\\\\src\\\\pages\\\\LiveStudio.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /const \[streamTitle, setStreamTitle\] = useState\(''\);\s*const \[streamCategory, setStreamCategory\] = useState\('Gaming'\);/,
    `const [streamTitle, setStreamTitle] = useState('');
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
    const [peakViewers, setPeakViewers] = useState(0);
    const [totalWatchTime, setTotalWatchTime] = useState(0);
    const [newSubscribersCount, setNewSubscribersCount] = useState(0);
    const [messageRate, setMessageRate] = useState(0);`
);

content = content.replace(
    /case 'activity': setActivities\(prev => \[msg, \.\.\.prev\]\.slice\(0, 50\)\); break;/,
    `case 'activity': 
        setActivities(prev => [msg, ...prev].slice(0, 50)); 
        if (msg.activity_type === 'subscribe') setNewSubscribersCount(p => p + 1);
        break;`
);

content = content.replace(
    /\/\/ ════════════════════════════════════════════════════════════════════════\r?\n\s*\/\/ FLV PLAYER — Preview with Auto-Retry/,
    `// ── Device Enumeration ────────────────────────────────────────────────
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
    // FLV PLAYER — Preview with Auto-Retry`
);

const modeToggleIndex = content.indexOf('{/* ═══ Mode Toggle ═══ */}');
const modeToggleEnd = content.indexOf('</div>', content.indexOf('</div>', modeToggleIndex) + 1) + 6;
const pollModalIndex = content.indexOf('{/* ═══ Poll Modal ═══ */}');

const beforeRender = content.substring(0, modeToggleEnd);
const afterRender = content.substring(pollModalIndex);
const newRender = fs.readFileSync('c:\\\\Users\\\\smila\\\\Desktop\\\\Project github\\\\uTube\\\\frontend\\\\src\\\\pages\\\\LiveStudio_newRender.txt', 'utf8');

content = beforeRender + "\\n\\n" + newRender + "\\n\\n                " + afterRender;

fs.writeFileSync(file, content);
console.log("Refactor complete.");
