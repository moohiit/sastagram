import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import { ChevronLeft, Loader2, LogOut, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Input } from '../ui/input';
import useSocket from '@/hooks/useSocket';

// Self-contained group chat thread: history + composer + live updates.
// State is local (not redux) — the DM slice stays untouched.
const GroupThread = ({ groupId, onBack, onLeft }) => {
  const { user } = useSelector((store) => store.auth);
  const socket = useSocket();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prevCursor, setPrevCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    axios
      .get(`/api/v1/message/group/${groupId}`, { withCredentials: true })
      .then((response) => {
        if (cancelled || !response.data.success) return;
        setGroup(response.data.group);
        setMessages(response.data.messages || []);
        setPrevCursor(response.data.prevCursor);
      })
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Could not load group');
        onBack?.();
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  // Live messages for this group (dedup by _id — sender receives its own echo)
  useEffect(() => {
    if (!socket) return;
    const onGroupMessage = ({ conversationId, message } = {}) => {
      if (conversationId !== groupId || !message?._id) return;
      setMessages((prev) =>
        prev.some((m) => m._id === message._id) ? prev : [...prev, message]
      );
    };
    socket.on('newGroupMessage', onGroupMessage);
    return () => socket.off('newGroupMessage', onGroupMessage);
  }, [socket, groupId]);

  // Stick to the bottom on new messages
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const loadOlder = async () => {
    try {
      const response = await axios.get(
        `/api/v1/message/group/${groupId}?before=${prevCursor}`,
        { withCredentials: true }
      );
      if (response.data.success) {
        setMessages((prev) => [...(response.data.messages || []), ...prev]);
        setPrevCursor(response.data.prevCursor);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const send = useCallback(async () => {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    try {
      const response = await axios.post(
        `/api/v1/message/group/${groupId}/send`,
        { message },
        { withCredentials: true }
      );
      if (response.data.success) {
        const newMessage = response.data.newMessage;
        setMessages((prev) =>
          prev.some((m) => m._id === newMessage._id) ? prev : [...prev, newMessage]
        );
        setText('');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send');
    } finally {
      setSending(false);
    }
  }, [text, sending, groupId]);

  const leave = async () => {
    if (!window.confirm(`Leave "${group?.name}"?`)) return;
    try {
      await axios.delete(`/api/v1/message/group/${groupId}/members/me`, {
        withCredentials: true,
      });
      toast.success('Left group');
      onLeft?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not leave group');
    }
  };

  if (loading) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-zinc-500' />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className='flex items-center gap-3 border-b border-zinc-800 px-4 py-3'>
        <button onClick={onBack} className='md:hidden p-1 -ml-2 cursor-pointer'>
          <ChevronLeft size={22} />
        </button>
        <div className='flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 shrink-0'>
          <Users size={18} className='text-zinc-300' />
        </div>
        <div className='flex-1 min-w-0'>
          <p className='text-sm font-semibold text-gray-100 truncate'>{group?.name}</p>
          <p className='text-xs text-zinc-400 truncate'>
            {group?.participants?.map((p) => p.username).join(', ')}
          </p>
        </div>
        <button
          onClick={leave}
          title='Leave group'
          className='p-1.5 text-zinc-400 hover:text-red-500 cursor-pointer'
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={containerRef} className='flex-1 min-h-0 overflow-y-auto px-4 py-3'>
        {prevCursor && (
          <div className='flex justify-center pb-2'>
            <button
              onClick={loadOlder}
              className='text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer'
            >
              Load older messages
            </button>
          </div>
        )}
        {messages.length === 0 && (
          <p className='text-sm text-zinc-400 text-center pt-10'>
            No messages yet — say hi to the group 👋
          </p>
        )}
        {messages.map((msg) => {
          const sender = msg.senderId; // populated {_id, username, profilePicture}
          const mine = (sender?._id || sender) === user?._id;
          return (
            <div
              key={msg._id}
              className={`flex items-end gap-2 mt-2 ${mine ? 'justify-end' : 'justify-start'}`}
            >
              {!mine && (
                <Avatar className='h-7 w-7 shrink-0'>
                  <AvatarImage src={sender?.profilePicture} />
                  <AvatarFallback>
                    {sender?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className='max-w-[75%]'>
                {!mine && (
                  <p className='text-[11px] text-zinc-500 pl-1 pb-0.5'>{sender?.username}</p>
                )}
                <div
                  title={msg.createdAt ? new Date(msg.createdAt).toLocaleString() : undefined}
                  className={`px-3.5 py-2 rounded-2xl text-sm break-words ${
                    msg.deleted
                      ? 'bg-transparent border border-zinc-800 text-zinc-500 italic'
                      : mine
                        ? 'bg-blue-500 text-white'
                        : 'bg-zinc-900 text-gray-100'
                  }`}
                >
                  {msg.deleted ? 'Message unsent' : msg.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Composer */}
      <div className='p-3 border-t border-zinc-800'>
        <div className='flex items-center gap-2 border border-zinc-800 rounded-full px-2 py-1'>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Message ${group?.name || 'group'}…`}
            className='flex-1 border-none h-8 px-2 focus-visible:ring-transparent focus-visible:ring-offset-0'
          />
          <button
            type='button'
            onClick={send}
            disabled={!text.trim() || sending}
            className='text-sm font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-default'
          >
            Send
          </button>
        </div>
      </div>
    </>
  );
};

export default GroupThread;
