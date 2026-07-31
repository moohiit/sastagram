import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

// Mirrors backend rules: username 3-30 chars of a-z A-Z 0-9 . _ -,
// valid email, password at least 8 characters.
const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,30}$/;
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const Signup = () => {
  const navigate = useNavigate();
  const { user } = useSelector(store => store.auth);

  useEffect(() => {
    if (user) navigate('/');
  }, [user, navigate]);

  const [input, setInput] = useState({ username: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!input.username.trim()) next.username = 'Username is required.';
    else if (!USERNAME_REGEX.test(input.username.trim()))
      next.username = 'Username must be 3-30 characters using letters, numbers, . _ or -';
    if (!input.email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(input.email.trim())) next.email = 'Enter a valid email address.';
    if (!input.password) next.password = 'Password is required.';
    else if (input.password.length < 8)
      next.password = 'Password must be at least 8 characters.';
    return next;
  };

  const handleInput = e => {
    setInput({ ...input, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: undefined });
  };

  const signupHandler = async e => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).some(k => next[k])) return;
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/user/register', input, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });
      if (response.data.success) {
        navigate('/login');
        toast.success(response.data.message);
        setInput({ username: '', email: '', password: '' });
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen w-full items-center justify-center bg-white px-4'>
      <div className='flex w-full max-w-sm flex-col gap-3'>
        <div className='rounded-lg border border-gray-200 bg-white p-8'>
          <h1 className='mb-2 text-center text-3xl font-bold tracking-tight text-gray-900'>
            SastaGram
          </h1>
          <p className='mb-6 text-center text-sm text-gray-500'>
            Sign up to see photos and videos from your friends.
          </p>
          <form onSubmit={signupHandler} noValidate className='flex flex-col gap-4'>
            <div>
              <Label htmlFor='signup-username' className='text-sm font-semibold text-gray-900'>
                Username
              </Label>
              <Input
                id='signup-username'
                type='text'
                name='username'
                autoComplete='username'
                value={input.username}
                onChange={handleInput}
                className='mt-1 focus-visible:ring-transparent'
              />
              {errors.username ? (
                <p className='mt-1 text-xs text-red-500'>{errors.username}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor='signup-email' className='text-sm font-semibold text-gray-900'>
                Email
              </Label>
              <Input
                id='signup-email'
                type='email'
                name='email'
                autoComplete='email'
                value={input.email}
                onChange={handleInput}
                className='mt-1 focus-visible:ring-transparent'
              />
              {errors.email ? (
                <p className='mt-1 text-xs text-red-500'>{errors.email}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor='signup-password' className='text-sm font-semibold text-gray-900'>
                Password
              </Label>
              <Input
                id='signup-password'
                type='password'
                name='password'
                autoComplete='new-password'
                value={input.password}
                onChange={handleInput}
                className='mt-1 focus-visible:ring-transparent'
              />
              {errors.password ? (
                <p className='mt-1 text-xs text-red-500'>{errors.password}</p>
              ) : (
                <p className='mt-1 text-xs text-gray-400'>At least 8 characters.</p>
              )}
            </div>
            <Button
              type='submit'
              disabled={loading}
              className='mt-2 bg-blue-500 font-semibold text-white hover:bg-blue-600'
            >
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Signing up...
                </>
              ) : (
                'Sign up'
              )}
            </Button>
          </form>
        </div>
        <div className='rounded-lg border border-gray-200 bg-white p-4 text-center text-sm text-gray-900'>
          Have an account?{' '}
          <Link to='/login' className='font-semibold text-blue-500 hover:text-blue-700'>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
