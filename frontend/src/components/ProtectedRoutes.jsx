import { useEffect } from 'react'
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux'
import { setAuthUser } from '@/redux/authSlice';

// Session gate for the whole app shell. Guests are allowed to browse —
// this only verifies a PERSISTED session against the server and clears it
// if the cookie has expired (RequireAuth handles pages that need a user).
const ProtectedRoutes = ({ children }) => {
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const verifySession = async () => {
      try {
        await axios.get('/api/v1/user/me', { withCredentials: true });
      } catch (error) {
        if (!cancelled && error.response?.status === 401) {
          dispatch(setAuthUser(null));
        }
      }
    };
    verifySession();
    return () => { cancelled = true; };
  }, []);

  return <>{children}</>;
}

export default ProtectedRoutes
