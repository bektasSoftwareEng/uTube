import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ApiClient from '../utils/ApiClient';
import HeroSection from '../components/HeroSection';
import VideoGrid from '../components/VideoGrid';

import CategoryBar from '../components/CategoryBar';

const Home = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("All");
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
    }, [searchQuery]);

    const filteredVideos = selectedCategory === "All"
        ? videos
        : videos.filter(video => video.category === selectedCategory);

    return (
        <div className="pt-16 sm:pt-20 min-h-screen">
            {!searchQuery && (
                <CategoryBar
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                />
            )}

            {!searchQuery && selectedCategory === "All" && <HeroSection videos={videos} />}

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
