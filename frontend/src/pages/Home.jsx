import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ApiClient from '../utils/ApiClient';
import HeroSection from '../components/HeroSection';
import VideoGrid, { getBlockedChannels } from '../components/VideoGrid';

import CategoryBar from '../components/CategoryBar';

const Home = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [showHero, setShowHero] = useState(true);
    const [blockedChannels, setBlockedChannels] = useState(() => new Set(getBlockedChannels()));
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get('search') || '';

    useEffect(() => {
        const fetchVideos = async () => {
            setLoading(true);
            try {
                let response;
                if (searchQuery) {
                    response = await ApiClient.get('/videos/semantic-search', {
                        params: { query: searchQuery }
                    });
                } else {
                    response = await ApiClient.get('/videos/');
                }

                let videoData = response.data;
                setVideos(videoData);
            } catch (error) {
                console.error('Failed to fetch videos:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVideos();

        const handleBlock = () => setBlockedChannels(new Set(getBlockedChannels()));
        window.addEventListener('utube_channel_blocked', handleBlock);
        return () => window.removeEventListener('utube_channel_blocked', handleBlock);
    }, [searchQuery]);

    // Apply global channel block filter first
    const visibleVideos = videos.filter(v => !blockedChannels.has(v.author?.id));

    const filteredVideos = selectedCategory === "All"
        ? visibleVideos
        : visibleVideos.filter(video => video.category === selectedCategory);

    return (
        <div className="min-h-screen pt-16 sm:pt-20">
            {!searchQuery && (
                <CategoryBar
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />
            )}

            {!searchQuery && selectedCategory === "All" && (
                <>
                    {/* Hero toggle button */}
                    <div className="flex items-center justify-end px-4 md:px-8 pt-2 pb-1">
                        <button
                            onClick={() => setShowHero(v => !v)}
                            className="flex items-center gap-1.5 text-xs font-bold text-white/30 hover:text-white/70 transition-colors"
                        >
                            <motion.svg
                                animate={{ rotate: showHero ? 0 : 180 }}
                                transition={{ duration: 0.2 }}
                                className="w-3.5 h-3.5"
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </motion.svg>
                            {showHero ? 'Hide Trending' : 'Show Trending'}
                        </button>
                    </div>

                    {/* Collapsible hero */}
                    <AnimatePresence initial={false}>
                        {showHero && (
                            <motion.div
                                key="hero"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                            >
                                <HeroSection videos={visibleVideos} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}

            <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1800px] mx-auto">
                <h2 className="text-lg md:text-xl font-bold mb-4 tracking-tight flex items-center gap-2">
                    {searchQuery ? (
                        <>Search results for <span className="text-primary break-words max-w-full">"{searchQuery}"</span></>
                    ) : selectedCategory === "All" ? (
                        "Recommended for you"
                    ) : (
                        `${selectedCategory} Videos`
                    )}
                </h2>

                {filteredVideos.length === 0 && !loading ? (
                    <div className="py-20 text-center text-white/50 w-full col-span-full">
                        <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-lg font-bold">No videos found</p>
                        <p className="text-sm mt-1">Try adjusting your search terms</p>
                    </div>
                ) : (
                    <VideoGrid videos={filteredVideos} loading={loading} />
                )}
            </div>
        </div>
    );
};

export default Home;
