import { useState, useEffect } from 'react'
import { BASE_URL } from '../constants'

function PostForm({ user, editingPost, onPostSaved, onCancel }) {
  // Memoize blob URLs for previews
  const [imageURLs, setImageURLs] = useState([])
  const [images, setImages] = useState([])
  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files)
    setImages(prev => [...prev, ...files])
  }
  useEffect(() => {
    // Revoke old URLs
    imageURLs.forEach(url => URL.revokeObjectURL(url))
    setImageURLs(images.map(img => URL.createObjectURL(img)))
    // Cleanup on unmount
    return () => {
      imageURLs.forEach(url => URL.revokeObjectURL(url))
    }
  }, [images])
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    status: 'published'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Remove image
  const handleRemoveImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  useEffect(() => {
    if (editingPost) {
      setFormData({
        title: editingPost.title,
        content: editingPost.content,
        tags: editingPost.tags ? editingPost.tags.join(', ') : '',
        status: editingPost.status
      })
    }
  }, [editingPost])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    setFormData({
      ...formData,
      status: "published"
    })
    try {
      const token = localStorage.getItem('token')
      const url = editingPost 
        ? `${BASE_URL}/api/posts/${editingPost._id}`
        : `${BASE_URL}/api/posts`
      const method = editingPost ? 'PUT' : 'POST'

      // Process tags
      const tags = formData.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)

      // Use FormData for images
      const fd = new FormData()
      fd.append('title', formData.title)
      fd.append('content', formData.content)
      fd.append('status', formData.status)
      fd.append('tags', JSON.stringify(tags))
      images.forEach((img, i) => {
        fd.append('images', img)
      })

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: fd
      })

      const data = await response.json()

      if (response.ok) {
        onPostSaved()
      } else {
        setError(data.message || 'Failed to save post')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
  <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-4 sm:p-6 lg:p-10 shadow-lg max-w-2xl mx-auto">
      <h2 className="text-center mb-6 sm:mb-8 text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
        {editingPost ? 'Edit Post' : 'Create New Post'}
      </h2>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">{error}</div>}

  <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Images</label>
          <input
            type="file"
            multiple
            accept="image/*"
            onChange={handleImageChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
          />
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20 rounded overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
                  <img src={imageURLs[idx]} alt="preview" className="object-cover w-full h-full" />
                  <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute top-0 right-0 bg-white/80 text-gray-700 rounded-bl px-1 py-0.5 text-xs">&times;</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">Content</label>
          <textarea
            id="content"
            name="content"
            className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white min-h-64 sm:min-h-80 resize-y font-mono leading-relaxed"
            value={formData.content}
            onChange={handleChange}
            placeholder="Write your post content here..."
            required
          />
        </div>

        <div>
          <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">Tags (comma separated)</label>
          <input
            type="text"
            id="tags"
            name="tags"
            className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
            value={formData.tags}
            onChange={handleChange}
            placeholder="technology, programming, tutorial"
          />
        </div>

        {/* <div className="mb-6">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            id="status"
            name="status"
            className="w-full px-4 py-3 border border-gray-200 rounded-md text-base transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div> */}

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <button 
            type="submit" 
            className="flex-1 px-5 py-3 border-none rounded-md cursor-pointer text-base font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            disabled={loading}
          >
            {loading ? 'Saving...' : (editingPost ? 'Update Post' : 'Create Post')}
          </button>
          
          <button 
            type="button" 
            className="px-5 py-3 border border-gray-300 rounded-md cursor-pointer text-base font-medium tracking-wide transition-all duration-200 shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:border-gray-400 hover:-translate-y-0.5 hover:shadow-md"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default PostForm
