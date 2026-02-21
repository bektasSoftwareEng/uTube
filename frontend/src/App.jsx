import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import VideoDetail from './pages/VideoDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Upload from './pages/Upload'
import Profile from './pages/Profile'
import EditProfile from './pages/EditProfile'
import LiveStudio from './pages/LiveStudio'
import { UTUBE_TOKEN } from './utils/authConstants'

// Utility component to strictly guard routes
const ProtectedRoute = ({ children }) => {
    const isAuthenticated = !!localStorage.getItem(UTUBE_TOKEN);
    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

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

                    {/* Protected Routes */}
                    <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
                    <Route path="/live" element={<ProtectedRoute><LiveStudio /></ProtectedRoute>} />
                </Routes>
            </main>
        </div>
    )
}

export default App
