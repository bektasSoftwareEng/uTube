import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import VideoDetail from './pages/VideoDetail'

function App() {
    return (
        <div className="min-h-screen bg-background text-white">
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/video/:id" element={<VideoDetail />} />
                    {/* Future routes for video detail, profile, etc. */}
                </Routes>
            </main>
        </div>
    )
}

export default App
