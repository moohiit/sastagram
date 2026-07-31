import React, { useEffect } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { markAllRead } from '@/redux/rtnSlice';
import NotificationItem from './NotificationItem';

export default function Notifications() {
  const { notifications, unreadCount } = useSelector(store => store.notification);
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
      <h1 className='text-xl font-bold mb-4'>Notifications</h1>
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
