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
    <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 sm:p-8 lg:p-10 shadow-lg max-w-md sm:max-w-lg mx-auto">
      <h2 className="text-center mb-6 sm:mb-8 text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Login</h2>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button 
          type="submit" 
          className="w-full px-5 py-3 border-none rounded-md cursor-pointer text-base font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          disabled={loading}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {showVerificationPrompt && (
        <div className="text-center mt-6">
          <p className="text-gray-600 text-sm">
            Your email is not verified.{' '}
            <button className="text-gray-700 underline hover:text-gray-900 bg-transparent border-none cursor-pointer font-normal transition-colors duration-200" onClick={handleResendVerification}>
              Resend verification email
            </button>
          </p>
        </div>
      )}

      <div className="text-center mt-6 pt-6 border-t border-gray-200">
        <span className="text-gray-600 text-sm">Don't have an account? </span>
        <button className="text-gray-700 underline hover:text-gray-900 bg-transparent border-none cursor-pointer font-normal transition-colors duration-200" onClick={onSwitchToRegister}>
          Register here
        </button>
      </div>
    </div>
  )
}

export default LoginForm
