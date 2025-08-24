
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

  if (loading) return <div className="text-center text-gray-600 py-8">Loading analytics...</div>
  if (error) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">{error}</div>
  if (!analytics) return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6 text-sm">No analytics data available</div>

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-8 text-center sm:text-left">View Analytics Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Last 24 Hours</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">Total Views:</span>
              <span className="text-lg font-bold text-gray-900">{analytics.last24Hours.totalViews}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">Blocked Views:</span>
              <span className="text-lg font-bold text-red-600">{analytics.last24Hours.totalBlocked}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">Block Rate:</span>
              <span className="text-lg font-bold text-gray-900">{analytics.last24Hours.blockRate}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">Unique IPs:</span>
              <span className="text-lg font-bold text-gray-900">{analytics.last24Hours.uniqueIPs}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">Posts Viewed:</span>
              <span className="text-lg font-bold text-gray-900">{analytics.last24Hours.uniquePosts}</span>
            </div>
          </div>
        </div>

        <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Security Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 font-medium">Suspicious IPs:</span>
              <span className="text-lg font-bold text-yellow-600">{analytics.suspiciousIPCount}</span>
            </div>
          </div>
          
          {analytics.suspiciousIPs.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Flagged IP Addresses:</h4>
              <ul className="space-y-1">
                {analytics.suspiciousIPs.map((ip, index) => (
                  <li key={index} className="text-xs font-mono bg-yellow-50 text-yellow-800 px-2 py-1 rounded border">{ip}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-lg md:col-span-2 lg:col-span-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Protection Status</h3>
          <div className="text-center">
            <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium mb-3 ${analytics.last24Hours.blockRate > 10 ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
              {analytics.last24Hours.blockRate > 10 ? '⚠️ High Spam Activity' : '✅ Protection Active'}
            </div>
            <p className="text-sm text-gray-600">
              {analytics.last24Hours.blockRate > 10 
                ? 'Elevated spam activity detected. Monitor closely.'
                : 'View spam protection is working normally.'
              }
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white/95 backdrop-blur-sm border border-white/20 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">How View Protection Works</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start"><span className="font-semibold text-gray-900 mr-2">Rate Limiting:</span> Max 100 view requests per 15 minutes per IP</li>
          <li className="flex items-start"><span className="font-semibold text-gray-900 mr-2">Cooldown Period:</span> 30 minutes between counted views from same user/IP</li>
          <li className="flex items-start"><span className="font-semibold text-gray-900 mr-2">Fingerprinting:</span> Max 5 views per hour per device fingerprint</li>
          <li className="flex items-start"><span className="font-semibold text-gray-900 mr-2">Author Protection:</span> Authors cannot increase their own post views</li>
          <li className="flex items-start"><span className="font-semibold text-gray-900 mr-2">Suspicious Activity:</span> IPs are flagged for excessive spam attempts</li>
        </ul>
      </div>
    </div>
  )
}

export default ViewAnalytics
