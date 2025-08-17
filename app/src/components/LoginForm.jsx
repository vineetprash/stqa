import { useState } from 'react'
import { BASE_URL } from '../constants'

function LoginForm({ onLogin, onSwitchToRegister }) {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showVerificationPrompt, setShowVerificationPrompt] = useState(false)
  const [unverifiedUserId, setUnverifiedUserId] = useState('')

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
    setShowVerificationPrompt(false)

    try {
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        onLogin(data.data.user, data.data.token)
      } else {
        if (data.requiresVerification) {
          setShowVerificationPrompt(true)
          setUnverifiedUserId(data.userId)
        }
        setError(data.message || 'Login failed')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: unverifiedUserId })
      })

      const data = await response.json()

      if (response.ok) {
        setError('Verification email sent! Please check your inbox.')
      } else {
        setError(data.message || 'Failed to send verification email')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    }
  }

  return (
    <div className="auth-form">
      <h2 className="text-center mb-2">Login</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            className="form-input"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            className="form-input"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%' }}
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {showVerificationPrompt && (
        <div className="text-center mt-1">
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            Your email is not verified.{' '}
            <button className="btn-link" onClick={handleResendVerification}>
              Resend verification email
            </button>
          </p>
        </div>
      )}

      <div className="text-center mt-1">
        Don't have an account?{' '}
        <button className="btn-link" onClick={onSwitchToRegister}>
          Register here
        </button>
      </div>
    </div>
  )
}

export default LoginForm
