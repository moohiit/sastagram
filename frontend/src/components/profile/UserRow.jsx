import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { cdn } from '@/lib/cdn';
import FollowButton from './FollowButton';

// Avatar + username + bio row used by Followers/Following, Search results and
// SuggestedUsers. `action` overrides the default right-hand slot; `onNavigate`
// fires when the user info is clicked (used to record recent searches).
const UserRow = ({ user: rowUser, action, onNavigate, avatarClass = 'h-11 w-11' }) => {
  const { user } = useSelector(store => store.auth);
  if (!rowUser?._id) return null;
  const isSelf = user?._id === rowUser._id;

  return (
    <div className='flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900 transition-colors'>
      <Link
        to={`/profile/${rowUser._id}`}
        onClick={onNavigate}
        className='flex items-center gap-3 min-w-0 flex-1 cursor-pointer'
      >
        <Avatar className={`${avatarClass} shrink-0`}>
          <AvatarImage src={cdn(rowUser.profilePicture, 100)} alt={rowUser.username} />
          <AvatarFallback>{rowUser.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
        </Avatar>
        <div className='min-w-0'>
          <p className='text-sm font-semibold text-gray-100 truncate'>{rowUser.username}</p>
          {rowUser.bio ? (
            <p className='text-sm text-zinc-400 truncate'>{rowUser.bio}</p>
          ) : null}
        </div>
      </Link>
      {action !== undefined ? (
        action
      ) : isSelf ? (
        <span className='text-xs font-semibold text-zinc-500 px-2'>You</span>
      ) : (
        <FollowButton userId={rowUser._id} />
      )}
    </div>
  );
};

export default UserRow;
