import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Login } from './Login';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Mock the modules
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Wrapper for routing
const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  );
};

describe('Login Page', () => {
  const mockLogin = vi.fn();
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock behavior for useAuth
    (useAuth as any).mockReturnValue({
      login: mockLogin,
    });

    // Setup default mock behavior for useNavigate
    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  it('renders login form elements', () => {
    renderLogin();
    
    expect(screen.getByText(/System Login/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AUTHENTICATE/i })).toBeInTheDocument();
  });

  it('handles input changes', () => {
    renderLogin();
    
    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('password123');
  });

  it('submits form with credentials', async () => {
    renderLogin();
    
    const usernameInput = screen.getByLabelText(/Username/i);
    const passwordInput = screen.getByLabelText(/Password/i);
    const submitButton = screen.getByRole('button', { name: /AUTHENTICATE/i });

    fireEvent.change(usernameInput, { target: { value: 'testuser' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'password123',
      });
    });
  });

  it('navigates to dashboard on successful login', async () => {
    mockLogin.mockResolvedValueOnce({}); // Success
    renderLogin();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    
    const submitButton = screen.getByRole('button', { name: /AUTHENTICATE/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('displays error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Failed'));
    renderLogin();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'testuser' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    
    const submitButton = screen.getByRole('button', { name: /AUTHENTICATE/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
      expect(screen.getByText(/Invalid username or password/i)).toBeInTheDocument();
    });
  });
});
