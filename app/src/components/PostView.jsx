import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { BASE_URL } from '../constants'

function PostView({ postId, user, onBack, onEditPost }) {
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMeta, setViewMeta] = useState(null)
  const viewTracked = useRef(false)
  const token = localStorage.getItem('token')
  
  useEffect(() => {
    if (postId && !viewTracked.current) {
      fetchPost()
      viewTracked.current = true
    }
  }, [postId])

  // Reset view tracking when postId changes
  useEffect(() => {
    viewTracked.current = false
  }, [postId])

  const fetchPost = async () => {
    try {
      // Check if we've already viewed this post recently (client-side check)
      const viewedPosts = JSON.parse(localStorage.getItem('viewedPosts') || '{}')
      const lastViewed = viewedPosts[postId]
      const now = Date.now()
      const viewCooldown = 30 * 60 * 1000 // 30 minutes

      const response = await fetch(`${BASE_URL}/api/posts/view/${postId}`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await response.json()

      if (response.ok) {
        setPost(data.data.post)
        setViewMeta(data.meta)
        
        // Update local view tracking
        if (data.meta?.viewCounted) {
          viewedPosts[postId] = now
          localStorage.setItem('viewedPosts', JSON.stringify(viewedPosts))
        }
        
        // Clean up old entries (keep only last 24 hours)
        const dayAgo = now - (24 * 60 * 60 * 1000)
        Object.keys(viewedPosts).forEach(id => {
          if (viewedPosts[id] < dayAgo) {
            delete viewedPosts[id]
          }
        })
        localStorage.setItem('viewedPosts', JSON.stringify(viewedPosts))
      } else {
        setError(data.message || 'Failed to fetch post')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return
    }

    try {
      
      const response = await fetch(`${BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        onBack() // Go back to post list after deletion
      } else {
        const data = await response.json()
        alert(data.message || 'Failed to delete post')
      }
    } catch (error) {
      alert('Network error. Please try again.')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return <div className="loading">Loading post...</div>
  }

  if (error) {
    return (
      <div>
        <div className="error">{error}</div>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Posts
        </button>
      </div>
    )
  }

  if (!post) {
    return (
      <div>
        <div className="error">Post not found</div>
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Posts
        </button>
      </div>
    )
  }

  return (
    <div className="post-view">
      <div className="post-view-header">
        <button className="btn btn-secondary" onClick={onBack}>
          ← Back to Posts
        </button>
      </div>

      <article className="post-full">
        <header className="post-header">
          <h1 className="post-title-full">{post.title}</h1>
          
          <div className="post-meta-full">
            <div className="author-info">
              By <strong>{post.author.username}</strong>
              {post.author.profile?.firstName && post.author.profile?.lastName && (
                <span> ({post.author.profile.firstName} {post.author.profile.lastName})</span>
              )}
            </div>
            <div className="post-date">
              Published on {formatDate(post.publishedAt || post.createdAt)}
            </div>
            {post.views > 0 && (
              <div className="post-views">
                {post.views} views
              </div>
            )}
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="post-tags-full">
              {post.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
        </header>

        <div className="post-content-full">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        {user && user._id === post.author._id && (
          <div className="post-actions-full">
            <button 
              className="btn btn-primary"
              onClick={() => onEditPost(post)}
            >
              Edit Post
            </button>
            <button 
              className="btn btn-danger"
              onClick={handleDeletePost}
            >
              Delete Post
            </button>
          </div>
        )}
      </article>
    </div>
  )
}

export default PostView
