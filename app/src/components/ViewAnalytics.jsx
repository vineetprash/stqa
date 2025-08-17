
import { useState, useEffect } from 'react'
import { BASE_URL } from '../constants'

function ViewAnalytics() {
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const token = localStorage.getItem('token')

  useEffect(() => {
    fetchAnalytics()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/posts/analytics/views`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()

      if (response.ok) {
        setAnalytics(data.data)
      } else {
        setError(data.message || 'Failed to fetch analytics')
      }
    } catch (error) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading analytics...</div>
  if (error) return <div className="error">{error}</div>
  if (!analytics) return <div className="error">No analytics data available</div>

  return (
    <div className="analytics-container">
      <h2>View Analytics Dashboard</h2>
      
      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Last 24 Hours</h3>
          <div className="analytics-stats">
            <div className="stat">
              <span className="stat-label">Total Views:</span>
              <span className="stat-value">{analytics.last24Hours.totalViews}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Blocked Views:</span>
              <span className="stat-value blocked">{analytics.last24Hours.totalBlocked}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Block Rate:</span>
              <span className="stat-value">{analytics.last24Hours.blockRate}%</span>
            </div>
            <div className="stat">
              <span className="stat-label">Unique IPs:</span>
              <span className="stat-value">{analytics.last24Hours.uniqueIPs}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Posts Viewed:</span>
              <span className="stat-value">{analytics.last24Hours.uniquePosts}</span>
            </div>
          </div>
        </div>

        <div className="analytics-card">
          <h3>Security Status</h3>
          <div className="analytics-stats">
            <div className="stat">
              <span className="stat-label">Suspicious IPs:</span>
              <span className="stat-value suspicious">{analytics.suspiciousIPCount}</span>
            </div>
          </div>
          
          {analytics.suspiciousIPs.length > 0 && (
            <div className="suspicious-ips">
              <h4>Flagged IP Addresses:</h4>
              <ul>
                {analytics.suspiciousIPs.map((ip, index) => (
                  <li key={index} className="suspicious-ip">{ip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="analytics-card">
          <h3>Protection Status</h3>
          <div className="protection-status">
            <div className={`status-indicator ${analytics.last24Hours.blockRate > 10 ? 'warning' : 'good'}`}>
              {analytics.last24Hours.blockRate > 10 ? '⚠️ High Spam Activity' : '✅ Protection Active'}
            </div>
            <p>
              {analytics.last24Hours.blockRate > 10 
                ? 'Elevated spam activity detected. Monitor closely.'
                : 'View spam protection is working normally.'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="analytics-info">
        <h3>How View Protection Works</h3>
        <ul>
          <li><strong>Rate Limiting:</strong> Max 100 view requests per 15 minutes per IP</li>
          <li><strong>Cooldown Period:</strong> 30 minutes between counted views from same user/IP</li>
          <li><strong>Fingerprinting:</strong> Max 5 views per hour per device fingerprint</li>
          <li><strong>Author Protection:</strong> Authors cannot increase their own post views</li>
          <li><strong>Suspicious Activity:</strong> IPs are flagged for excessive spam attempts</li>
        </ul>
      </div>
    </div>
  )
}

export default ViewAnalytics
