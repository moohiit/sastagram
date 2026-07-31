import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import { SquarePen } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import NewChatDialog from './NewChatDialog';

const ConversationRow = React.memo(function ConversationRow({ convo, isOnline, isActive, meId, onClick }) {
  const { user, lastMessage, lastMessageAt, lastSenderId, unread } = convo;
  const hasUnread = unread > 0;
  const preview = lastMessage
    ? `${lastSenderId === meId ? 'You: ' : ''}${lastMessage}`
    : 'Start a conversation';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-lg transition-colors ${isActive ? 'bg-gray-100' : 'hover:bg-gray-100'}`}
    >
      <div className='relative shrink-0'>
        <Avatar className='h-11 w-11'>
          <AvatarImage src={user?.profilePicture} />
          <AvatarFallback>{user?.username?.slice(0, 2)?.toUpperCase() || 'US'}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className='absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white' />
        )}
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold text-gray-900 truncate'>{user?.username}</p>
        <div className='flex items-center gap-1 min-w-0'>
          <span className={`text-xs truncate ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
            {preview}
          </span>
          {lastMessageAt && (
            <span className='text-xs text-gray-400 shrink-0'>· {timeAgo(lastMessageAt)}</span>
          )}
        </div>
      </div>
      {hasUnread && (
        <span className='shrink-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none'>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </div>
  );
});

/**
 * Left pane: searchable conversation list + "new chat" entry point.
 */
const ConversationList = ({ onSelect, selectedUserId }) => {
  const { user } = useSelector((store) => store.auth);
  const { conversations, conversationsLoaded, onlineUsers } = useSelector((store) => store.chat);
  const [query, setQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c?.user?.username?.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <div className='flex flex-col h-full min-h-0'>
      <div className='flex items-center justify-between px-4 pt-4 pb-2'>
        <h1 className='text-xl font-bold text-gray-900'>{user?.username || 'Messages'}</h1>
        <button
          type='button'
          aria-label='New message'
          onClick={() => setNewChatOpen(true)}
          className='p-1.5 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors'
        >
          <SquarePen size={24} />
        </button>
      </div>
      <div className='px-4 pb-2'>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search'
          className='h-9 bg-gray-100 border-none focus-visible:ring-transparent'
        />
      </div>
      <div className='flex-1 overflow-y-auto px-2 pb-2'>
        {!conversationsLoaded ? (
          <div className='space-y-2 px-2 pt-2'>
            {[...Array(6)].map((_, i) => (
              <div key={i} className='flex items-center gap-3'>
                <div className='h-11 w-11 rounded-full animate-pulse bg-gray-200' />
                <div className='flex-1 space-y-1.5'>
                  <div className='h-3 w-24 animate-pulse bg-gray-200 rounded' />
                  <div className='h-3 w-40 animate-pulse bg-gray-200 rounded' />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className='text-center pt-10 px-4'>
            <p className='text-sm text-gray-500'>
              {query ? 'No conversations match your search.' : 'No conversations yet.'}
            </p>
            {!query && (
              <button
                type='button'
                onClick={() => setNewChatOpen(true)}
                className='mt-2 text-sm font-semibold text-blue-500 hover:text-blue-700 cursor-pointer'
              >
                Send a message
              </button>
            )}
          </div>
        ) : (
          filtered.map((convo) => (
            <ConversationRow
              key={convo._id}
              convo={convo}
              meId={user?._id}
              isOnline={onlineUsers?.includes(convo._id)}
              isActive={convo._id === selectedUserId}
              onClick={() => onSelect(convo.user)}
            />
          ))
        )}
      </div>
      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        onSelect={(u) => {
          setNewChatOpen(false);
          onSelect(u);
        }}
      />
    </div>
  );
};

export default ConversationList;
