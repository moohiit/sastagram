import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { markAllRead } from '@/redux/rtnSlice';
import NotificationItem from './NotificationItem';
import {
  isPushSupported,
  fetchPushPublicKey,
  getCurrentSubscription,
  subscribeUser,
  unsubscribeUser,
} from '@/lib/push';

// Bell toggle in the page header. Only rendered when the user is logged in,
// the server has push configured (VAPID keys) and the browser supports it.
// No client-side persistence — state is derived from pushManager each mount.
function PushToggle() {
  const [publicKey, setPublicKey] = useState(null); // null until /public-key answers
  const [subscribed, setSubscribed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) return;
    let cancelled = false;
    (async () => {
      const { enabled, key } = await fetchPushPublicKey();
      if (cancelled || !enabled) return;
      setPublicKey(key);
      setDenied(Notification.permission === 'denied');
      const sub = await getCurrentSubscription().catch(() => null);
      if (!cancelled) setSubscribed(Boolean(sub));
    })();
    return () => { cancelled = true; };
  }, []);

  // Server push not configured / unsupported browser → no UI at all.
  if (!publicKey) return null;

  if (denied) {
    return (
      <p className='text-xs text-zinc-500'>
        Notifications are blocked — allow them in your browser settings.
      </p>
    );
  }

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribeUser();
        setSubscribed(false);
      } else {
        const sub = await subscribeUser(publicKey);
        if (sub) {
          setSubscribed(true);
          toast.success('Push notifications enabled');
        } else {
          setDenied(Notification.permission === 'denied');
        }
      }
    } catch (error) {
      console.log(error);
      toast.error('Could not update notification settings');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type='button'
      onClick={toggle}
      disabled={busy}
      title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
      className='flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 cursor-pointer rounded-lg px-2 py-1 hover:bg-zinc-900 transition-colors'
    >
      {busy ? (
        <Loader2 size={20} className='animate-spin' />
      ) : subscribed ? (
        <BellRing size={20} strokeWidth={2.5} />
      ) : (
        <Bell size={20} />
      )}
      <span>{subscribed ? 'Notifications on' : 'Enable notifications'}</span>
    </button>
  );
}

// Incoming follow requests (private accounts) with Accept / Decline.
function FollowRequests() {
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(null); // request id being handled

  useEffect(() => {
    let cancelled = false;
    axios
      .get('/api/v1/user/follow-requests', { withCredentials: true })
      .then((response) => {
        if (!cancelled && response.data.success) setRequests(response.data.requests || []);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  const respond = async (id, action) => {
    try {
      setBusy(id);
      await axios.post(`/api/v1/user/follow-requests/${id}/${action}`, {}, { withCredentials: true });
      setRequests((prev) => prev.filter((r) => r._id !== id));
      toast.success(action === 'accept' ? 'Request accepted' : 'Request declined');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  if (requests.length === 0) return null;
  return (
    <div className='mb-4'>
      <h2 className='text-sm font-semibold text-gray-100 mb-2'>Follow requests</h2>
      <div className='flex flex-col divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-black'>
        {requests.map((r) => (
          <div key={r._id} className='flex items-center gap-3 p-3'>
            <img
              src={r.from?.profilePicture || undefined}
              alt={r.from?.username}
              className='h-9 w-9 rounded-full object-cover bg-zinc-800'
            />
            <span className='text-sm text-gray-100 flex-1 truncate font-semibold'>
              {r.from?.username}
            </span>
            <button
              disabled={busy === r._id}
              onClick={() => respond(r._id, 'accept')}
              className='rounded-md bg-blue-500 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50'
            >
              Confirm
            </button>
            <button
              disabled={busy === r._id}
              onClick={() => respond(r._id, 'decline')}
              className='rounded-md bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-gray-100 cursor-pointer disabled:opacity-50'
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Notifications() {
  const { notifications = [], unreadCount = 0 } = useSelector(store => store.notification) || {};
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();

  // Marks everything read while the page is open — including notifications
  // that arrive live (the old mount-only effect closed over the initial count
  // and never cleared the badge for those).
  useEffect(() => {
    if (unreadCount === 0) return;
    dispatch(markAllRead());
    axios.patch('/api/v1/notification/read', {}, { withCredentials: true })
      .catch((error) => console.log(error));
  }, [unreadCount, dispatch]);

  return (
    <div className='w-full max-w-[470px] mx-auto px-4 py-6'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-bold'>Notifications</h1>
        {user && isPushSupported() && <PushToggle />}
      </div>
      {user && <FollowRequests />}
      {notifications.length === 0 ? (
        <p className='text-sm text-zinc-400'>No new notification</p>
      ) : (
        <div className='flex flex-col divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-black'>
          {notifications.map((notification) => (
            <div key={notification._id} className='p-3'>
              <NotificationItem notification={notification} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
