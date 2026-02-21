import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import VideoDetail from './pages/VideoDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Upload from './pages/Upload'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
// ...

function App() {
    console.log('App: Initializing main layout...');
    return (
        <div className="min-h-screen text-white">
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/video/:id" element={<VideoDetail />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/edit-profile" element={<EditProfile />} />

                </Routes>
            </main>
        </div>
    )
}

export default App
