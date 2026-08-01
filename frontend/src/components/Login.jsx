import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { setAuthUser } from '@/redux/authSlice';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

const Login = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const { user } = useSelector(store => store.auth);

  useEffect(() => {
    if (user) navigate(from);
  }, [user, navigate]);

  const [input, setInput] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!input.email.trim()) next.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(input.email.trim())) next.email = 'Enter a valid email address.';
    if (!input.password) next.password = 'Password is required.';
    return next;
  };

  const handleInput = e => {
    setInput({ ...input, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: undefined });
  };

  const loginHandler = async e => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).some(k => next[k])) return;
    try {
      setLoading(true);
      const response = await axios.post('/api/v1/user/login', input, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });
      if (response.data.success) {
        dispatch(setAuthUser(response.data.user));
        navigate(from);
        toast.success(response.data.message);
        setInput({ email: '', password: '' });
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex min-h-screen w-full items-center justify-center bg-black px-4'>
      <div className='flex w-full max-w-sm flex-col gap-3'>
        <div className='rounded-lg border border-zinc-800 bg-black p-8'>
          <h1 className='mb-2 text-center text-3xl font-bold tracking-tight text-gray-100'>
            SastaGram
          </h1>
          <p className='mb-6 text-center text-sm text-zinc-400'>
            Log in to see photos and videos from your friends.
          </p>
          <form onSubmit={loginHandler} noValidate className='flex flex-col gap-4'>
            <div>
              <Label htmlFor='login-email' className='text-sm font-semibold text-gray-100'>
                Email
              </Label>
              <Input
                id='login-email'
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
              <Label htmlFor='login-password' className='text-sm font-semibold text-gray-100'>
                Password
              </Label>
              <Input
                id='login-password'
                type='password'
                name='password'
                autoComplete='current-password'
                value={input.password}
                onChange={handleInput}
                className='mt-1 focus-visible:ring-transparent'
              />
              {errors.password ? (
                <p className='mt-1 text-xs text-red-500'>{errors.password}</p>
              ) : null}
            </div>
            <Button
              type='submit'
              disabled={loading}
              className='mt-2 bg-blue-500 font-semibold text-white hover:bg-blue-600'
            >
              {loading ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                  Logging in...
                </>
              ) : (
                'Log in'
              )}
            </Button>
          </form>
        </div>
        <div className='rounded-lg border border-zinc-800 bg-black p-4 text-center text-sm text-gray-100'>
          Don't have an account?{' '}
          <Link to='/signup' className='font-semibold text-blue-400 hover:text-blue-300'>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
