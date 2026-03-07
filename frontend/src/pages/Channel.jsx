import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import { getAvatarUrl, getMediaUrl, getValidUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';
import { VideoCard } from '../components/VideoGrid';
import { UTUBE_USER, UTUBE_TOKEN } from '../utils/authConstants';
import toast from 'react-hot-toast';

const Channel = () => {
    const { id } = useParams();
    const [channel, setChannel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subLoading, setSubLoading] = useState(false);
    const [subscriberCount, setSubscriberCount] = useState(0);

    const currentUser = (() => {
        try {
            const data = localStorage.getItem(UTUBE_USER);
            return data ? JSON.parse(data) : null;
        } catch { return null; }
    })();
    const isOwnChannel = currentUser && channel && currentUser.id === channel.id;

    useEffect(() => {
        const fetchChannel = async () => {
            if (!id) return;
            setLoading(true);
            setError(null);
            try {
                const res = await ApiClient.get(`/channel/${id}`);
                setChannel(res.data);
                setSubscriberCount(res.data.subscriber_count ?? 0);
            } catch (err) {
                setError(err.response?.status === 404 ? 'Channel not found' : err.message || 'Failed to load channel');
                setChannel(null);
            } finally {
                setLoading(false);
            }
        };
        fetchChannel();
    }, [id]);

    useEffect(() => {
        const checkSubscription = async () => {
            if (!currentUser || !channel) return;
            try {
                const res = await ApiClient.get('/auth/subscriptions');
                const subs = res.data;
                const subbed = subs.some(u => u.id === channel.id);
                setIsSubscribed(subbed);
            } catch { setIsSubscribed(false); }
        };
        checkSubscription();
    }, [currentUser, channel]);

    const handleSubscribe = async () => {
        if (!currentUser) {
            toast.error('Please log in to subscribe');
            return;
        }
        if (isOwnChannel) {
            toast.error("You can't subscribe to your own channel");
            return;
        }
        if (!channel) return;

        setSubLoading(true);
        try {
            if (isSubscribed) {
                await ApiClient.delete(`/auth/subscribe/${channel.id}`);
                setIsSubscribed(false);
                setSubscriberCount(prev => Math.max(0, prev - 1));
                toast.success('Unsubscribed');
            } else {
                await ApiClient.post(`/auth/subscribe/${channel.id}`);
                setIsSubscribed(true);
                setSubscriberCount(prev => prev + 1);
                toast.success('Subscribed!');
            }
        } catch (err) {
            const detail = err.response?.data?.detail;
            if (detail === 'SELF_SUBSCRIPTION_NOT_ALLOWED') {
                toast.error("You can't subscribe to your own channel");
            } else {
                toast.error(detail || 'Subscription failed');
            }
        } finally {
            setSubLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen pt-24 pb-12 px-4 md:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="h-48 md:h-64 bg-white/5 rounded-2xl animate-pulse mb-8" />
                    <div className="flex gap-6 items-end -mt-16 relative z-10 px-4">
                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-white/10 animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-8 bg-white/10 rounded w-48 animate-pulse" />
                            <div className="h-4 bg-white/5 rounded w-24 animate-pulse" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-12">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="aspect-video bg-white/5 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (error || !channel) {
        return (
            <div className="min-h-screen pt-24 pb-12 px-4 flex flex-col items-center justify-center text-center">
                <h1 className="text-2xl font-bold text-white/80 mb-2">Channel Not Found</h1>
                <p className="text-white/50 mb-6">{error || 'This channel does not exist or has been removed.'}</p>
                <Link to="/" className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-colors">
                    Back to Home
                </Link>
            </div>
        );
    }

    const bannerUrl = channel.banner_url
        ? getValidUrl(`/storage/uploads/banners/${channel.banner_url}`)
        : null;

    return (
        <div className="min-h-screen pt-24 pb-16 px-4 md:px-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-black to-black text-white">
            <div className="max-w-6xl mx-auto">
                {/* ─── Banner ───────────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-8"
                >
                    {bannerUrl ? (
                        <img
                            src={bannerUrl}
                            alt={`${channel.username}'s banner`}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling?.classList.remove('hidden'); }}
                        />
                    ) : null}
                    <div
                        className={`absolute inset-0 bg-gradient-to-br from-primary/40 via-purple-600/30 to-primary/20 ${bannerUrl ? 'hidden' : ''}`}
                    />
                </motion.div>

                {/* ─── Profile Info (overlapping banner) ─────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="flex flex-col md:flex-row items-center md:items-end gap-6 -mt-20 md:-mt-24 relative z-10 px-0 md:px-4"
                >
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full p-1 bg-gradient-to-br from-primary to-purple-600 shadow-2xl shrink-0 overflow-hidden">
                        <img
                            src={getAvatarUrl(channel.avatar_url || channel.profile_image, channel.username)}
                            alt={channel.username}
                            className="w-full h-full object-cover rounded-full border-4 border-[#111]"
                            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${channel.username || 'U'}&background=random&color=fff&size=128`; }}
                        />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight">{channel.username}</h1>
                        <p className="text-white/50 text-sm mt-1">
                            {subscriberCount.toLocaleString()} subscriber{subscriberCount !== 1 ? 's' : ''}
                        </p>
                        <div className="mt-4">
                            {isOwnChannel ? (
                                <Link
                                    to="/my-channel"
                                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-full font-bold text-sm transition-all border border-white/10"
                                >
                                    Manage Channel
                                </Link>
                            ) : (
                                <button
                                    onClick={handleSubscribe}
                                    disabled={subLoading}
                                    className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all disabled:opacity-50 ${
                                        isSubscribed
                                            ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                                            : 'bg-white text-black hover:bg-gray-200'
                                    }`}
                                >
                                    {subLoading ? '...' : isSubscribed ? 'Subscribed' : 'Subscribe'}
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* ─── Video Grid ───────────────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.2 }}
                    className="mt-12"
                >
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <span className="w-1 h-6 bg-primary rounded-full" />
                        Videos
                    </h2>
                    {channel.videos && channel.videos.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {channel.videos.map((video) => (
                                <VideoCard key={video.id} video={video} />
                            ))}
                        </div>
                    ) : (
                        <div className="py-16 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                            <p className="text-white/40 font-medium">No videos yet</p>
                            <p className="text-white/30 text-sm mt-1">This channel hasn't uploaded any videos.</p>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
};

export default Channel;
