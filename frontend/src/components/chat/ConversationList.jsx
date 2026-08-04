import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import { SquarePen, Users } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import useSocket from '@/hooks/useSocket';
import NewChatDialog from './NewChatDialog';
import NewGroupDialog from './NewGroupDialog';

const ConversationRow = React.memo(function ConversationRow({ convo, isOnline, isActive, meId, onClick }) {
  const { user, lastMessage, lastMessageAt, lastSenderId, unread } = convo;
  const hasUnread = unread > 0;
  const preview = lastMessage
    ? `${lastSenderId === meId ? 'You: ' : ''}${lastMessage}`
    : 'Start a conversation';

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-lg transition-colors ${isActive ? 'bg-zinc-900' : 'hover:bg-zinc-900'}`}
    >
      <div className='relative shrink-0'>
        <Avatar className='h-11 w-11'>
          <AvatarImage src={user?.profilePicture} />
          <AvatarFallback>{user?.username?.slice(0, 2)?.toUpperCase() || 'US'}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className='absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-black' />
        )}
      </div>
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-semibold text-gray-100 truncate'>{user?.username}</p>
        <div className='flex items-center gap-1 min-w-0'>
          <span className={`text-xs truncate ${hasUnread ? 'font-semibold text-gray-100' : 'text-zinc-400'}`}>
            {preview}
          </span>
          {lastMessageAt && (
            <span className='text-xs text-zinc-500 shrink-0'>· {timeAgo(lastMessageAt)}</span>
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
const ConversationList = ({ onSelect, selectedUserId, onSelectGroup, activeGroupId }) => {
  const { user } = useSelector((store) => store.auth);
  const { conversations, conversationsLoaded, onlineUsers } = useSelector((store) => store.chat);
  const socket = useSocket();
  const [query, setQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groups, setGroups] = useState([]);

  // Groups list — refreshed on any group-related socket event
  useEffect(() => {
    let cancelled = false;
    const fetchGroups = async () => {
      try {
        const response = await axios.get('/api/v1/message/group', { withCredentials: true });
        if (!cancelled && response.data.success) setGroups(response.data.groups || []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchGroups();
    if (!socket) return () => { cancelled = true; };
    const refresh = () => fetchGroups();
    socket.on('groupCreated', refresh);
    socket.on('groupUpdated', refresh);
    socket.on('newGroupMessage', refresh);
    return () => {
      cancelled = true;
      socket.off('groupCreated', refresh);
      socket.off('groupUpdated', refresh);
      socket.off('newGroupMessage', refresh);
    };
  }, [socket]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c?.user?.username?.toLowerCase().includes(q));
  }, [conversations, query]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g?.name?.toLowerCase().includes(q));
  }, [groups, query]);

  return (
    <div className='flex flex-col h-full min-h-0'>
      <div className='flex items-center justify-between px-4 pt-4 pb-2'>
        <h1 className='text-xl font-bold text-gray-100'>{user?.username || 'Messages'}</h1>
        <div className='flex items-center gap-1'>
          <button
            type='button'
            aria-label='New group'
            title='New group'
            onClick={() => setNewGroupOpen(true)}
            className='p-1.5 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors'
          >
            <Users size={24} />
          </button>
          <button
            type='button'
            aria-label='New message'
            title='New message'
            onClick={() => setNewChatOpen(true)}
            className='p-1.5 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors'
          >
            <SquarePen size={24} />
          </button>
        </div>
      </div>
      <div className='px-4 pb-2'>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search'
          className='h-9 bg-zinc-900 border-none focus-visible:ring-transparent'
        />
      </div>
      <div className='flex-1 overflow-y-auto px-2 pb-2'>
        {filteredGroups.length > 0 && (
          <div className='mb-1'>
            <p className='px-2 pt-1 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500'>
              Groups
            </p>
            {filteredGroups.map((g) => (
              <div
                key={g._id}
                onClick={() => onSelectGroup?.(g)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-lg transition-colors ${g._id === activeGroupId ? 'bg-zinc-900' : 'hover:bg-zinc-900'}`}
              >
                <div className='flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 shrink-0'>
                  <Users size={18} className='text-zinc-300' />
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-semibold text-gray-100 truncate'>{g.name}</p>
                  <div className='flex items-center gap-1 min-w-0'>
                    <span className='text-xs text-zinc-400 truncate'>
                      {g.lastMessage
                        ? `${g.lastSenderId === user?._id ? 'You: ' : ''}${g.lastMessage}`
                        : `${g.participants?.length || 0} members`}
                    </span>
                    {g.lastMessageAt && (
                      <span className='text-xs text-zinc-500 shrink-0'>· {timeAgo(g.lastMessageAt)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!conversationsLoaded ? (
          <div className='space-y-2 px-2 pt-2'>
            {[...Array(6)].map((_, i) => (
              <div key={i} className='flex items-center gap-3'>
                <div className='h-11 w-11 rounded-full animate-pulse bg-zinc-800' />
                <div className='flex-1 space-y-1.5'>
                  <div className='h-3 w-24 animate-pulse bg-zinc-800 rounded' />
                  <div className='h-3 w-40 animate-pulse bg-zinc-800 rounded' />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className='text-center pt-10 px-4'>
            <p className='text-sm text-zinc-400'>
              {query ? 'No conversations match your search.' : 'No conversations yet.'}
            </p>
            {!query && (
              <button
                type='button'
                onClick={() => setNewChatOpen(true)}
                className='mt-2 text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer'
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
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        onCreated={(group) => {
          setGroups((prev) => [group, ...prev.filter((g) => g._id !== group._id)]);
          onSelectGroup?.(group);
        }}
      />
    </div>
  );
};

export default ConversationList;
