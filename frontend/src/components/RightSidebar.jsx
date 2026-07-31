import React from 'react';
import { useSelector } from 'react-redux';
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import SuggestedUsers from './SuggestedUsers';

// Suggested-users column; rendered only on Home at >= 1160px.
// Guests see a signup prompt card instead (suggestions API requires auth).
function RightSidebar() {
  const { user } = useSelector(store => store.auth);

  if (!user) {
    return (
      <div className='my-10 pr-2'>
        <div className='bg-white border border-gray-200 rounded-lg p-4'>
          <p className='text-sm text-gray-900 mb-3'>
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
