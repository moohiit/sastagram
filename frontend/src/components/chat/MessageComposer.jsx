import { useCallback, useEffect, useRef, useState } from 'react';
import useSocket from '@/hooks/useSocket';
import useAiEnabled from '@/hooks/useAiEnabled';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { Input } from '../ui/input';
import { addMessage, clearSeen, upsertConversation } from '@/redux/chatSlice';

const TYPING_THROTTLE_MS = 1000;
const STOP_TYPING_IDLE_MS = 1500;

/**
 * Thread composer: Enter (or Send) sends, empty input is disabled.
 * Emits "typing" (throttled) while the user types and "stopTyping" after
 * 1.5s idle or on send. Updates the conversation list optimistically.
 */
const MessageComposer = ({ selectedUser }) => {
  const dispatch = useDispatch();
  const { user } = useSelector((store) => store.auth);
  const { messages } = useSelector((store) => store.chat);
  const socket = useSocket();
  const aiEnabled = useAiEnabled();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggesting, setSuggesting] = useState(false);
  const inputRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  const stopTypingTimerRef = useRef(null);
  const receiverId = selectedUser?._id;

  const emitStopTyping = useCallback(() => {
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }
    lastTypingEmitRef.current = 0;
    socket?.emit('stopTyping', { to: receiverId });
  }, [socket, receiverId]);

  // Smart replies: send the recent thread to the AI endpoint, get 3 chips
  const fetchSuggestions = async () => {
    if (suggesting) return;
    const recent = messages
      .filter((m) => !m.deleted && m.message)
      .slice(-8)
      .map((m) => ({ fromMe: m.senderId === user?._id, text: m.message }));
    if (recent.length === 0) {
      toast.info('No messages to reply to yet');
      return;
    }
    try {
      setSuggesting(true);
      const response = await axios.post(
        '/api/v1/ai/replies',
        { messages: recent },
        { withCredentials: true }
      );
      if (response.data.success) setSuggestions(response.data.replies || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not suggest replies');
    } finally {
      setSuggesting(false);
    }
  };

  // Reset composer state when switching threads; tell the previous
  // counterpart we stopped typing on unmount/switch.
  useEffect(() => {
    setText('');
    setSuggestions([]);
    return () => {
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      lastTypingEmitRef.current = 0;
      socket?.emit('stopTyping', { to: receiverId });
    };
  }, [receiverId, socket]);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    if (!socket || !receiverId || !value.trim()) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current > TYPING_THROTTLE_MS) {
      lastTypingEmitRef.current = now;
      socket.emit('typing', { to: receiverId });
    }
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(emitStopTyping, STOP_TYPING_IDLE_MS);
  };

  const sendMessage = useCallback(async () => {
    const message = text.trim();
    if (!message || !receiverId || sending) return;
    setSending(true);
    try {
      const response = await axios.post(
        `/api/v1/message/send/${receiverId}`,
        { message },
        { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
      );
      if (response.data.success) {
        const newMessage = response.data.newMessage;
        dispatch(addMessage(newMessage));
        dispatch(clearSeen(receiverId));
        dispatch(upsertConversation({
          userId: receiverId,
          lastMessage: newMessage.message,
          lastMessageAt: newMessage.createdAt || new Date().toISOString(),
          lastSenderId: user?._id,
          unreadDelta: 0,
          user: {
            _id: selectedUser?._id,
            username: selectedUser?.username,
            profilePicture: selectedUser?.profilePicture,
          },
        }));
        setText('');
        emitStopTyping();
        inputRef.current?.focus();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Error sending message');
    } finally {
      setSending(false);
    }
  }, [text, receiverId, sending, dispatch, user?._id, selectedUser, emitStopTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className='p-3 border-t border-zinc-800'>
      {suggestions.length > 0 && (
        <div className='flex flex-wrap gap-2 pb-2'>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setText(s);
                setSuggestions([]);
                inputRef.current?.focus();
              }}
              className='rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-gray-100 hover:bg-zinc-800 cursor-pointer'
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <div className='flex items-center gap-2 border border-zinc-800 rounded-full px-2 py-1'>
        {aiEnabled && (
          <button
            type='button'
            onClick={fetchSuggestions}
            disabled={suggesting}
            title='Suggest replies'
            aria-label='Suggest replies'
            className='p-1.5 text-zinc-400 hover:text-blue-400 cursor-pointer disabled:opacity-50'
          >
            {suggesting ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <Sparkles size={16} />
            )}
          </button>
        )}
        <Input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          type='text'
          placeholder='Message…'
          className='flex-1 border-none h-8 px-2 focus-visible:ring-transparent focus-visible:ring-offset-0'
        />
        <button
          type='button'
          onClick={sendMessage}
          disabled={!text.trim() || sending}
          className='text-sm font-semibold text-blue-400 hover:text-blue-300 px-2 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-default'
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
