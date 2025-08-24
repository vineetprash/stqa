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
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 px-4 sm:px-8 py-4 mb-8 shadow-sm relative z-[1000]">
      <div className="max-w-4xl mx-auto flex justify-between items-center flex-wrap gap-4 relative">
        {/* Logo with SVG icon */}
        <button 
          className="flex items-center gap-2 text-xl sm:text-2xl font-semibold text-gray-900 no-underline tracking-tight bg-none border-none cursor-pointer p-0"
          onClick={() => handleNavigation('/')}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 24 24" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 text-gray-900"
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
          <span className="font-semibold hidden md:inline tracking-tight">Simple Blogs</span>
        </button>
        
        {/* Hamburger Menu Button */}
        <button 
          className={`md:hidden flex flex-col bg-none border-none cursor-pointer p-1 w-7 h-7 justify-around z-[10000] ${isMenuOpen ? 'hamburger-open' : ''}`}
          onClick={toggleMenu}
          aria-label="Toggle menu"
        >
          <span className={`block h-0.5 w-full bg-gray-900 rounded-sm transition-all duration-300 origin-center ${isMenuOpen ? 'rotate-45 translate-x-1.5 translate-y-1.5' : ''}`}></span>
          <span className={`block h-0.5 w-full bg-gray-900 rounded-sm transition-all duration-300 origin-center ${isMenuOpen ? 'opacity-0' : ''}`}></span>
          <span className={`block h-0.5 w-full bg-gray-900 rounded-sm transition-all duration-300 origin-center ${isMenuOpen ? '-rotate-45 translate-x-1.5 -translate-y-1.5' : ''}`}></span>
        </button>
        
        {/* Navigation */}
        <nav className={`flex gap-4 items-center flex-wrap md:static md:flex md:w-auto md:h-auto md:bg-transparent md:backdrop-blur-none md:shadow-none md:p-0 md:border-none fixed top-0 w-72 h-screen bg-white/98 backdrop-blur-xl shadow-lg pt-20 px-8 pb-8 z-[9999] transition-all duration-300 border-l border-gray-200 ${isMenuOpen ? 'right-0' : '-right-full'}`}>
          <div className="flex flex-wrap md:flex-row md:items-center md:gap-4 md:w-auto flex-col items-stretch gap-6 w-full">
            {user ? (
              <>
                <span className="text-gray-600 font-medium md:text-left md:p-0 md:bg-transparent md:rounded-none md:mb-0 text-center p-4 bg-black/5 rounded-lg mb-2">Hello, {user.username}</span>
                <button 
                  className="px-5 py-2.5 border-none rounded-md cursor-pointer font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white hover:bg-gradient-to-br hover:from-gray-700 hover:to-gray-800 hover:-translate-y-0.5 hover:shadow-md md:w-auto md:p-2.5 md:justify-start md:text-sm w-full p-4 justify-center text-base"
                  onClick={() => handleNavigation('/create')}
                >
                  Write Post
                </button>
                <button 
                  className="px-5 py-2.5 border border-gray-300 rounded-md cursor-pointer font-medium tracking-wide transition-all duration-200 shadow-sm bg-gray-100 text-gray-700 hover:bg-gray-200 hover:border-gray-400 hover:-translate-y-0.5 md:w-auto md:p-2.5 md:justify-start md:text-sm w-full p-4 justify-center text-base"
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
                  className="px-5 py-2.5 border-none rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-transparent text-gray-700 border border-transparent hover:bg-gray-100 hover:text-gray-900 hover:shadow-md active:scale-95 max-md:w-full max-md:p-4 max-md:justify-center max-md:text-base"
                  onClick={() => handleNavigation('/login')}
                >
                  Login
                </button>
                <button 
                  className="px-5 py-2.5 border-none rounded-md cursor-pointer text-sm font-medium tracking-wide transition-all duration-200 shadow-sm bg-gradient-to-br from-gray-800 to-gray-900 text-white border border-transparent hover:shadow-md hover:from-gray-700 hover:to-gray-800 active:scale-95 max-md:w-full max-md:p-4 max-md:justify-center max-md:text-base"
                  onClick={() => handleNavigation('/register')}
                >
                  Register
                </button>
              </>
            )}
          </div>
        </nav>
        
        {/* Overlay for mobile menu */}
        {isMenuOpen && <div className="block max-md:block max-md:fixed max-md:top-0 max-md:left-0 max-md:w-screen max-md:h-screen max-md:bg-black/50 max-md:z-[9998] max-md:opacity-100 md:hidden" onClick={closeMenu}></div>}
      </div>
    </header>
  )
}

export default Header
