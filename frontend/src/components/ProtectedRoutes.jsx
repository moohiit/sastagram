import React, { useEffect } from 'react'
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom';
import { setAuthUser } from '@/redux/authSlice';

const ProtectedRoutes = ({ children }) => {
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user])

  // Verify the persisted session against the server in the background.
  // Render immediately for good UX; only kick to /login on a real 401.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const verifySession = async () => {
      try {
        await axios.get('/api/v1/user/me', { withCredentials: true });
      } catch (error) {
        if (!cancelled && error.response?.status === 401) {
          dispatch(setAuthUser(null));
          navigate('/login');
        }
      }
    };
    verifySession();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      {children}
    </>
  )
}

export default ProtectedRoutes
