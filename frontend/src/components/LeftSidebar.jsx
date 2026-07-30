import React, { useState, useEffect } from 'react';
import { Camera, Heart, Home, LogOut, Menu, MessageCircle, PlusSquare, Search, TrendingUp, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { setAuthUser, setSelectedUser } from '@/redux/authSlice';
import CreatePost from './CreatePost';
import { setPosts } from '@/redux/postSlice';
import { setMessages, setOnlineUsers } from '@/redux/chatSlice';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { clearNotifications, markAllRead } from '@/redux/rtnSlice';
import NotificationItem from './NotificationItem';

function LeftSidebar({ collapsed, setCollapsed }) {
  const navigate = useNavigate();
  const { user } = useSelector(store => store.auth);
  const { notifications, unreadCount } = useSelector(store => store.notification);
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  // Mark everything read on the server and zero the badge
  const markNotificationsRead = async () => {
    dispatch(markAllRead());
    try {
      await axios.patch('/api/v1/notification/read', {}, { withCredentials: true });
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    // Collapsed by default on small screens (mobile)
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };
    handleResize(); // Set initial state
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setCollapsed]);

  // Logout handler
  const logoutHandler = async () => {
    try {
      const response = await axios.get('/api/v1/user/logout', { withCredentials: true });
      if (response.data.success) {
        dispatch(setAuthUser(null));
        dispatch(setPosts([]));
        dispatch(setMessages([]));
        dispatch(setOnlineUsers([]));
        dispatch(setSelectedUser(null));
        dispatch(clearNotifications());
        toast.success(response.data.message);
        navigate('/login');
      }
    } catch (error) {
      toast.error(error.response.data.message);
    }
  };

  // Sidebar items
  const sidebarItems = [
    { icon: <Home />, text: "Home" },
    { icon: <Search />, text: "Search" },
    { icon: <TrendingUp />, text: "Explore" },
    { icon: <MessageCircle />, text: "Messages" },
    { icon: <Heart />, text: "Notifications" },
    { icon: <PlusSquare />, text: "Create" },
    {
      icon: (
        <Avatar className='w-6 h-6'>
          <AvatarImage src={user?.profilePicture} alt='Avatar' />
          <AvatarFallback> MP</AvatarFallback>
        </Avatar>
      ), text: "Profile"
    },
    { icon: <LogOut />, text: "Logout" }
  ];

  // Sidebar handler
  const sidebarHandler = (textType) => {
    if (window.innerWidth < 768) {
      setCollapsed(true);
    }
    if (textType === "Home") {
      navigate('/');
    } else if (textType === "Search") {
      navigate('/search');
    } else if (textType === "Explore") {
      navigate('/explore');
    } else if (textType === "Create") {
      setOpen(true);
    } else if (textType === "Profile") {
      navigate(`/profile/${user._id}`);
    } else if (textType === "Messages") {
      navigate('/messages');
    } else if (textType === "Notifications") {
      navigate('/notifications');
    } else if (textType === "Logout") {
      logoutHandler();
    }
  };

  // Toggle sidebar collapse
  const toggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className={`fixed top-0 left-0 h-full border-gray-300 z-10 shadow-sm transition-all bg-white ${collapsed ? 'w-9' : 'w-64 border-r-2'} `}>
      <button
        className={`absolute top-4 px-2 py-1 text-2xl font-bold text-center text-gray-600 ${collapsed ? "" : "text-red-500"}`}
        onClick={toggleCollapse}
      >
        {collapsed ? <Menu /> : <X className='text-red-600' />}
      </button>
      <div className={`flex flex-col items-center mt-4 ${collapsed ? 'hidden' : 'block'}`}>
        <h1 className='font-bold text-3xl my-8 pl-5 text-red-500 flex items-center gap-2'>
          <Camera color="red" size={48} />
          Sastagram
        </h1>
        <div>
          {sidebarItems.map((item, index) => (
            <div
              key={index}
              onClick={() => sidebarHandler(item.text)}
              className='flex items-center gap-4 relative hover:bg-gray-200 cursor-pointer rounded-lg p-3 m-3'
            >
              <div className='mr-2'>{item.icon}</div>
              {!collapsed && <span>{item.text}</span>}
              {
                item.text === "Notifications" && (unreadCount > 0 || notifOpen) && (
                  <Popover open={notifOpen} onOpenChange={(isOpen) => {
                    setNotifOpen(isOpen);
                    if (isOpen) {
                      markNotificationsRead();
                    }
                  }}>
                    <PopoverTrigger asChild>
                      <div>
                        <Button size="icon" className='rounded-full w-5 h-5 absolute bg-red-600 hover:bg-red-600 bottom-6 left-6'>{unreadCount}</Button>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className='max-h-96 overflow-y-auto'>
                      <div>
                        {
                          notifications.length === 0 ? (
                            <p>No new notification</p>
                          ) : (
                            notifications.map((notification) => (
                              <NotificationItem key={notification._id} notification={notification} />
                            ))
                          )
                        }
                      </div>
                    </PopoverContent>
                  </Popover>
                )
              }
            </div>
          ))}
        </div>
      </div>
      <CreatePost open={open} setOpen={setOpen} />
    </div>
  );
}

export default LeftSidebar;
