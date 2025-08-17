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
    <div className="auth-form">
      <div className="registration-steps">
        <div className={`step ${currentStep === 1 ? 'active' : 'completed'}`}>
          <div className="step-number">1</div>
          <div className="step-title">Details</div>
        </div>
        <div className="step-separator"></div>
        <div className={`step ${currentStep === 2 ? 'active' : ''}`}>
          <div className="step-number">2</div>
          <div className="step-title">Verify Email</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {currentStep === 1 && (
        <>
          <h2 className="text-center mb-2">Create Account</h2>
          <form onSubmit={handleStep1Submit}>
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                className="form-input"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                className="form-input"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                className="form-input"
                value={formData.username}
                onChange={handleChange}
                required
              />
            </div>

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
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Continue'}
            </button>
          </form>
        </>
      )}

      {currentStep === 2 && (
        <>
          <h2 className="text-center mb-2">Verify Your Email</h2>
          <p className="text-center mb-2" style={{ color: '#666' }}>
            We've sent a 6-digit code to {formData.email}
          </p>
          
          <form onSubmit={handleStep2Submit}>
            <div className="form-group">
              <label htmlFor="otp">Enter OTP</label>
              <input
                type="text"
                id="otp"
                name="otp"
                className="form-input"
                value={otpData.otp}
                onChange={handleOtpChange}
                placeholder="123456"
                maxLength={6}
                required
                style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '2px' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
          </form>

          <div className="text-center mt-1">
            <p style={{ color: '#666', fontSize: '0.9rem' }}>
              Didn't receive the code?{' '}
              <button 
                className="btn-link" 
                onClick={handleResendOtp}
                disabled={resendLoading}
              >
                {resendLoading ? 'Sending...' : 'Resend OTP'}
              </button>
            </p>
            
            <button 
              className="btn-link" 
              onClick={handleBackToStep1}
            >
              ← Back to details
            </button>
          </div>
        </>
      )}

      <div className="text-center mt-1">
        Already have an account?{' '}
        <button className="btn-link" onClick={onSwitchToLogin}>
          Login here
        </button>
      </div>
    </div>
  )
}

export default StepwiseRegistration
