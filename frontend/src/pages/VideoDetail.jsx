import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { VideoCard } from '../components/VideoGrid';
import { getValidUrl, getAvatarUrl, THUMBNAIL_FALLBACK, AVATAR_FALLBACK, VIDEO_FALLBACK } from '../utils/urlHelper';
import { UTUBE_USER } from '../utils/authConstants';



const SidebarSkeleton = () => (
    <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-32 xl:w-40 aspect-video bg-white/5 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-white/5 rounded w-full" />
                    <div className="h-2 bg-white/5 rounded w-2/3" />
                </div>
            </div>
        ))}
    </div>
);

const VideoDetail = () => {
    const { id } = useParams();
    const [video, setVideo] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [recLoading, setRecLoading] = useState(false);

    const viewTracked = useRef(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subLoading, setSubLoading] = useState(false);

    useEffect(() => {
        const fetchVideoData = async () => {
            setLoading(true);
            setRecLoading(true); // Reset sidebar state
            try {
                // Fetch main video data
                const videoResponse = await ApiClient.get(`/videos/${id}`);
                const videoData = videoResponse.data;
                setVideo(videoData);
                setLoading(false); // Show main content as soon as it's ready

                // Task 1 & 2: Explicit View Tracking (Senior Requirements)
                // Use Ref Guard to prevent StrictMode double-triggers
                if (!viewTracked.current) {
                    viewTracked.current = true;
                    incrementView(id);
                }

                // Fetch hybrid recommendations (80/20 split)
                const recResponse = await ApiClient.get('/feed/recommended', {
                    params: {
                        author_id: videoData.author?.id,
                        category: videoData.category,
                        exclude_id: id,
                        limit: 10
                    }
                });

                // Task 3: Robust Sidebar Filtering
                const validRecs = recResponse.data.filter(v =>
                    v.status === 'published' &&
                    v.visibility === 'public' &&
                    !v.is_processing // Double check flag if exists
                );

                setRecommendations(validRecs);
            } catch (error) {
                console.error('Failed to fetch video details:', error);
                setFetchError(error.message + (error.response ? ` (Status: ${error.response.status})` : ''));
            } finally {
                setLoading(false);
                setRecLoading(false);
            }
        };

        const incrementView = async (videoId) => {
            try {
                // Task 2: Silent Failure
                await ApiClient.post(`/videos/${videoId}/view`);
                // Task 1: Seamless UI Sync
                setVideo(prev => ({
                    ...prev,
                    view_count: (prev?.view_count || 0) + 1
                }));
            } catch (err) {
                // Fail silently as per Senior Requirement
                console.warn('View tracking failed silently:', err);
            }
        };

        fetchVideoData();
        window.scrollTo(0, 0);

        // Reset tracking on ID change
        return () => {
            viewTracked.current = false;
        };
    }, [id]);

    useEffect(() => {
        const checkSubscription = async () => {
            const userStr = localStorage.getItem(UTUBE_USER);
            if (!userStr || !video?.author) return;

            try {
                // Optimization: In a real app, use a specific endpoint like /auth/is_subscribed/{id}
                // For now, we reuse the list endpoint as per plan
                const response = await ApiClient.get('/auth/subscriptions');
                const subs = response.data;
                const isSub = subs.some(sub => sub.id === video.author.id);
                setIsSubscribed(isSub);
            } catch (error) {
                console.error("Failed to check subscription:", error);
            }
        };

        if (video) {
            checkSubscription();
        }
    }, [video]);

    const handleSubscribe = async () => {
        const userStr = localStorage.getItem(UTUBE_USER);
        if (!userStr) {
            alert("Please sign in to subscribe");
            return;
        }
        if (!video?.author) return;

        setSubLoading(true);
        try {
            if (isSubscribed) {
                await ApiClient.delete(`/auth/subscribe/${video.author.id}`);
                setIsSubscribed(false);
            } else {
                await ApiClient.post(`/auth/subscribe/${video.author.id}`);
                setIsSubscribed(true);
            }
        } catch (error) {
            console.error("Subscription action failed:", error);
            if (error.response?.data?.detail === "Already subscribed") {
                setIsSubscribed(true);
            }
        } finally {
            setSubLoading(false);
        }
    };

    if (loading && !video) {
        return (
            <div className="pt-24 px-4 md:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                    <div className="aspect-video bg-surface rounded-2xl animate-pulse mb-6" />
                    <div className="h-8 bg-surface rounded w-3/4 animate-pulse mb-4" />
                    <div className="h-4 bg-surface rounded w-1/4 animate-pulse mb-8" />
                </div>
                <div className="lg:w-80 xl:w-96">
                    <SidebarSkeleton />
                </div>
            </div>
        );
    }

    if (!video) return (
        <div className="pt-24 text-center">
            <h1 className="text-2xl font-bold mb-4">Video not found</h1>
            <p className="text-white/50 mb-2">Requested ID: {id}</p>
            {fetchError && <p className="text-red-500 font-mono text-sm bg-black/50 inline-block px-4 py-2 rounded">{fetchError}</p>}
        </div>
    );

    // Rotating Fallback Strategy to demonstrate dynamic playback
    const EVEN_FALLBACK = "https://vjs.zencdn.net/v/oceans.mp4";
    const ODD_FALLBACK = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";
    const DYNAMIC_FALLBACK = (parseInt(id) % 2 === 0) ? EVEN_FALLBACK : ODD_FALLBACK;

    // Fail-Safe Playback: Priority to real backend URL, fallback to rotating test clips
    const videoSrc = (video.video_url && video.video_url !== "" && !video.video_url.includes('synthetic'))
        ? getValidUrl(video.video_url, DYNAMIC_FALLBACK)
        : DYNAMIC_FALLBACK;



    return (
        <motion.div
            key={id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-24 pb-12 px-4 md:px-8 max-w-[1700px] mx-auto"
        >

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Content (75% Width) */}
                <div className="lg:col-span-3">
                    {/* Video Player */}
                    <div className="aspect-video w-full bg-black rounded-2xl overflow-hidden shadow-2xl mb-6 ring-1 ring-white/10">
                        <video
                            key={id}
                            controls
                            autoPlay
                            crossOrigin="anonymous"
                            className="w-full h-full"
                            poster={getValidUrl(video.thumbnail_url, THUMBNAIL_FALLBACK)}
                            onError={(e) => {
                                // If the primary source fails, try the rotating fallback clip
                                if (e.target.src !== DYNAMIC_FALLBACK) {
                                    e.target.src = DYNAMIC_FALLBACK;
                                }
                            }}

                        >
                            <source src={videoSrc} type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>

                    </div>

                    {/* Video Info */}
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">{video.title}</h1>
                    <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-white/10 mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-surface">
                                <img
                                    src={getAvatarUrl(video.author?.profile_image, video.author?.username)}
                                    alt={video.author?.username}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${video.author?.username || 'User'}&background=random&color=fff`; }}
                                />

                            </div>

                            <div>
                                <p className="font-bold">{video.author?.username}</p>
                                <p className="text-white/40 text-xs">{video.author?.video_count || 0} subscribers</p>
                            </div>
                            <button
                                onClick={handleSubscribe}
                                disabled={subLoading}
                                className={`ml-4 px-6 py-2 rounded-full font-bold text-sm transition-all active:scale-95 ${isSubscribed
                                    ? "bg-white/10 text-white hover:bg-white/20 border border-white/5"
                                    : "bg-white text-black hover:bg-white/90"
                                    }`}
                            >
                                {subLoading ? "..." : isSubscribed ? "Subscribed" : "Subscribe"}
                            </button>
                        </div>



                        <div className="flex items-center gap-2">
                            <div className="flex bg-white/10 rounded-full overflow-hidden glass">
                                <button className="flex items-center gap-2 hover:bg-white/10 px-4 py-2 transition-colors border-r border-white/10">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.757c1.27 0 2.456.69 3.056 1.769L23 13.5V20a2 2 0 01-2 2H3a2 2 0 01-2-2v-6.5l1.187-1.731C2.787 10.69 3.973 10 5.243 10H10V4a2 2 0 012-2h0a2 2 0 012 2v6z" /></svg>
                                    <span className="text-sm font-bold">{video.like_count || 0}</span>
                                </button>
                                <button className="flex items-center gap-2 hover:bg-white/10 px-4 py-2 transition-colors">
                                    <svg className="w-5 h-5 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.757c1.27 0 2.456.69 3.056 1.769L23 13.5V20a2 2 0 01-2 2H3a2 2 0 01-2-2v-6.5l1.187-1.731C2.787 10.69 3.973 10 5.243 10H10V4a2 2 0 012-2h0a2 2 0 012 2v6z" /></svg>
                                </button>
                            </div>
                            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-5 py-2 rounded-full transition-colors glass font-bold text-sm">
                                Share
                            </button>
                        </div>
                    </div>

                    {/* Description Section */}
                    <div className="bg-white/5 rounded-2xl p-4 lg:p-6 mb-8 hover:bg-white/[0.07] transition-colors cursor-default">
                        <div className="font-bold text-sm mb-2 flex gap-4">
                            <span>{video.view_count.toLocaleString()} views</span>
                            <span>{new Date(video.upload_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                        <p className="text-white/80 whitespace-pre-wrap leading-relaxed text-sm lg:text-base">
                            {video.description || "Looking for a walkthrough or more details? Check out the chapters below or visit our creator portal!"}
                        </p>
                    </div>

                    {/* Placeholder Comment Section */}
                    <div className="mt-8">
                        <h3 className="text-xl font-bold mb-6">Comments</h3>
                        <div className="flex gap-4 mb-8">
                            <div className="w-10 h-10 rounded-full bg-surface shrink-0 border border-white/10" />
                            <div className="flex-1">
                                <input
                                    type="text"
                                    placeholder="Add a comment..."
                                    className="w-full bg-transparent border-b border-white/20 pb-2 focus:outline-none focus:border-white transition-all placeholder:text-white/20"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Section (25% Width) */}
                <div className="lg:col-span-1">
                    <h2 className="font-bold mb-6 text-lg tracking-tight flex items-center gap-2">
                        <span className="w-1 h-6 bg-primary rounded-full" />
                        Up Next
                    </h2>

                    <div className="space-y-4">
                        {recLoading ? (
                            <SidebarSkeleton />
                        ) : recommendations.length > 0 ? (
                            recommendations.map((rec) => (
                                <div key={rec.id} className="cursor-pointer group">
                                    <Link to={`/video/${rec.id}`} className="flex gap-3">
                                        <div className="w-32 xl:w-40 aspect-video rounded-lg overflow-hidden shrink-0 ring-1 ring-white/5">
                                            <img
                                                src={getValidUrl(rec.thumbnail_url, THUMBNAIL_FALLBACK)}
                                                alt={rec.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                onError={(e) => {
                                                    e.target.src = THUMBNAIL_FALLBACK;
                                                }}
                                            />



                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-xs xl:text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                                                {rec.title}
                                            </h3>
                                            <p className="text-white/40 text-[10px] xl:text-[11px] mt-1 hover:text-white/60 transition-colors truncate">
                                                {rec.author?.username}
                                            </p>
                                            <p className="text-white/40 text-[10px] xl:text-[11px]">
                                                {rec.view_count.toLocaleString()} views
                                            </p>
                                        </div>
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                                <p className="text-white/20 text-sm italic">No recommendations found</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default VideoDetail;
