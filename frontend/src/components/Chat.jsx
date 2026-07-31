import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageCircle } from 'lucide-react';
import { Button } from './ui/button';
import { setSelectedUser } from '@/redux/authSlice';
import { setConversations } from '@/redux/chatSlice';
import useGetUserProfile from '@/hooks/useGetUserProfile';
import useGetRTM from '@/hooks/useGetRTM';
import ConversationList from './chat/ConversationList';
import ChatThread from './chat/ChatThread';
import NewChatDialog from './chat/NewChatDialog';

/**
 * Direct messages. Two-pane on md+ (conversation list | thread); below md a
 * single pane that slides between list and thread. Serves /messages, /chat
 * and the /chat/:id deep link.
 */
function Chat() {
  const params = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { selectedUser, userProfile } = useSelector((store) => store.auth);
  const { conversations } = useSelector((store) => store.chat);
  const [newChatOpen, setNewChatOpen] = useState(false);

  // Live socket subscriptions for the whole page (thread + list updates).
  useGetRTM();

  // Conversation list (sorted by recency, includes unread counts).
  useEffect(() => {
    let cancelled = false;
    const fetchConversations = async () => {
      try {
        const response = await axios.get('/api/v1/message/conversations', {
          withCredentials: true,
        });
        if (!cancelled && response.data.success) {
          dispatch(setConversations(response.data.conversations));
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.response?.data?.message || 'Could not load conversations');
        }
      }
    };
    fetchConversations();
    return () => { cancelled = true; };
  }, [dispatch]);

  // Deep link /chat/:id — resolve the counterpart locally when possible,
  // otherwise fall back to a profile fetch (useGetUserProfile no-ops on null).
  const userId = params?.id || null;
  const convoUser = useMemo(
    () => conversations.find((c) => c._id === userId)?.user || null,
    [conversations, userId]
  );
  const resolvedLocally = !userId || selectedUser?._id === userId || !!convoUser;
  useGetUserProfile(resolvedLocally ? null : userId);

  useEffect(() => {
    if (!userId) {
      dispatch(setSelectedUser(null));
      return;
    }
    if (selectedUser?._id === userId) return;
    if (convoUser) {
      dispatch(setSelectedUser(convoUser));
    } else if (userProfile?._id === userId) {
      dispatch(setSelectedUser(userProfile));
    }
  }, [userId, selectedUser?._id, convoUser, userProfile, dispatch]);

  // Leaving the page closes the thread.
  useEffect(() => {
    return () => dispatch(setSelectedUser(null));
  }, [dispatch]);

  const handleSelect = useCallback((u) => {
    if (!u?._id) return;
    dispatch(setSelectedUser(u));
    navigate(`/chat/${u._id}`);
  }, [dispatch, navigate]);

  const handleBack = useCallback(() => {
    navigate('/chat');
  }, [navigate]);

  const threadOpen = !!selectedUser;

  return (
    <div className='flex h-[calc(100dvh-7.5rem)] md:h-[100dvh]'>
      {/* Conversation list — full-screen below md, fixed column on md+ */}
      <aside
        className={`${threadOpen ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[380px] shrink-0 flex-col border-r border-gray-200`}
      >
        <ConversationList onSelect={handleSelect} selectedUserId={selectedUser?._id} />
      </aside>

      {/* Thread pane — full-screen below md when a thread is open */}
      <section className={`${threadOpen ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 flex-col`}>
        {threadOpen ? (
          <ChatThread selectedUser={selectedUser} onBack={handleBack} />
        ) : (
          <div className='flex flex-1 flex-col items-center justify-center px-4'>
            <div className='flex items-center justify-center h-24 w-24 rounded-full border-2 border-gray-900'>
              <MessageCircle size={44} strokeWidth={1.5} />
            </div>
            <h2 className='text-xl font-bold text-gray-900 mt-4'>Your messages</h2>
            <p className='text-sm text-gray-500 mt-1'>Send a message to start a chat.</p>
            <Button
              onClick={() => setNewChatOpen(true)}
              className='bg-blue-500 hover:bg-blue-600 h-8 mt-4'
            >
              Send message
            </Button>
            <NewChatDialog
              open={newChatOpen}
              onOpenChange={setNewChatOpen}
              onSelect={(u) => {
                setNewChatOpen(false);
                handleSelect(u);
              }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default Chat;
