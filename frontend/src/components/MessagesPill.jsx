import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MessageCircle } from 'lucide-react';

// Instagram-style floating "Messages" pill, bottom-right of the Home feed.
// Desktop (>=1264px) and logged-in only. Fetches unread counts once and
// shows the summed total as a red badge; clicking opens /messages.
function MessagesPill() {
  const { user } = useSelector(store => store.auth);
  const navigate = useNavigate();
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchUnread = async () => {
      try {
        const response = await axios.get('/api/v1/message/unread', { withCredentials: true });
        if (!cancelled && response.data.success) {
          const total = Object.values(response.data.unread || {}).reduce(
            (sum, count) => sum + count,
            0
          );
          setUnreadTotal(total);
        }
      } catch (error) {
        console.error(error);
      }
    };
    fetchUnread();
    return () => { cancelled = true; };
  }, [user?._id]);

  if (!user) return null;

  return (
    <button
      type='button'
      onClick={() => navigate('/messages')}
      aria-label='Messages'
      className='hidden min-[1264px]:flex fixed bottom-6 right-6 z-30 items-center gap-2 rounded-full bg-zinc-900 border border-zinc-800 shadow px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-zinc-800 transition-colors cursor-pointer'
    >
      <MessageCircle size={20} className='shrink-0' />
      <span>Messages</span>
      {unreadTotal > 0 && (
        <span className='min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-semibold leading-none'>
          {unreadTotal > 99 ? '99+' : unreadTotal}
        </span>
      )}
    </button>
  );
}

export default MessagesPill;
