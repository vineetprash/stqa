import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { BASE_URL } from '../constants'

function PostView({ postId, user, onBack, onEditPost }) {
  // Carousel state
  const [imgIdx, setImgIdx] = useState(0)
  const handlePrevImg = () => setImgIdx(i => (i > 0 ? i - 1 : post.images.length - 1))
  const handleNextImg = () => setImgIdx(i => (i < post.images.length - 1 ? i + 1 : 0))

  // Touch swipe for mobile
  const touchStartX = useRef(null)
  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (dx > 40) handlePrevImg()
    if (dx < -40) handleNextImg()
    touchStartX.current = null
  }
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
    return <div className="text-center text-gray-600 py-8">Loading post...</div>
  }

  if (error) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">{error}</div>
        <button className="px-5 py-2.5 border border-gray-300 rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:border-gray-400 hover:-translate-y-0.5" onClick={onBack}>
          ← Back to Posts
        </button>
      </div>
    )
  }

  if (!post) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">Post not found</div>
        <button className="px-5 py-2.5 border border-gray-300 rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:border-gray-400 hover:-translate-y-0.5" onClick={onBack}>
          ← Back to Posts
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <button className="px-5 py-2.5 border border-gray-300 rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:border-gray-400 hover:-translate-y-0.5" onClick={onBack}>
           Back to Posts
        </button>
      </div>

      <article className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-12 shadow-lg">
        {/* Carousel for images */}
        {post.images && post.images.length > 0 && (
          <div className="mb-8 flex flex-col items-center">
            <div
              className="relative w-full max-w-xl h-64 flex items-center justify-center overflow-hidden"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={post.images[imgIdx]}
                alt={`Post image ${imgIdx + 1}`}
                className="object-contain h-full w-full rounded-lg border border-gray-200 bg-gray-50"
                style={{ maxHeight: '16rem', maxWidth: '100%' }}
              />
              {post.images.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow hover:bg-white"
                    onClick={handlePrevImg}
                    aria-label="Previous image"
                  >
                    &#8592;
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-2 shadow hover:bg-white"
                    onClick={handleNextImg}
                    aria-label="Next image"
                  >
                    &#8594;
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                    {post.images.map((_, i) => (
                      <span
                        key={i}
                        className={`inline-block w-2 h-2 rounded-full ${i === imgIdx ? 'bg-gray-800' : 'bg-gray-300'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <header className="border-b border-gray-200 pb-8 mb-10">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight tracking-tight">{post.title}</h1>
          {/* ...existing code... */}
          <div className="text-gray-600 text-base mb-4 font-medium">
            <div className="mb-2">
              By <strong>{post.author.username}</strong>
              {post.author.profile?.firstName && post.author.profile?.lastName && (
                <span> ({post.author.profile.firstName} {post.author.profile.lastName})</span>
              )}
            </div>
            <div className="mb-2">
              Published on {formatDate(post.publishedAt || post.createdAt)}
            </div>
            {post.views > 0 && (
              <div className="text-sm text-gray-600 font-medium">
                {post.views} views
              </div>
            )}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {post.tags.map(tag => (
                <span key={tag} className="inline-block px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium border border-gray-200">{tag}</span>
              ))}
            </div>
          )}
        </header>
        <div className="text-lg leading-relaxed text-gray-700 mb-8 prose prose-lg max-w-none prose-headings:text-gray-900 prose-headings:font-bold prose-headings:tracking-tight prose-p:mb-4 prose-h1:mt-8 prose-h1:mb-4 prose-h2:mt-8 prose-h2:mb-4 prose-h3:mt-6 prose-h3:mb-3 prose-h4:mt-6 prose-h4:mb-3 prose-h5:mt-4 prose-h5:mb-2 prose-h6:mt-4 prose-h6:mb-2">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>
        {user && user._id === post.author._id && (
          <div className="flex gap-4 pt-6 border-t border-gray-200">
            <button 
              className="px-5 py-2.5 border-none rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => onEditPost(post)}
            >
              Edit Post
            </button>
            <button 
              className="px-5 py-2.5 border-none rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-600 to-gray-700 text-white hover:bg-gradient-to-br hover:from-gray-500 hover:to-gray-600 hover:-translate-y-0.5 hover:shadow-md"
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
