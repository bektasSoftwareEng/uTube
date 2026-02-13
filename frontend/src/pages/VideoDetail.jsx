import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { VideoCard } from '../components/VideoGrid';

const VideoDetail = () => {
    const { id } = useParams();
    const [video, setVideo] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVideoData = async () => {
            setLoading(true);
            try {
                // Fetch main video data
                const videoResponse = await ApiClient.get(`/videos/${id}`);
                const videoData = videoResponse.data;
                setVideo(videoData);

                // Fetch contextual recommendations
                // Passing author_id and category to prioritize related content
                const recResponse = await ApiClient.get('/feed/recommended', {
                    params: {
                        author_id: videoData.author?.id,
                        category: videoData.category,
                        limit: 10
                    }
                });

                // Filter current video and limit results
                const filteredRecs = recResponse.data.filter(v => v.id !== parseInt(id));
                setRecommendations(filteredRecs);
            } catch (error) {
                console.error('Failed to fetch video details:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVideoData();
        // Scroll to top when video changes
        window.scrollTo(0, 0);
    }, [id]);

    if (loading) {
        return (
            <div className="pt-24 px-4 md:px-8 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
                <div className="flex-1">
                    <div className="aspect-video bg-surface rounded-2xl animate-pulse mb-6" />
                    <div className="h-8 bg-surface rounded w-3/4 animate-pulse mb-4" />
                    <div className="h-4 bg-surface rounded w-1/4 animate-pulse mb-8" />
                </div>
                <div className="lg:w-80 xl:w-96 space-y-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-32 aspect-video bg-surface rounded-lg shrink-0" />
                            <div className="flex-1 space-y-2 py-1">
                                <div className="h-3 bg-surface rounded w-full" />
                                <div className="h-2 bg-surface rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!video) return <div className="pt-24 text-center">Video not found</div>;

    // Smart Playback Fallback Strategy
    // During development, we use Big Buck Bunny if the local file is missing or a placeholder
    const isLocalPlaceholder = !video.video_url || video.video_url.includes('placeholder') || video.video_url.includes('default');
    const videoSrc = (isLocalPlaceholder)
        ? "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
        : (video.video_url?.startsWith('http') ? video.video_url : `http://localhost:8000${video.video_url}`);

    return (
        <motion.div
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
                            className="w-full h-full"
                            poster={video.thumbnail_url || `https://picsum.photos/seed/${video.id}/1280/720`}
                        >
                            <source src={videoSrc} type="video/mp4" />
                            {/* Fallback source for testing */}
                            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
                            Your browser does not support the video tag.
                        </video>
                    </div>

                    {/* Video Info */}
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">{video.title}</h1>
                    <div className="flex flex-col md:flex-row md:items-center justify-between py-4 border-b border-white/10 mb-6 gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 bg-surface">
                                <img
                                    src={`http://localhost:8000/storage/profiles/${video.author?.profile_image || 'default_avatar.png'}`}
                                    alt={video.author?.username}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${video.author?.username}`; }}
                                />
                            </div>
                            <div>
                                <p className="font-bold">{video.author?.username}</p>
                                <p className="text-white/40 text-xs">{video.author?.video_count || 0} subscribers</p>
                            </div>
                            <button className="ml-4 bg-white text-black px-6 py-2 rounded-full font-bold text-sm hover:bg-white/90 transition-all active:scale-95">
                                Subscribe
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
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={i} className="flex gap-3 animate-pulse">
                                    <div className="w-32 xl:w-40 aspect-video bg-surface rounded-lg shrink-0" />
                                    <div className="flex-1 space-y-2 py-1">
                                        <div className="h-3 bg-surface rounded w-full" />
                                        <div className="h-2 bg-surface rounded w-2/3" />
                                    </div>
                                </div>
                            ))
                        ) : recommendations.length > 0 ? (
                            recommendations.map((rec) => (
                                <div key={rec.id} className="cursor-pointer group">
                                    <Link to={`/video/${rec.id}`} className="flex gap-3">
                                        <div className="w-32 xl:w-40 aspect-video rounded-lg overflow-hidden shrink-0 ring-1 ring-white/5">
                                            <img
                                                src={rec.thumbnail_url || `https://picsum.photos/seed/${rec.id}/800/450`}
                                                alt={rec.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                onError={(e) => {
                                                    e.target.src = `https://picsum.photos/seed/${rec.id}/800/450`;
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
