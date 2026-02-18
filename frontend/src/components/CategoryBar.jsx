import React from 'react';
import { motion } from 'framer-motion';

const categories = [
    "All",
    "Education",
    "Technology",
    "Gaming",
    "Music",
    "Entertainment",
    "Sports",
    "News",
    "Other"
];

const CategoryBar = ({ selectedCategory, onSelectCategory }) => {
    return (
        <div className="w-full bg-black/30 backdrop-blur-md border-b border-white/5 sticky top-16 sm:top-20 z-40 py-2">
            <div className="max-w-[1800px] mx-auto px-4 sm:px-8 py-1 overflow-x-auto no-scrollbar flex gap-2.5 justify-center">
                {categories.map((category) => (
                    <motion.button
                        key={category}
                        onClick={() => onSelectCategory(category)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-xs font-bold transition-all border ${selectedCategory === category
                            ? 'bg-[#8B0000] text-white border-[#FF0000]/30 shadow-[0_0_15px_rgba(139,0,0,0.4)]'
                            : 'bg-black/40 text-white/70 border-white/5 hover:bg-[#8B0000]/20 hover:text-white hover:border-[#8B0000]/50'
                            }`}
                    >
                        {category}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

export default CategoryBar;
