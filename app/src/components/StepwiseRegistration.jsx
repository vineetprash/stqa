import { useState } from 'react'
import { BASE_URL } from '../constants'

function StepwiseRegistration({ onLogin, onSwitchToLogin }) {
  const [currentStep, setCurrentStep] = useState(1) // 1: Details, 2: OTP
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    firstName: '',
    lastName: ''
  })
  const [otpData, setOtpData] = useState({
    otp: '',
    userId: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleOtpChange = (e) => {
    setOtpData({
      ...otpData,
      [e.target.name]: e.target.value
    })
  }

  const handleStep1Submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setOtpData({
          ...otpData,
          userId: data.data.userId
        })
        setCurrentStep(2)
      } else {
        setError(data.message || 'Registration failed')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleStep2Submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(otpData)
      })

      const data = await response.json()

      if (response.ok) {
        onLogin(data.data.user, data.data.token)
      } else {
        setError(data.message || 'OTP verification failed')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOtp = async () => {
    setError('')
    setResendLoading(true)

    try {
      const response = await fetch(`${BASE_URL}/api/auth/resend-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId: otpData.userId })
      })

      const data = await response.json()

      if (response.ok) {
        setError('') // Clear any existing errors
        // Show success message (you could add a success state if needed)
      } else {
        setError(data.message || 'Failed to resend OTP')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleBackToStep1 = () => {
    setCurrentStep(1)
    setOtpData({ otp: '', userId: '' })
    setError('')
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 sm:p-10 shadow-lg max-w-md sm:max-w-lg mx-auto">
      <div className="flex items-center justify-center mb-8">
        <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-sm sm:text-base font-semibold border-2 transition-all duration-200 ${currentStep === 1 ? 'bg-gray-800 text-white border-gray-800' : 'bg-green-500 text-white border-green-500'}`}>
          {currentStep === 1 ? '1' : '✓'}
        </div>
        <div className="text-xs sm:text-sm font-medium text-gray-700 ml-2 mr-4">Details</div>
        <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
        <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full text-sm sm:text-base font-semibold border-2 transition-all duration-200 ${currentStep === 2 ? 'bg-gray-800 text-white border-gray-800' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
          2
        </div>
        <div className="text-xs sm:text-sm font-medium text-gray-700 ml-2">Verify Email</div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">{error}</div>}

      {currentStep === 1 && (
        <>
          <h2 className="text-center mb-8 text-2xl font-semibold text-gray-900 tracking-tight">Create Account</h2>
          <form onSubmit={handleStep1Submit} className="space-y-6">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                className="w-full px-4 py-3 border border-gray-200 rounded-md text-base bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

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
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              className="w-full px-5 py-3 border-none rounded-md cursor-pointer text-base font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Continue'}
            </button>
          </form>
        </>
      )}

      {currentStep === 2 && (
        <>
          <h2 className="text-center mb-4 text-2xl font-semibold text-gray-900 tracking-tight">Verify Your Email</h2>
          <p className="text-center mb-8 text-gray-600 text-sm sm:text-base">
            We've sent a 6-digit code to {formData.email}
          </p>
          
          <form onSubmit={handleStep2Submit} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
              <input
                type="text"
                id="otp"
                name="otp"
                className="w-full px-4 py-4 border border-gray-200 rounded-md text-xl bg-white/80 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent focus:bg-white text-center tracking-widest font-mono"
                value={otpData.otp}
                onChange={handleOtpChange}
                placeholder="123456"
                maxLength={6}
                required
              />
            </div>

            <button 
              type="submit" 
              className="w-full px-5 py-3 border-none rounded-md cursor-pointer text-base font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          <div className="text-center mt-6 space-y-3">
            <p className="text-gray-600 text-sm">
              Didn't receive the code?{' '}
              <button 
                className="text-gray-700 underline hover:text-gray-900 bg-transparent border-none cursor-pointer font-normal transition-colors duration-200"
                onClick={handleResendOtp}
                disabled={resendLoading}
              >
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </button>
            </p>
            
            <button 
              className="text-gray-700 underline hover:text-gray-900 bg-transparent border-none cursor-pointer font-normal transition-colors duration-200"
              onClick={handleBackToStep1}
            >
              ← Back to details
            </button>
          </div>
        </>
      )}

      <div className="text-center mt-6 pt-6 border-t border-gray-200">
        <span className="text-gray-600 text-sm">Already have an account? </span>
        <button className="text-gray-700 underline hover:text-gray-900 bg-transparent border-none cursor-pointer font-normal transition-colors duration-200" onClick={onSwitchToLogin}>
          Login here
        </button>
      </div>
    </div>
  )
}

export default StepwiseRegistration
