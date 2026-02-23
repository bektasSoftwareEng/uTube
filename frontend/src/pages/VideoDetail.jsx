import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { VideoCard } from '../components/VideoGrid';
import VideoPlayer from '../components/VideoPlayer';
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

    // ── Like State ──
    const [likeCount, setLikeCount] = useState(0);
    const [userHasLiked, setUserHasLiked] = useState(false);
    const [likeLoading, setLikeLoading] = useState(false);
    const [dislikeCount, setDislikeCount] = useState(0);
    const [userHasDisliked, setUserHasDisliked] = useState(false);
    const [dislikeLoading, setDislikeLoading] = useState(false);

    // ── Comment State ──
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);
    const [commentSubmitting, setCommentSubmitting] = useState(false);
    const [commentCount, setCommentCount] = useState(0);

    // Get current user from localStorage
    const getCurrentUser = () => {
        try {
            const data = localStorage.getItem(UTUBE_USER);
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    };

    // ══════════════════════════════════════════════════
    // Fetch Video Data
    // ══════════════════════════════════════════════════
    useEffect(() => {
        let pollInterval;

        const fetchRecommendations = async (currentVideo) => {
            try {
                const recResponse = await ApiClient.get('/feed/recommended', {
                    params: {
                        author_id: currentVideo.author?.id,
                        category: currentVideo.category,
                        exclude_id: id,
                        limit: 10
                    }
                });
                // Double-safety: Filter on frontend too
                const validRecs = recResponse.data.filter(v => v.status === 'published');
                setRecommendations(validRecs);
            } catch (error) {
                console.error('Failed to fetch recommendations:', error);
            }
        };

        const fetchVideoData = async () => {
            setLoading(true);
            setRecLoading(true); // Reset sidebar state
            try {
                // Fetch main video data
                const videoResponse = await ApiClient.get(`/videos/${id}`);
                const videoData = videoResponse.data;
                setVideo(videoData);
                setLikeCount(videoData.like_count || 0);
                setLoading(false); // Show main content as soon as it's ready

                // Use Ref Guard to prevent StrictMode double-triggers
                if (!viewTracked.current) {
                    viewTracked.current = true;
                    incrementView(id);
                }

                // Initial Recommendation Fetch
                await fetchRecommendations(videoData);

                // POLL Recommendations every 15s
                pollInterval = setInterval(() => {
                    fetchRecommendations(videoData);
                }, 15000);

            } catch (error) {
                console.error('Failed to fetch video details:', error);
                setFetchError(error.message + (error.response ? ` (Status: ${error.response.status})` : ''));
                setLoading(false);
            } finally {
                setRecLoading(false);
            }
        };

        const incrementView = async (videoId) => {
            try {
                await ApiClient.post(`/videos/${videoId}/view`);
                setVideo(prev => ({
                    ...prev,
                    view_count: (prev?.view_count || 0) + 1
                }));
            } catch (err) {
                // Fail silently
                console.warn('View tracking failed silently:', err);
            }
        };

        fetchVideoData();
        window.scrollTo(0, 0);

        // Reset tracking on ID change
        return () => {
            viewTracked.current = false;
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [id]);

    // ══════════════════════════════════════════════════
    // Fetch Like/Dislike Status (requires auth)
    // ══════════════════════════════════════════════════
    useEffect(() => {
        const fetchLikeStatus = async () => {
            const user = getCurrentUser();
            if (!user) return;

            try {
                const res = await ApiClient.get(`/videos/${id}/likes`);
                setLikeCount(res.data.like_count);
                setUserHasLiked(res.data.user_has_liked);
                setDislikeCount(res.data.dislike_count);
                setUserHasDisliked(res.data.user_has_disliked);
            } catch (err) {
                console.warn('Could not fetch like status:', err);
            }
        };

        if (video) fetchLikeStatus();
    }, [video, id]);

    // ══════════════════════════════════════════════════
    // Fetch Comments
    // ══════════════════════════════════════════════════
    useEffect(() => {
        const fetchComments = async () => {
            setCommentLoading(true);
            try {
                const res = await ApiClient.get(`/videos/${id}/comments`);
                setComments(res.data);
                setCommentCount(res.data.length);
            } catch (err) {
                console.warn('Could not fetch comments:', err);
            } finally {
                setCommentLoading(false);
            }
        };

        if (video) fetchComments();
    }, [video, id]);

    // ══════════════════════════════════════════════════
    // Check Subscription
    // ══════════════════════════════════════════════════
    useEffect(() => {
        const checkSubscription = async () => {
            const userStr = localStorage.getItem(UTUBE_USER);
            if (!userStr || !video?.author) return;

            try {
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

    // ══════════════════════════════════════════════════
    // Handlers
    // ══════════════════════════════════════════════════

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

    const handleToggleLike = async () => {
        const user = getCurrentUser();
        if (!user) {
            alert("Please sign in to like videos");
            return;
        }

        setLikeLoading(true);
        try {
            const res = await ApiClient.post(`/videos/${id}/like`);
            setLikeCount(res.data.like_count);
            setUserHasLiked(res.data.user_has_liked);
            setDislikeCount(res.data.dislike_count);
            setUserHasDisliked(res.data.user_has_disliked);
        } catch (err) {
            console.error("Like toggle failed:", err);
        } finally {
            setLikeLoading(false);
        }
    };

    const handleToggleDislike = async () => {
        const user = getCurrentUser();
        if (!user) {
            alert("Please sign in to dislike videos");
            return;
        }

        setDislikeLoading(true);
        try {
            const res = await ApiClient.post(`/videos/${id}/dislike`);
            setLikeCount(res.data.like_count);
            setUserHasLiked(res.data.user_has_liked);
            setDislikeCount(res.data.dislike_count);
            setUserHasDisliked(res.data.user_has_disliked);
        } catch (err) {
            console.error("Dislike toggle failed:", err);
        } finally {
            setDislikeLoading(false);
        }
    };

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        const user = getCurrentUser();
        if (!user) {
            alert("Please sign in to comment");
            return;
        }
        if (!newComment.trim()) return;

        setCommentSubmitting(true);
        try {
            const res = await ApiClient.post(`/videos/${id}/comments`, { text: newComment.trim() });
            setComments(prev => [res.data, ...prev]);
            setCommentCount(prev => prev + 1);
            setNewComment('');
        } catch (err) {
            console.error("Comment submission failed:", err);
            alert(err.response?.data?.detail || "Failed to post comment");
        } finally {
            setCommentSubmitting(false);
        }
    };

    const handleCommentLike = async (commentId) => {
        const user = getCurrentUser();
        if (!user) { alert('Please sign in to like comments'); return; }
        try {
            const res = await ApiClient.post(`/comments/${commentId}/like`);
            setComments(prev => prev.map(c => c.id === commentId ? {
                ...c,
                like_count: res.data.like_count,
                dislike_count: res.data.dislike_count,
                user_has_liked: res.data.user_has_liked,
                user_has_disliked: res.data.user_has_disliked
            } : c));
        } catch (err) { console.error('Comment like failed:', err); }
    };

    const handleCommentDislike = async (commentId) => {
        const user = getCurrentUser();
        if (!user) { alert('Please sign in to dislike comments'); return; }
        try {
            const res = await ApiClient.post(`/comments/${commentId}/dislike`);
            setComments(prev => prev.map(c => c.id === commentId ? {
                ...c,
                like_count: res.data.like_count,
                dislike_count: res.data.dislike_count,
                user_has_liked: res.data.user_has_liked,
                user_has_disliked: res.data.user_has_disliked
            } : c));
        } catch (err) { console.error('Comment dislike failed:', err); }
    };

    const handleDeleteComment = async (commentId) => {
        try {
            await ApiClient.delete(`/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
            setCommentCount(prev => prev - 1);
        } catch (err) {
            console.error("Delete comment failed:", err);
            alert(err.response?.data?.detail || "Failed to delete comment");
        }
    };

    // ══════════════════════════════════════════════════
    // Render: Loading & Error States
    // ══════════════════════════════════════════════════

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

    const currentUser = getCurrentUser();

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
                    <div className="mb-6">
                        <VideoPlayer
                            src={videoSrc}
                            poster={getValidUrl(video.thumbnail_url, THUMBNAIL_FALLBACK)}
                            onError={(e) => {
                                if (e.target.src !== DYNAMIC_FALLBACK) {
                                    e.target.src = DYNAMIC_FALLBACK;
                                }
                            }}
                        />
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
                                {/* ── Like Button (wired to API) ── */}
                                <button
                                    onClick={handleToggleLike}
                                    disabled={likeLoading}
                                    className={`flex items-center gap-2 px-4 py-2 transition-colors border-r border-white/10 ${userHasLiked
                                        ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                        : 'hover:bg-white/10 text-white'
                                        }`}
                                >
                                    <svg className="w-5 h-5" fill={userHasLiked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21H4a1 1 0 01-1-1v-8a1 1 0 011-1h3l2.31-6.925A1.847 1.847 0 0111.153 3 2.847 2.847 0 0114 5.847V10z" />
                                    </svg>
                                    <span className="text-sm font-bold">{likeCount}</span>
                                </button>
                                {/* ── Dislike Button (wired to API) ── */}
                                <button
                                    onClick={handleToggleDislike}
                                    disabled={dislikeLoading}
                                    className={`flex items-center gap-2 px-4 py-2 transition-colors ${userHasDisliked
                                        ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                        : 'hover:bg-white/10 text-white'
                                        }`}
                                >
                                    <svg className="w-5 h-5 rotate-180" fill={userHasDisliked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21H4a1 1 0 01-1-1v-8a1 1 0 011-1h3l2.31-6.925A1.847 1.847 0 0111.153 3 2.847 2.847 0 0114 5.847V10z" />
                                    </svg>
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

                    {/* ══════════════════════════════════════════════════ */}
                    {/* Comment Section (fully wired to API) */}
                    {/* ══════════════════════════════════════════════════ */}
                    <div className="mt-8">
                        <h3 className="text-xl font-bold mb-6">
                            {commentCount} Comment{commentCount !== 1 ? 's' : ''}
                        </h3>

                        {/* Comment Input */}
                        <form onSubmit={handleSubmitComment} className="flex gap-4 mb-8">
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 border border-white/10">
                                {currentUser ? (
                                    <img
                                        src={getAvatarUrl(currentUser.profile_image, currentUser.username)}
                                        alt={currentUser.username}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-white/5" />
                                )}
                            </div>
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={newComment}
                                    onChange={(e) => setNewComment(e.target.value)}
                                    placeholder={currentUser ? "Add a comment..." : "Sign in to comment..."}
                                    disabled={!currentUser}
                                    className="w-full bg-transparent border-b border-white/20 pb-2 focus:outline-none focus:border-white transition-all placeholder:text-white/20 disabled:opacity-40"
                                />
                                <AnimatePresence>
                                    {newComment.trim() && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex justify-end gap-2 mt-3"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => setNewComment('')}
                                                className="px-4 py-1.5 rounded-full text-sm font-bold text-white/60 hover:bg-white/10 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={commentSubmitting}
                                                className="px-4 py-1.5 rounded-full text-sm font-bold bg-primary text-white hover:bg-primary/80 transition-colors disabled:opacity-50"
                                            >
                                                {commentSubmitting ? "Posting..." : "Comment"}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </form>

                        {/* Comment List */}
                        {commentLoading ? (
                            <div className="space-y-6">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex gap-4 animate-pulse">
                                        <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-white/5 rounded w-1/4" />
                                            <div className="h-3 bg-white/5 rounded w-3/4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : comments.length > 0 ? (
                            <div className="space-y-6">
                                <AnimatePresence>
                                    {comments.map((comment) => (
                                        <motion.div
                                            key={comment.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: -50 }}
                                            className="flex gap-4 group"
                                        >
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-surface shrink-0 border border-white/10">
                                                <img
                                                    src={getAvatarUrl(comment.author?.profile_image, comment.author?.username)}
                                                    alt={comment.author?.username}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${comment.author?.username || 'U'}&background=random&color=fff&size=40`; }}
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm">@{comment.author?.username || 'Unknown'}</span>
                                                    <span className="text-white/30 text-xs">
                                                        {new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <p className="text-white/80 text-sm leading-relaxed break-words">{comment.text}</p>

                                                {/* Comment Actions: Like / Dislike / Delete */}
                                                <div className="flex items-center gap-1 mt-2">
                                                    {/* Like */}
                                                    <button
                                                        onClick={() => handleCommentLike(comment.id)}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${comment.user_has_liked
                                                            ? 'text-primary bg-primary/10'
                                                            : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill={comment.user_has_liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21H4a1 1 0 01-1-1v-8a1 1 0 011-1h3l2.31-6.925A1.847 1.847 0 0111.153 3 2.847 2.847 0 0114 5.847V10z" />
                                                        </svg>
                                                        {comment.like_count > 0 && <span>{comment.like_count}</span>}
                                                    </button>
                                                    {/* Dislike */}
                                                    <button
                                                        onClick={() => handleCommentDislike(comment.id)}
                                                        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${comment.user_has_disliked
                                                            ? 'text-primary bg-primary/10'
                                                            : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                                                            }`}
                                                    >
                                                        <svg className="w-3.5 h-3.5 rotate-180" fill={comment.user_has_disliked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21H4a1 1 0 01-1-1v-8a1 1 0 011-1h3l2.31-6.925A1.847 1.847 0 0111.153 3 2.847 2.847 0 0114 5.847V10z" />
                                                        </svg>
                                                        {comment.dislike_count > 0 && <span>{comment.dislike_count}</span>}
                                                    </button>
                                                    {/* Delete — own comments only */}
                                                    {currentUser && currentUser.id === comment.author?.id && (
                                                        <button
                                                            onClick={() => handleDeleteComment(comment.id)}
                                                            className="ml-2 text-xs text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                        >
                                                            Delete
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <div className="py-12 text-center">
                                <p className="text-white/30 text-sm">No comments yet. Be the first to comment!</p>
                            </div>
                        )}
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
                                rec.status === 'published' && (
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
                                )
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
