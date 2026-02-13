import React, { useEffect, useState } from 'react';
import ApiClient from '../utils/ApiClient';
import HeroSection from '../components/HeroSection';
import VideoGrid from '../components/VideoGrid';

const Home = () => {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const response = await ApiClient.get('/videos');
                setVideos(response.data);
            } catch (error) {
                console.error('Failed to fetch videos:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchVideos();
    }, []);

    return (
        <div className="pt-16">
            <HeroSection featuredVideo={videos[0]} />
            <div className="px-4 md:px-8 py-12">
                <h2 className="text-2xl font-bold mb-8">Recommended for you</h2>
                <VideoGrid videos={videos} loading={loading} />
            </div>
        </div>
    );
};

export default Home;
