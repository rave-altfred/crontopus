import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Register from './Register';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';

// Mock the modules
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Wrapper for routing
const renderRegister = () => {
  return render(
    <BrowserRouter>
      <Register />
    </BrowserRouter>
  );
};

describe('Register Page', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    (useAuth as any).mockReturnValue({
      login: mockLogin,
    });

    (useNavigate as any).mockReturnValue(mockNavigate);
  });

  it('renders register form elements', () => {
    renderRegister();
    
    expect(screen.getByRole('heading', { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });

  it('handles input changes', () => {
    renderRegister();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });

    expect(screen.getByLabelText(/Username/i)).toHaveValue('newuser');
    expect(screen.getByLabelText(/Email address/i)).toHaveValue('new@example.com');
    expect(screen.getByLabelText(/^Password/i)).toHaveValue('password123');
    expect(screen.getByLabelText(/Confirm Password/i)).toHaveValue('password123');
  });

  it('validates mismatching passwords', async () => {
    renderRegister();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password456' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Passwords do not match/i)).toBeInTheDocument();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('validates password length', async () => {
    renderRegister();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'short' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText(/Password must be at least 8 characters/i)).toBeInTheDocument();
    });
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('submits form successfully', async () => {
    (apiClient.post as any).mockResolvedValue({});
    mockLogin.mockResolvedValue({});

    renderRegister();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/auth/register', {
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123'
      });
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'newuser',
        password: 'password123'
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('displays error on registration failure', async () => {
    const errorMessage = 'Username already taken';
    (apiClient.post as any).mockRejectedValue({
      response: { data: { detail: errorMessage } }
    });

    renderRegister();
    
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'new@example.com' } });
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Create Account/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});
