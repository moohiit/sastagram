import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ChevronLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import Messages from '../Messages';
import MessageComposer from './MessageComposer';

/**
 * Right pane: thread header (live status), message history, composer.
 */

// "Active 5m ago" when we know a recent last-active time; plain Offline otherwise
const lastActiveLabel = (lastActiveAt) => {
  if (!lastActiveAt) return 'Offline';
  const mins = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 60000);
  if (mins < 1) return 'Active just now';
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  return 'Offline';
};

const ChatThread = ({ selectedUser, onBack }) => {
  const { onlineUsers, typing } = useSelector((store) => store.chat);
  const isOnline = onlineUsers?.includes(selectedUser?._id);
  const isTyping = !!typing[selectedUser?._id];

  return (
    <div className='flex flex-col h-full min-h-0'>
      <header className='flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0'>
        <button
          type='button'
          aria-label='Back'
          onClick={onBack}
          className='md:hidden -ml-2 p-1 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors'
        >
          <ChevronLeft size={24} />
        </button>
        <div className='relative shrink-0'>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={selectedUser?.profilePicture} />
            <AvatarFallback>
              {selectedUser?.username?.slice(0, 2)?.toUpperCase() || 'US'}
            </AvatarFallback>
          </Avatar>
          {isOnline && (
            <span className='absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-black' />
          )}
        </div>
        <div className='flex flex-col min-w-0'>
          <Link
            to={`/profile/${selectedUser?._id}`}
            className='text-sm font-semibold text-gray-100 truncate hover:underline'
          >
            {selectedUser?.username}
          </Link>
          <span className='text-xs text-zinc-400'>
            {isTyping ? 'typing…' : isOnline ? 'Active now' : lastActiveLabel(selectedUser?.lastActiveAt)}
          </span>
        </div>
      </header>
      <Messages selectedUser={selectedUser} />
      <MessageComposer selectedUser={selectedUser} />
    </div>
  );
};

export default ChatThread;
