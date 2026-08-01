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
      <p className='text-xs text-gray-400'>
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
      className='flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 cursor-pointer rounded-lg px-2 py-1 hover:bg-gray-100 transition-colors'
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

export default function Notifications() {
  const { notifications = [], unreadCount = 0 } = useSelector(store => store.notification) || {};
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();

  // Opening the notifications page marks everything read
  useEffect(() => {
    if (unreadCount === 0) return;
    dispatch(markAllRead());
    axios.patch('/api/v1/notification/read', {}, { withCredentials: true })
      .catch((error) => console.log(error));
  }, []);

  return (
    <div className='w-full max-w-[470px] mx-auto px-4 py-6'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-bold'>Notifications</h1>
        {user && isPushSupported() && <PushToggle />}
      </div>
      {notifications.length === 0 ? (
        <p className='text-sm text-gray-500'>No new notification</p>
      ) : (
        <div className='flex flex-col divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white'>
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
