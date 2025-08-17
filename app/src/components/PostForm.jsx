import { useState, useEffect } from 'react'
import { BASE_URL } from '../constants'

function PostForm({ user, editingPost, onPostSaved, onCancel }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: '',
    status: 'published'
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

      const postData = {
        title: formData.title,
        content: formData.content,
        tags: tags,
        status: formData.status
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postData)
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
    <div className="post-form">
      <h2 className="text-center mb-2">
        {editingPost ? 'Edit Post' : 'Create New Post'}
      </h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            className="form-input"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Content</label>
          <textarea
            id="content"
            name="content"
            className="form-textarea"
            value={formData.content}
            onChange={handleChange}
            placeholder="Write your post content here..."
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="tags">Tags (comma separated)</label>
          <input
            type="text"
            id="tags"
            name="tags"
            className="form-input"
            value={formData.tags}
            onChange={handleChange}
            placeholder="technology, programming, tutorial"
          />
        </div>

        {/* <div className="form-group">
          <label htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            className="form-input"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div> */}

        <div className="form-buttons">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : (editingPost ? 'Update Post' : 'Create Post')}
          </button>
          
          <button 
            type="button" 
            className="btn btn-secondary"
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
