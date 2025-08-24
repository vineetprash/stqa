import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { BASE_URL } from '../constants'

function PostList({ user, onEditPost, onViewPost }) {
  // Carousel state for each post
  const [carouselIdx, setCarouselIdx] = useState({})
  const handlePrevImg = (postId, images) => {
    setCarouselIdx(idx => ({
      ...idx,
      [postId]: idx[postId] > 0 ? idx[postId] - 1 : images.length - 1
    }))
  }
  const handleNextImg = (postId, images) => {
    setCarouselIdx(idx => ({
      ...idx,
      [postId]: idx[postId] < images.length - 1 ? idx[postId] + 1 : 0
    }))
  }
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
    return <div className="text-center text-gray-600 py-8">Loading posts...</div>
  }

  if (error) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">{error}</div>
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">No posts yet</h2>
        <p className="text-gray-600">Be the first to write a post!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {posts.map(post => (
        <article 
          key={post._id} 
          className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg p-6 shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5"
          onClick={() => onViewPost(post._id)}
        >
          {/* Carousel for images */}
          {post.images && post.images.length > 0 && (
              <div className="mb-4 flex flex-col items-center">
                <div className="relative w-full" style={{ aspectRatio: '16/9', minHeight: '10rem' }}>
                  <img
                    src={post.images[carouselIdx[post._id] || 0]}
                    alt={`Post image ${(carouselIdx[post._id] || 0) + 1}`}
                    className="absolute top-0 left-0 w-full h-full object-contain rounded-md border border-gray-200 bg-gray-50"
                    style={{ width: '100%', height: '100%' }}
                  />
                  {post.images.length > 1 && (
                    <>
                      <button
                        type="button"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow hover:bg-white"
                        onClick={e => { e.stopPropagation(); handlePrevImg(post._id, post.images) }}
                        aria-label="Previous image"
                      >
                        &#8592;
                      </button>
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow hover:bg-white"
                        onClick={e => { e.stopPropagation(); handleNextImg(post._id, post.images) }}
                        aria-label="Next image"
                      >
                        &#8594;
                      </button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {post.images.map((_, i) => (
                          <span
                            key={i}
                            className={`inline-block w-2 h-2 rounded-full ${i === (carouselIdx[post._id] || 0) ? 'bg-gray-800' : 'bg-gray-300'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
          )}
          <h2 className="text-xl font-semibold text-gray-900 mb-3 leading-tight">{post.title}</h2>
          <div className="text-sm text-gray-600 mb-4 flex flex-wrap items-center gap-1">
            <span>By {post.author.username}</span>
            <span>•</span>
            <span>{formatDate(post.publishedAt || post.createdAt)}</span>
            {post.views > 0 && (
              <>
                <span>•</span>
                <span>{post.views} views</span>
              </>
            )}
          </div>
          <div className="text-gray-700 mb-4 leading-relaxed">
            {truncateContent(post.content)}
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map(tag => (
                <span key={tag} className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md border border-gray-200">{tag}</span>
              ))}
            </div>
          )}
          {user && (user._id === post.author._id || user.id === post.author._id) && (
            <div 
              className="flex gap-2 pt-4 border-t border-gray-100"
              onClick={(e) => e.stopPropagation()} // Prevent card click when clicking buttons
            >
              <button 
                className="px-4 py-2 border-none rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 hover:border-gray-400 hover:shadow-md active:scale-95"
                onClick={() => onEditPost(post)}
              >
                Edit
              </button>
              <button 
                className="px-4 py-2 border-none rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-slate-900 text-white border border-transparent hover:bg-red-600 hover:shadow-md active:scale-95"
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
