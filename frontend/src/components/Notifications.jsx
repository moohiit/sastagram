import React, { useEffect } from 'react'
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
    <div className='flex flex-col w-[95%] bg-slate-50 h-screen border shadow-md '>
      <div className='font-bold text-3xl text-gray-600 m-8 '>Notifications</div>
      <div className='m-8 bg-slate-200 flex flex-col gap-2 mt-3 rounded-lg p-5 border border-gray-300 max-w-screen-sm'>
        {
          notifications.length === 0 ? (
            <p>No new notification</p>
          ) : (
            notifications.map((notification) => (
              <div key={notification._id} className='rounded-lg p-2 bg-slate-100'>
                <NotificationItem notification={notification} />
              </div>
            ))
          )
        }
      </div>
    </div>
  )
}
