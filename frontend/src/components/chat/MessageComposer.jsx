import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'sonner';
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
  const { socket } = useSelector((store) => store.socketio);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
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

  // Reset composer state when switching threads; tell the previous
  // counterpart we stopped typing on unmount/switch.
  useEffect(() => {
    setText('');
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
    <div className='p-3 border-t border-gray-200'>
      <div className='flex items-center gap-2 border border-gray-200 rounded-full px-2 py-1'>
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
          className='text-sm font-semibold text-blue-500 hover:text-blue-700 px-2 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-default'
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default MessageComposer;
