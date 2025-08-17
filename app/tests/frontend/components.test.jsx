// tests/frontend/components.test.jsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import LoginForm from '../../js/app/src/components/LoginForm';
import PostList from '../../js/app/src/components/PostList';
import PostView from '../../js/app/src/components/PostView';

// Mock fetch for API calls
global.fetch = jest.fn();

const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('Frontend Components - Black Box Tests', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('LoginForm Component', () => {
    test('TC1.1.4: Login form renders correctly', () => {
      renderWithRouter(
        <LoginForm 
          onLogin={jest.fn()} 
          onSwitchToRegister={jest.fn()} 
        />
      );

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    test('TC1.1.4: Valid login submission calls API', async () => {
      const mockOnLogin = jest.fn();
      
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: { _id: '123', username: 'testuser', email: 'test@example.com' },
            token: 'mock-token'
          }
        })
      });

      renderWithRouter(
        <LoginForm 
          onLogin={mockOnLogin} 
          onSwitchToRegister={jest.fn()} 
        />
      );

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'Password123!' }
      });
      fireEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/login'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'test@example.com',
              password: 'Password123!'
            })
          })
        );
      });

      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith(
          expect.objectContaining({ username: 'testuser' }),
          'mock-token'
        );
      });
    });

    test('TC1.1.4: Error handling displays error message', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: 'Invalid credentials'
        })
      });

      renderWithRouter(
        <LoginForm 
          onLogin={jest.fn()} 
          onSwitchToRegister={jest.fn()} 
        />
      );

      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: 'test@example.com' }
      });
      fireEvent.change(screen.getByLabelText(/password/i), {
        target: { value: 'wrongpassword' }
      });
      fireEvent.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('PostList Component', () => {
    const mockPosts = [
      {
        _id: '1',
        title: 'Test Post 1',
        content: 'Content 1',
        author: { _id: 'author1', username: 'author1' },
        publishedAt: new Date().toISOString(),
        views: 5,
        tags: ['tag1', 'tag2']
      },
      {
        _id: '2',
        title: 'Test Post 2',
        content: 'Content 2',
        author: { _id: 'author2', username: 'author2' },
        publishedAt: new Date().toISOString(),
        views: 10,
        tags: []
      }
    ];

    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { posts: mockPosts }
        })
      });
    });

    test('TC1.2.1: PostList renders posts correctly', async () => {
      renderWithRouter(
        <PostList 
          user={null}
          onEditPost={jest.fn()}
          onViewPost={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Post 1')).toBeInTheDocument();
        expect(screen.getByText('Test Post 2')).toBeInTheDocument();
      });
    });

    test('TC1.2.2: Edit buttons visible only for post author', async () => {
      const currentUser = { _id: 'author1', username: 'author1' };

      renderWithRouter(
        <PostList 
          user={currentUser}
          onEditPost={jest.fn()}
          onViewPost={jest.fn()}
        />
      );

      await waitFor(() => {
        // Should show edit button for user's own post
        const editButtons = screen.queryAllByText(/edit/i);
        expect(editButtons).toHaveLength(1);
      });
    });

    test('TC1.2.2: No edit buttons for non-author', async () => {
      const currentUser = { _id: 'different-user', username: 'different' };

      renderWithRouter(
        <PostList 
          user={currentUser}
          onEditPost={jest.fn()}
          onViewPost={jest.fn()}
        />
      );

      await waitFor(() => {
        const editButtons = screen.queryAllByText(/edit/i);
        expect(editButtons).toHaveLength(0);
      });
    });

    test('TC1.3.1: Post click triggers navigation', async () => {
      const mockOnViewPost = jest.fn();

      renderWithRouter(
        <PostList 
          user={null}
          onEditPost={jest.fn()}
          onViewPost={mockOnViewPost}
        />
      );

      await waitFor(() => {
        fireEvent.click(screen.getByText('Test Post 1'));
        expect(mockOnViewPost).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('PostView Component', () => {
    const mockPost = {
      _id: '123',
      title: 'Test Post Title',
      content: '# Heading\n\nThis is **markdown** content.',
      author: { _id: 'author1', username: 'testauthor' },
      publishedAt: new Date().toISOString(),
      views: 15,
      tags: ['react', 'testing']
    };

    beforeEach(() => {
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { post: mockPost },
          meta: { viewCounted: true, suspiciousActivity: false }
        })
      });
    });

    test('TC1.2.3: PostView renders markdown correctly', async () => {
      renderWithRouter(
        <PostView 
          postId="123"
          user={null}
          onBack={jest.fn()}
          onEditPost={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Test Post Title')).toBeInTheDocument();
        expect(screen.getByText('Heading')).toBeInTheDocument();
        expect(screen.getByText(/markdown/)).toBeInTheDocument();
      });
    });

    test('TC1.2.3: View tracking API is called', async () => {
      renderWithRouter(
        <PostView 
          postId="123"
          user={null}
          onBack={jest.fn()}
          onEditPost={jest.fn()}
        />
      );

      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/posts/view/123'),
          expect.objectContaining({
            method: 'POST'
          })
        );
      });
    });

    test('TC1.3.2: Component is responsive', () => {
      // Mock window.matchMedia for responsive testing
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query.includes('768px'),
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      renderWithRouter(
        <PostView 
          postId="123"
          user={null}
          onBack={jest.fn()}
          onEditPost={jest.fn()}
        />
      );

      // Test that component renders without breaking on mobile
      expect(screen.queryByText(/loading/i)).toBeInTheDocument();
    });
  });
});

describe('Frontend Components - White Box Tests', () => {
  describe('TC2.2.1: React State Management', () => {
    test('LoginForm state updates correctly', () => {
      renderWithRouter(
        <LoginForm 
          onLogin={jest.fn()} 
          onSwitchToRegister={jest.fn()} 
        />
      );

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);

      // Test state updates through input changes
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });

      expect(emailInput.value).toBe('test@example.com');
      expect(passwordInput.value).toBe('password123');
    });

    test('PostList loading state management', async () => {
      // Mock slow API response
      fetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({ success: true, data: { posts: [] } })
          }), 100)
        )
      );

      renderWithRouter(
        <PostList 
          user={null}
          onEditPost={jest.fn()}
          onViewPost={jest.fn()}
        />
      );

      // Should show loading initially
      expect(screen.getByText(/loading/i)).toBeInTheDocument();

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('TC2.2.2: Event Handler Logic', () => {
    test('Form submission prevents multiple calls', async () => {
      const mockOnLogin = jest.fn();
      
      fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { user: {}, token: 'token' }
        })
      });

      renderWithRouter(
        <LoginForm 
          onLogin={mockOnLogin} 
          onSwitchToRegister={jest.fn()} 
        />
      );

      const submitButton = screen.getByRole('button', { name: /login/i });
      
      // Rapid clicks should not cause multiple submissions
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);
      fireEvent.click(submitButton);

      // Should be disabled during loading
      expect(submitButton).toBeDisabled();
    });
  });
});
