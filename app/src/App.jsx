import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import './App.css'
import LoginForm from './components/LoginForm'
import StepwiseRegistration from './components/StepwiseRegistration'
import PostList from './components/PostList'
import PostView from './components/PostView'
import PostForm from './components/PostForm'
import Header from './components/Header'
import { BASE_URL } from './constants'
import ViewAnalytics from './components/ViewAnalytics'

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

function AppContent() {
  const [user, setUser] = useState(null)
  const [editingPost, setEditingPost] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem('token')
    if (token) {
      fetchUser(token)
    }
  }, [])

  const fetchUser = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched user from token:', data.data.user)
        setUser(data.data.user)
      } else {
        console.log('Failed to fetch user, removing token')
        localStorage.removeItem('token')
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      localStorage.removeItem('token')
    }
  }

  const handleLogin = (userData, token) => {
    console.log('Login successful, setting user:', userData)
    setUser(userData)
    localStorage.setItem('token', token)
    navigate('/')
  }

  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('token')
    navigate('/')
  }

  const handleEditPost = (post) => {
    setEditingPost(post)
    navigate('/create')
  }

  const handleViewPost = (postId) => {
    navigate(`/post/${postId}`)
  }

  const handlePostSaved = () => {
    setEditingPost(null)
    navigate('/')
  }

  return (
    <div className="app">
      <Header 
        user={user} 
        onLogout={handleLogout}
      />
      
      {/* Debug user state
      {process.env.NODE_ENV === 'development' && (
        <div style={{padding: '10px', background: '#f0f0f0', fontSize: '12px'}}>
          Debug - User: {user ? JSON.stringify({_id: user._id, id: user.id, username: user.username}) : 'null'}
        </div>
      )} */}
      
      <main className="main-content">
        <Routes>
          <Route 
            path="/" 
            element={
              <PostList 
                user={user} 
                onEditPost={handleEditPost}
                onViewPost={handleViewPost}
              />
            } 
          />
          <Route 
            path="/analytics" 
            element={
              <ViewAnalytics />
            } 
          />
          
          <Route 
            path="/post/:id" 
            element={<PostViewRoute user={user} onEditPost={handleEditPost} />} 
          />
          
          <Route 
            path="/login" 
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <LoginForm 
                  onLogin={handleLogin}
                  onSwitchToRegister={() => navigate('/register')}
                />
              )
            } 
          />
          
          <Route 
            path="/register" 
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <StepwiseRegistration 
                  onLogin={handleLogin}
                  onSwitchToLogin={() => navigate('/login')}
                />
              )
            } 
          />
          
          <Route 
            path="/create" 
            element={
              user ? (
                <PostForm 
                  user={user}
                  editingPost={editingPost}
                  onPostSaved={handlePostSaved}
                  onCancel={() => navigate('/')}
                />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
        </Routes>
      </main>
    </div>
  )
}

// Component to handle post viewing with URL params
function PostViewRoute({ user, onEditPost }) {
  const { id } = useParams()
  const navigate = useNavigate()
  
  return (
    <PostView 
      postId={id}
      user={user}
      onBack={() => navigate('/')}
      onEditPost={onEditPost}
    />
  )
}

export default App
