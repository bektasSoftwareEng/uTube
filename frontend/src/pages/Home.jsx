import React, { useEffect, useState } from 'react';
import ApiClient from '../utils/ApiClient';
import HeroSection from '../components/HeroSection';
import VideoGrid from '../components/VideoGrid';

import CategoryBar from '../components/CategoryBar';

const Home = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState("All");

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const response = await ApiClient.get('/videos/');
                let videoData = response.data;
                // Removed temporary duplication logic for authentic data display
                setVideos(videoData);
            } catch (error) {
                console.error('Failed to fetch videos:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVideos();
    }, []);

    const filteredVideos = selectedCategory === "All"
        ? videos
        : videos.filter(video => video.category === selectedCategory);

    return (
        <div className="pt-16 sm:pt-20 min-h-screen">
            <CategoryBar
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
            />

            {selectedCategory === "All" && <HeroSection videos={videos} />}

            <div className="px-4 md:px-8 py-6 md:py-10 max-w-[1800px] mx-auto">
                <h2 className="text-lg md:text-xl font-bold mb-4 tracking-tight">
                    {selectedCategory === "All" ? "Recommended for you" : `${selectedCategory} Videos`}
                </h2>
                <VideoGrid videos={filteredVideos} loading={loading} />
            </div>
        </div>
    );
};

export default Home;
