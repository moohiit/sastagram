import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Home from '@/components/Home';
import Signup from './components/Signup';
import Login from './components/Login';
import MainLayout from './components/MainLayout';
import Profile from './components/Profile';
import Explore from './components/Explore';
import Search from './components/Search';
import Notifications from './components/Notifications';
import EditProfile from './components/EditProfile';
import Chat from './components/Chat';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setOnlineUsers } from './redux/chatSlice';
import { connectSocket, closeSocket } from './lib/socket';
import { addNotification, setNotifications } from './redux/rtnSlice';
import axios from 'axios';
import ProtectedRoutes from './components/ProtectedRoutes';
import RequireAuth from './components/RequireAuth';
import Followers from './components/Followers';
import Following from './components/Following';
const browserRouter = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedRoutes><MainLayout /></ProtectedRoutes>,
    children: [
      {
        path: "/",
        element: <Home />
      },
      {
        path: "/search",
        element: <Search />
      },
      {
        path: "/explore",
        element: <Explore />
      },
      {
        path: `/profile/:id`,
        element: <Profile />
      },
      {
        path: "/messages",
        element: <RequireAuth><Chat /></RequireAuth>
      },
      {
        path: "/notifications",
        element: <RequireAuth><Notifications /></RequireAuth>
      },
      {
        path: "/profile/edit",
        element: <RequireAuth><EditProfile /></RequireAuth>
      },
      {
        path: "/chat",
        element: <RequireAuth><Chat /></RequireAuth>
      },
      {
        path: "/chat/:id",
        element: <RequireAuth><Chat /></RequireAuth>
      },
      {
        path: "/:id/followers",
        element: <Followers />
      },
      {
        path: "/:id/following",
        element: <Following />
      },
    ]
  },
  {
    path: "/signup",
    element: <Signup />
  },
  {
    path: "/login",
    element: <Login />
  }
])

function App() {
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();
  useEffect(() => {
    if (user) {
      // Same-origin connection: proxied by Vite in dev, served by the backend
      // itself in production. Identity comes from the httpOnly JWT cookie —
      // the server no longer trusts a client-supplied userId. The instance
      // lives in a module singleton (not redux — it isn't serializable).
      const socketio = connectSocket();

      socketio.on('getOnlineUsers', (onlineUsers) => {
        dispatch(setOnlineUsers(onlineUsers));
      });
      // The server emits the full persisted notification object
      // ({_id, sender, type, post, text, read, createdAt})
      socketio.on('notification', (notification) => {
        dispatch(addNotification(notification))
      })
      return () => {
        closeSocket();
        dispatch(setOnlineUsers(null));
      }
    }
    closeSocket();
    dispatch(setOnlineUsers(null));
  }, [user, dispatch]);

  // Load persisted notifications once the user is logged in
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const response = await axios.get('/api/v1/notification?limit=20', { withCredentials: true });
        if (response.data.success) {
          dispatch(setNotifications({
            notifications: response.data.notifications,
            unreadCount: response.data.unreadCount,
          }));
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchNotifications();
  }, [user?._id, dispatch]);

  return (
    <>
      <RouterProvider router={browserRouter} />
    </>
  )
}

export default App