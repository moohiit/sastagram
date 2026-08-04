import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { timeAgo } from '@/lib/utils';

// Renders a single persisted notification
// ({_id, sender: {_id, username, profilePicture}, type, post, text, read, createdAt})
function NotificationItem({ notification }) {
  return (
    <div className='flex gap-2 items-center my-1 w-full'>
      <Link to={`/profile/${notification.sender?._id}`}>
        <Avatar>
          <AvatarImage src={notification.sender?.profilePicture} />
          <AvatarFallback>MP</AvatarFallback>
        </Avatar>
      </Link>
      <p className='text-sm flex-1'>
        <span className='font-bold mr-1'>{notification.sender?.username}</span>
        {notification.type === 'like' && (
          <span className='font-semibold text-sm'>liked your post</span>
        )}
        {notification.type === 'follow' && (
          <span className='font-semibold text-sm'>started following you</span>
        )}
        {notification.type === 'mention' && (
          <span className='font-semibold text-sm'>mentioned you</span>
        )}
        {notification.type === 'follow_request' && (
          <span className='font-semibold text-sm'>requested to follow you</span>
        )}
        {notification.type === 'comment' && (
          <>
            <span className='font-semibold text-sm'>commented:</span>
            <br />
            <span className='text-zinc-400 font-medium'>{notification.text}</span>
          </>
        )}
        <span className='text-zinc-500 text-xs ml-2'>{timeAgo(notification.createdAt)}</span>
      </p>
    </div>
  );
}

export default NotificationItem;
