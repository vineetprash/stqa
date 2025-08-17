import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function Header({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const closeMenu = () => {
    setIsMenuOpen(false)
  }

  const handleNavigation = (path) => {
    navigate(path)
    closeMenu()
  }

  return (
    <header className="header">
      <div className="header-content">
        {/* Logo with SVG icon */}
        <button 
          className="logo" 
          onClick={() => handleNavigation('/')}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="logo-icon"
          >
            <path 
              d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M9 9H15" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M9 13H15" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            <path 
              d="M9 17H11" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
          <span className="logo-text">Simple Blogs</span>
        </button>
        
        {/* Hamburger Menu Button */}
        <button 
          className={`hamburger ${isMenuOpen ? 'open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        {/* Navigation */}
        <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
          <div className="nav-content">
            {user ? (
              <>
                <span className="user-greeting">Hello, {user.username}</span>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleNavigation('/create')}
                >
                  Write Post
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    onLogout()
                    closeMenu()
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button 
                  className="btn btn-link"
                  onClick={() => handleNavigation('/login')}
                >
                  Login
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleNavigation('/register')}
                >
                  Register
                </button>
              </>
            )}
          </div>
        </nav>
        
        {/* Overlay for mobile menu */}
        {isMenuOpen && <div className="nav-overlay" onClick={closeMenu}></div>}
      </div>
    </header>
  )
}

export default Header
