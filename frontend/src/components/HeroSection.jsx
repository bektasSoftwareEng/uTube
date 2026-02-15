import React from 'react';
import { motion } from 'framer-motion';
import { getValidUrl, THUMBNAIL_FALLBACK } from '../utils/urlHelper';

const HeroSection = ({ featuredVideo }) => {
    if (!featuredVideo) {
        return (
            <div className="h-[60vh] w-full bg-neutral-900 animate-pulse flex items-center justify-center">
                <span className="text-white/20 text-4xl font-black italic">uTube Premium</span>
            </div>
        );
    }

    return (
        <div className="relative h-[70vh] w-full overflow-hidden">
            {/* Background Image / Placeholder */}
            <img
                src={getValidUrl(featuredVideo.thumbnail_url, THUMBNAIL_FALLBACK)}
                alt={featuredVideo.title}
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                onError={(e) => {
                    e.target.src = THUMBNAIL_FALLBACK;
                }}
            />


            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

            <div className="absolute bottom-0 left-0 p-8 md:p-16 max-w-2xl">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                >
                    <span className="bg-primary text-white text-xs font-black px-2 py-1 rounded mb-4 inline-block tracking-tighter italic">
                        FEATURED VIDEO
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black mb-4 leading-tight">
                        {featuredVideo.title}
                    </h1>
                    <p className="text-white/60 text-lg mb-8 line-clamp-3">
                        {featuredVideo.description || "Experience the next generation of video content. High definition streaming, interactive lessons, and a community of creators."}
                    </p>

                    <div className="flex items-center gap-4">
                        <button className="bg-white text-black font-bold px-8 py-3 rounded-lg hover:bg-white/90 transition-colors flex items-center gap-2">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                            Watch Now
                        </button>
                        <button className="bg-white/10 text-white font-bold px-8 py-3 rounded-lg hover:bg-white/20 transition-colors glass flex items-center gap-2">
                            More Info
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default HeroSection;
