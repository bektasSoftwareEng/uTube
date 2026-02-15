import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import VideoDetail from './pages/VideoDetail'
import Login from './pages/Login'
import Register from './pages/Register'


function App() {
    console.log('App: Initializing main layout...');
    return (
        <div className="min-h-screen bg-background text-white">

            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/video/:id" element={<VideoDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                </Routes>
            </main>
        </div>
    )
}

export default App
