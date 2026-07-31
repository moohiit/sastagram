import React, { useState } from 'react';
import { Compass, Heart, Home, Instagram, LogIn, LogOut, MessageCircle, PlusSquare, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setAuthUser, setSelectedUser } from '@/redux/authSlice';
import { setPosts } from '@/redux/postSlice';
import { setMessages, setOnlineUsers } from '@/redux/chatSlice';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { clearNotifications, markAllRead } from '@/redux/rtnSlice';
import NotificationItem from './NotificationItem';

const itemClass =
  'flex items-center gap-4 w-full rounded-lg p-3 my-0.5 cursor-pointer hover:bg-gray-100 transition-colors text-gray-900';

// Desktop/tablet navigation: 244px sidebar >=1264px, 72px icon rail 768-1263px,
// hidden below 768px (TopBar + BottomNav take over).
function LeftSidebar({ openCreate }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector(store => store.auth);
  const { notifications, unreadCount } = useSelector(store => store.notification);
  const [notifOpen, setNotifOpen] = useState(false);

  // Mark everything read on the server and zero the badge
  const markNotificationsRead = async () => {
    dispatch(markAllRead());
    try {
      await axios.patch('/api/v1/notification/read', {}, { withCredentials: true });
    } catch (error) {
      console.log(error);
    }
  };

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

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const navItems = user
    ? [
        { text: 'Home', path: '/', icon: Home },
        { text: 'Search', path: '/search', icon: Search },
        { text: 'Explore', path: '/explore', icon: Compass },
        { text: 'Messages', path: '/messages', icon: MessageCircle },
      ]
    : [
        { text: 'Home', path: '/', icon: Home },
        { text: 'Search', path: '/search', icon: Search },
        { text: 'Explore', path: '/explore', icon: Compass },
      ];

  const label = (text, active) => (
    <span className={`hidden min-[1264px]:inline text-[15px] ${active ? 'font-bold' : ''}`}>
      {text}
    </span>
  );

  const profileActive = isActive(`/profile/${user?._id}`);

  return (
    <aside className='hidden md:flex fixed left-0 top-0 z-30 h-screen w-[72px] min-[1264px]:w-[244px] flex-col border-r border-gray-200 bg-white px-3 pt-6 pb-5'>
      <Link
        to='/'
        className='flex items-center gap-2 px-3 py-3 mb-4 text-gray-900'
        title='SastaGram'
      >
        <Instagram size={26} className='shrink-0' />
        <span className='hidden min-[1264px]:inline font-bold text-xl tracking-tight'>
          SastaGram
        </span>
      </Link>

      <nav className='flex flex-col flex-1'>
        {navItems.map(({ text, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Link key={text} to={path} title={text} aria-label={text} className={itemClass}>
              <Icon size={26} strokeWidth={active ? 2.5 : 2} className='shrink-0' />
              {label(text, active)}
            </Link>
          );
        })}

        {user && (
        <>
        <Popover
          open={notifOpen}
          onOpenChange={(isOpen) => {
            setNotifOpen(isOpen);
            if (isOpen) markNotificationsRead();
          }}
        >
          <PopoverTrigger asChild>
            <button type='button' title='Notifications' aria-label='Notifications' className={itemClass}>
              <span className='relative shrink-0'>
                <Heart
                  size={26}
                  strokeWidth={notifOpen ? 2.5 : 2}
                  fill={notifOpen ? 'currentColor' : 'none'}
                />
                {unreadCount > 0 && (
                  <span className='absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none'>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </span>
              {label('Notifications', notifOpen)}
            </button>
          </PopoverTrigger>
          <PopoverContent side='right' align='start' className='w-80 max-h-96 overflow-y-auto'>
            <h3 className='font-semibold text-base mb-2'>Notifications</h3>
            {notifications.length === 0 ? (
              <p className='text-sm text-gray-500'>No new notification</p>
            ) : (
              notifications.map((notification) => (
                <NotificationItem key={notification._id} notification={notification} />
              ))
            )}
          </PopoverContent>
        </Popover>

        <button type='button' onClick={openCreate} title='Create' aria-label='Create' className={itemClass}>
          <PlusSquare size={26} className='shrink-0' />
          {label('Create', false)}
        </button>

        <Link
          to={`/profile/${user?._id}`}
          title='Profile'
          aria-label='Profile'
          className={itemClass}
        >
          <Avatar className={`h-8 w-8 shrink-0 ${profileActive ? 'ring-2 ring-gray-900' : ''}`}>
            <AvatarImage src={user?.profilePicture} alt={user?.username} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          {label('Profile', profileActive)}
        </Link>
        </>
        )}

        {!user && (
          <div className='mt-4 flex flex-col items-center min-[1264px]:items-stretch gap-3 px-1'>
            <Link
              to='/login'
              title='Log in'
              aria-label='Log in'
              className='flex items-center justify-center gap-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-semibold text-sm h-10 w-10 min-[1264px]:w-full transition-colors'
            >
              <LogIn size={20} className='shrink-0' />
              <span className='hidden min-[1264px]:inline'>Log in</span>
            </Link>
            <Link
              to='/signup'
              className='hidden min-[1264px]:block text-center text-sm font-semibold text-blue-500 hover:text-blue-700'
            >
              Sign up
            </Link>
          </div>
        )}
      </nav>

      {user && (
        <button type='button' onClick={logoutHandler} title='Logout' aria-label='Logout' className={itemClass}>
          <LogOut size={26} className='shrink-0' />
          {label('Logout', false)}
        </button>
      )}
    </aside>
  );
}

export default LeftSidebar;
