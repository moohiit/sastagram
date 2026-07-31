import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Compass, Heart, Home, PlusSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';

// Mobile-only (< 768px) fixed bottom navigation.
// Notifications navigates to /notifications, which marks everything read.
function BottomNav({ openCreate }) {
  const location = useLocation();
  const { user } = useSelector(store => store.auth);
  const { unreadCount } = useSelector(store => store.notification);

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const iconProps = (path) => ({
    size: 26,
    strokeWidth: isActive(path) ? 2.5 : 2,
  });

  const itemClass = 'flex flex-1 items-center justify-center py-2.5 text-gray-900';

  return (
    <nav className='md:hidden fixed bottom-0 inset-x-0 z-30 flex border-t border-gray-200 bg-white'>
      <Link to='/' aria-label='Home' className={itemClass}>
        <Home {...iconProps('/')} />
      </Link>
      <Link to='/explore' aria-label='Explore' className={itemClass}>
        <Compass {...iconProps('/explore')} />
      </Link>
      <button type='button' onClick={openCreate} aria-label='Create' className={itemClass}>
        <PlusSquare size={26} />
      </button>
      <Link to='/notifications' aria-label='Notifications' className={itemClass}>
        <span className='relative'>
          <Heart
            {...iconProps('/notifications')}
            fill={isActive('/notifications') ? 'currentColor' : 'none'}
          />
          {unreadCount > 0 && (
            <span className='absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none'>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
      </Link>
      <Link to={`/profile/${user?._id}`} aria-label='Profile' className={itemClass}>
        <Avatar
          className={`h-7 w-7 ${isActive(`/profile/${user?._id}`) ? 'ring-2 ring-gray-900' : ''}`}
        >
          <AvatarImage src={user?.profilePicture} alt={user?.username} />
          <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
      </Link>
    </nav>
  );
}

export default BottomNav;
