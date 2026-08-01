import React from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { setAuthUser, setSelectedUser } from '@/redux/authSlice';
import { setPosts } from '@/redux/postSlice';
import { setMessages, setOnlineUsers } from '@/redux/chatSlice';
import { clearNotifications } from '@/redux/rtnSlice';
import SuggestedUsers from './SuggestedUsers';

const FOOTER_LINKS = ['About', 'Help', 'API', 'Privacy', 'Terms'];

// Instagram-dark right column; rendered only on Home at >= 1160px.
// Guests see a signup prompt card instead (suggestions API requires auth).
function RightSidebar() {
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const logoutHandler = async () => {
    try {
      const response = await axios.get('/api/v1/user/logout', { withCredentials: true });
      if (response.data.success) {
        dispatch(setAuthUser(null));
        dispatch(setPosts([]));
        dispatch(setMessages([]));
        dispatch(setOnlineUsers([]));
        dispatch(setSelectedUser(null));
        dispatch(clearNotifications());
        toast.success(response.data.message);
        navigate('/login');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Logout failed');
    }
  };

  if (!user) {
    return (
      <div className='my-10 pr-2'>
        <div className='bg-black border border-zinc-800 rounded-lg p-4'>
          <p className='text-sm text-gray-100 mb-3'>
            New to SastaGram? Sign up to follow people and share photos.
          </p>
          <div className='flex items-center gap-2'>
            <Link to='/login'>
              <Button className='bg-blue-500 hover:bg-blue-600 h-8'>Log in</Button>
            </Link>
            <Link to='/signup'>
              <Button variant='secondary' className='h-8 font-semibold'>Sign up</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='my-10 pr-2'>
      {/* My profile row */}
      <div className='flex items-center gap-3 mb-5'>
        <Link to={`/profile/${user?._id}`} className='shrink-0'>
          <Avatar className='h-11 w-11'>
            <AvatarImage src={user?.profilePicture} alt={user?.username} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        <div className='min-w-0 flex-1'>
          <h1 className='text-sm font-semibold text-gray-100 truncate'>
            <Link to={`/profile/${user?._id}`}>{user?.username}</Link>
          </h1>
          <p className='text-sm text-zinc-400 truncate'>
            {user?.bio ? user.bio.split(/\s+/).slice(0, 5).join(' ') : 'SastaGram user'}
          </p>
        </div>
        <button
          type='button'
          onClick={logoutHandler}
          className='shrink-0 text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer'
        >
          Log out
        </button>
      </div>

      <SuggestedUsers variant='sidebar' />

      {/* Footer link cluster */}
      <nav className='mt-6 flex flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-zinc-600'>
        {FOOTER_LINKS.map((link, i) => (
          <React.Fragment key={link}>
            {i > 0 && <span aria-hidden='true'>&middot;</span>}
            <a href='#' className='hover:underline'>{link}</a>
          </React.Fragment>
        ))}
      </nav>
      <p className='mt-3 text-[11px] text-zinc-600 uppercase'>&copy; 2026 Sastagram</p>
    </div>
  );
}

export default RightSidebar;
