import { useNavigate, useLocation } from 'react-router-dom'

function Header({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <header className="header">
      <div className="header-content">
        <button 
          className="logo" 
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Simple Blog
        </button>
        
        <nav className="nav">
          {user ? (
            <>
              <span>Hello, {user.username}</span>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/create')}
              >
                Write Post
              </button>
              <button 
                className="btn btn-secondary"
                onClick={onLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button 
                className="btn btn-link"
                onClick={() => navigate('/login')}
              >
                Login
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/register')}
              >
                Register
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}

export default Header
