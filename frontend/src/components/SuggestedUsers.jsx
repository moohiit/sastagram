import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cdn } from '@/lib/cdn';
import UserRow from './profile/UserRow';
import FollowButton from './profile/FollowButton';

// variant="sidebar" renders the Instagram-dark right-sidebar layout:
// "Suggested for you" header + "See all", 44px avatar rows with a textual
// blue Follow link. The default variant (Search page) keeps UserRow rows.
const SuggestedUsers = ({ variant = 'default' }) => {
  const { suggestedUsers } = useSelector(store => store.auth);

  if (!suggestedUsers || suggestedUsers.length === 0) return null;

  if (variant === 'sidebar') {
    return (
      <div>
        <div className='flex items-center justify-between mb-2'>
          <h2 className='text-sm font-semibold text-zinc-400'>Suggested for you</h2>
          <Link to='/search' className='text-xs font-semibold text-gray-100 hover:text-zinc-400'>
            See all
          </Link>
        </div>
        {suggestedUsers.map(suggestedUser => (
          <div key={suggestedUser._id} className='flex items-center gap-3 py-2'>
            <Link to={`/profile/${suggestedUser._id}`} className='shrink-0'>
              <Avatar className='h-11 w-11'>
                <AvatarImage src={cdn(suggestedUser.profilePicture, 100)} alt={suggestedUser.username} />
                <AvatarFallback>{suggestedUser.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
            <div className='min-w-0 flex-1'>
              <Link
                to={`/profile/${suggestedUser._id}`}
                className='block text-sm font-semibold text-gray-100 truncate hover:opacity-80'
              >
                {suggestedUser.username}
              </Link>
              <p className='text-xs text-zinc-500 truncate'>Suggested for you</p>
            </div>
            <FollowButton userId={suggestedUser._id} variant='link' className='shrink-0' />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h2 className='mb-1 px-1 text-sm font-semibold text-zinc-400'>Suggested for you</h2>
      {suggestedUsers.map(suggestedUser => (
        <UserRow key={suggestedUser._id} user={suggestedUser} avatarClass='h-8 w-8' />
      ))}
    </div>
  );
};

export default SuggestedUsers;
