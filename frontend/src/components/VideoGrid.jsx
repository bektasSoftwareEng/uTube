import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export const VideoCard = ({ video }) => {
    return (
        <Link to={`/video/${video.id}`}>
            <motion.div
                className="video-card-hover group cursor-pointer"
                layout
            >
                <div className="relative aspect-video rounded-xl overflow-hidden mb-3">
                    <img
                        src={video.thumbnail_url || `https://picsum.photos/seed/${video.id}/800/450`}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.src = `https://picsum.photos/seed/${video.id}/800/450`;
                        }}
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        {video.duration ? `${Math.floor(video.duration / 60)}:${(video.duration % 60).toString().padStart(2, '0')}` : '04:20'}
                    </div>
                </div>

                <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface shrink-0 overflow-hidden border border-white/10">
                        <img
                            src={`http://localhost:8000/storage/profiles/${video.author?.profile_image || 'default_avatar.png'}`}
                            alt={video.author?.username}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                e.target.src = "https://ui-avatars.com/api/?name=" + video.author?.username;
                            }}
                        />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                            {video.title}
                        </h3>
                        <p className="text-white/40 text-xs mt-1 hover:text-white/60 transition-colors">
                            {video.author?.username}
                        </p>
                        <div className="flex items-center gap-1 text-white/40 text-[11px] mt-0.5">
                            <span>{video.view_count || 0} views</span>
                            <span>•</span>
                            <span>{video.upload_date ? new Date(video.upload_date).toLocaleDateString() : 'Just now'}</span>
                        </div>
                    </div>
                </div>
            </motion.div>
        </Link>
    );
};

const VideoGrid = ({ videos, loading }) => {
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="aspect-video bg-surface rounded-xl mb-3" />
                        <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-full bg-surface" />
                            <div className="flex-1 space-y-2 py-1">
                                <div className="h-4 bg-surface rounded w-3/4" />
                                <div className="h-3 bg-surface rounded w-1/2" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
            {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
            ))}
        </div>
    );
};

export default VideoGrid;
