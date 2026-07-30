import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { setSelectedUser } from '@/redux/authSlice';
import Messages from './Messages';
import { Button } from './ui/button';
import { MessageCircleCode, MoreHorizontalIcon } from 'lucide-react';
import { Input } from './ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { setMessages } from '@/redux/chatSlice';
import { Link, useParams } from 'react-router-dom';
import useGetUserProfile from '@/hooks/useGetUserProfile';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { DialogTrigger } from '@radix-ui/react-dialog';

const SuggestedUserItem = React.memo(({ suggestedUser, isOnline, onClick }) => (
  <div onClick={onClick} className='flex gap-3 items-center p-3 hover:bg-gray-100 cursor-pointer'>
    <Avatar className='w-12 h-12'>
      <AvatarImage src={suggestedUser?.profilePicture} />
      <AvatarFallback>MP</AvatarFallback>
    </Avatar>
    <div className='flex flex-col'>
      <span className='font-medium text-sm'>{suggestedUser?.username}</span>
      <span className={`text-xs font-bold ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
        {isOnline ? 'Online' : 'Offline'}
      </span>
    </div>
  </div>
));

function Chat() {
  const params = useParams();
  const dispatch = useDispatch();
  const { user, followings, selectedUser, userProfile } = useSelector(store => store.auth);
  const { onlineUsers, messages } = useSelector(store => store.chat);

  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);  // Ref for the input field

  const userId = params?.id;
  // Hooks must not be called conditionally — the hook itself no-ops without an id
  useGetUserProfile(userId);

  useEffect(() => {
    if (userId) {
      dispatch(setSelectedUser(userProfile));
    }
  }, [dispatch, userId, userProfile]);

  const sendMessageHandler = useCallback(async (recieverId) => {
    try {
      const response = await axios.post(`/api/v1/message/send/${recieverId}`, { message }, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      });
      if (response.data.success) {
        const newMessages = messages ? [...messages, response.data.newMessage] : [response.data.newMessage];
        dispatch(setMessages(newMessages));
        setMessage('');
        // Refocus the input to keep the keyboard open on mobile
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error sending message');
    }
  }, [dispatch, message, messages]);

  useEffect(() => {
    return () => dispatch(setSelectedUser(null));
  }, [dispatch]);

  const handleUserSelect = useCallback((usr) => {
    dispatch(setSelectedUser(usr));
    setOpen(false);
  }, [dispatch]);

  const memoizedFollowings = useMemo(() => {
    return followings?.map((followingUser) => ({
      ...followingUser,
      isOnline: onlineUsers?.includes(followingUser?._id),
    }));
  }, [followings, onlineUsers]);

  // Function to handle Enter key press
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && message.trim()) {
      e.preventDefault();  // Prevent default behavior on Enter key press
      sendMessageHandler(selectedUser._id);
    }
  };

  return (
    <div className='flex flex-col h-screen'>
      <div className='w-full bg-blue-300 flex px-4 justify-between items-center'>
        <span onClick={() => setOpen(true)} className='font-bold text-gray-500 p-2 cursor-pointer'>
          Friends List
        </span>
        <Dialog open={open}>
          <DialogTrigger onClick={() => setOpen(true)}>
            <MoreHorizontalIcon />
          </DialogTrigger>
          <DialogContent onInteractOutside={() => setOpen(false)}>
            <DialogTitle className='font-bold px-3 text-xl text-gray-400'>Friends</DialogTitle>
            <section className='w-full'>
              <hr className='mb-4 border-gray-300' />
              <div className='overflow-y-auto max-h-[400px]'>
                {memoizedFollowings?.map((followingUser) => (
                  <SuggestedUserItem
                    key={followingUser?._id}
                    suggestedUser={followingUser}
                    isOnline={followingUser.isOnline}
                    onClick={() => handleUserSelect(followingUser)}
                  />
                ))}
              </div>
            </section>
          </DialogContent>
        </Dialog>
      </div>
      {selectedUser ? (
        <section className='flex-1 border-l border-l-gray-300 flex flex-col h-full'>
          <Messages selectedUser={selectedUser} />
          <div className='flex items-center p-2 border-t border-t-gray-300'>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}  // Attach keydown event to input
              ref={inputRef}  // Attach the ref to the input
              type='text'
              className='flex-1 mr-2 focus-visible:ring-transparent'
              placeholder='Message...'
            />
            <Button onClick={(e) => {
              e.preventDefault();  // Prevent default button behavior
              sendMessageHandler(selectedUser._id);
            }}>Send</Button>
          </div>
        </section>
      ) : (
        <div className='flex flex-col border-l border-l-gray-300 w-full items-center justify-center'>
          <MessageCircleCode className='w-24 h-24 my-4' />
          <h1 className='text-xl'>Your Messages</h1>
          <span className='text-gray-500'>Send a message to start a chat</span>
        </div>
      )}
    </div>
  );
}

export default Chat;
