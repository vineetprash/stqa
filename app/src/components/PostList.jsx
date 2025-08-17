import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { BASE_URL } from '../constants'

function PostList({ user, onEditPost, onViewPost }) {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/posts`)
      const data = await response.json()

      if (response.ok) {
        setPosts(data.data.posts)
      } else {
        setError(data.message || 'Failed to fetch posts')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${BASE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setPosts(posts.filter(post => post._id !== postId))
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
      day: 'numeric'
    })
  }

  const truncateContent = (content, maxLength = 200) => {
    // Remove markdown formatting for preview
    const plainText = content.replace(/[#*_`~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    if (plainText.length <= maxLength) return plainText
    return plainText.substr(0, maxLength) + '...'
  }

  if (loading) {
    return <div className="loading">Loading posts...</div>
  }

  if (error) {
    return <div className="error">{error}</div>
  }

  if (posts.length === 0) {
    return (
      <div className="text-center">
        <h2>No posts yet</h2>
        <p>Be the first to write a post!</p>
      </div>
    )
  }

  return (
    <div className="post-list">
      {posts.map(post => (
        <article 
          key={post._id} 
          className="post-card"
          onClick={() => onViewPost(post._id)}
        >
          <h2 className="post-title">{post.title}</h2>
          
          <div className="post-meta">
            By {post.author.username} • {formatDate(post.publishedAt || post.createdAt)}
            {post.views > 0 && ` • ${post.views} views`}
          </div>

          <div className="post-content">
            {truncateContent(post.content)}
          </div>

          {post.tags && post.tags.length > 0 && (
            <div className="post-tags">
              {post.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}

          {user && (user._id === post.author._id || user.id === post.author._id) && (
            <div 
              className="post-actions"
              onClick={(e) => e.stopPropagation()} // Prevent card click when clicking buttons
            >
              <button 
                className="btn btn-secondary"
                onClick={() => onEditPost(post)}
              >
                Edit
              </button>
              <button 
                className="btn btn-danger"
                onClick={() => handleDeletePost(post._id)}
              >
                Delete
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

export default PostList
