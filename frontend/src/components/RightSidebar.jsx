import React from 'react';
import { useSelector } from 'react-redux';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Link } from 'react-router-dom';
import SuggestedUsers from './SuggestedUsers';

// Suggested-users column; rendered only on Home at >= 1160px.
function RightSidebar() {
  const { user } = useSelector(store => store.auth);
  return (
    <div className='my-10 pr-2'>
      <div className='flex items-center gap-3 mb-5'>
        <Link to={`/profile/${user?._id}`}>
          <Avatar className='h-11 w-11'>
            <AvatarImage src={user?.profilePicture} alt={user?.username} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
        </Link>
        <div className='min-w-0'>
          <h1 className='text-sm font-semibold truncate'>
            <Link to={`/profile/${user?._id}`}>{user?.username}</Link>
          </h1>
          <p className='text-sm text-gray-500 truncate'>{user?.bio || 'SastaGram user'}</p>
        </div>
      </div>
      <SuggestedUsers />
    </div>
  );
}

export default RightSidebar;
