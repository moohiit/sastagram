import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Home from '@/components/Home';
import Signup from './components/Signup';
import Login from './components/Login';
import MainLayout from './components/MainLayout';
import { useDispatch, useSelector } from 'react-redux';
import { setOnlineUsers, addOnlineUser, removeOnlineUser } from './redux/chatSlice';
import { connectSocket, closeSocket } from './lib/socket';
import { addNotification, setNotifications } from './redux/rtnSlice';
import axios from 'axios';
import ProtectedRoutes from './components/ProtectedRoutes';
import RequireAuth from './components/RequireAuth';
import ErrorBoundary from './components/ErrorBoundary';

// Route-level code splitting: only the shell (layout + home + auth) loads
// up-front; every other page is fetched on first navigation.
const Profile = lazy(() => import('./components/Profile'));
const Explore = lazy(() => import('./components/Explore'));
const Search = lazy(() => import('./components/Search'));
const Notifications = lazy(() => import('./components/Notifications'));
const EditProfile = lazy(() => import('./components/EditProfile'));
const Chat = lazy(() => import('./components/Chat'));
const PostDetail = lazy(() => import('./components/PostDetail'));
const HashtagPage = lazy(() => import('./components/HashtagPage'));
const UsernameRedirect = lazy(() => import('./components/UsernameRedirect'));
const Settings = lazy(() => import('./components/Settings'));
const Followers = lazy(() => import('./components/Followers'));
const Following = lazy(() => import('./components/Following'));

const PageLoader = () => (
  <div className='flex justify-center items-center min-h-[60vh]'>
    <Loader2 className='h-8 w-8 animate-spin text-zinc-500' />
  </div>
);
const lazily = (el) => <Suspense fallback={<PageLoader />}>{el}</Suspense>;
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
        element: lazily(<Search />)
      },
      {
        path: "/explore",
        element: lazily(<Explore />)
      },
      {
        path: `/profile/:id`,
        element: lazily(<Profile />)
      },
      {
        path: "/post/:id",
        element: lazily(<PostDetail />)
      },
      {
        path: "/tags/:tag",
        element: lazily(<HashtagPage />)
      },
      {
        path: "/u/:username",
        element: lazily(<UsernameRedirect />)
      },
      {
        path: "/messages",
        element: <RequireAuth>{lazily(<Chat />)}</RequireAuth>
      },
      {
        path: "/notifications",
        element: <RequireAuth>{lazily(<Notifications />)}</RequireAuth>
      },
      {
        path: "/profile/edit",
        element: <RequireAuth>{lazily(<EditProfile />)}</RequireAuth>
      },
      {
        path: "/settings",
        element: <RequireAuth>{lazily(<Settings />)}</RequireAuth>
      },
      {
        path: "/chat",
        element: <RequireAuth>{lazily(<Chat />)}</RequireAuth>
      },
      {
        path: "/chat/group/:groupId",
        element: <RequireAuth>{lazily(<Chat />)}</RequireAuth>
      },
      {
        path: "/chat/:id",
        element: <RequireAuth>{lazily(<Chat />)}</RequireAuth>
      },
      {
        path: "/:id/followers",
        element: lazily(<Followers />)
      },
      {
        path: "/:id/following",
        element: lazily(<Following />)
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
  // Keyed on user._id, NOT the user object: every like/bookmark/follow
  // dispatches a fresh user object, and depending on it tore the socket down
  // and reconnected mid-session, dropping any events that arrived in the gap.
  const userId = user?._id;
  useEffect(() => {
    if (userId) {
      // Same-origin connection: proxied by Vite in dev, served by the backend
      // itself in production. Identity comes from the httpOnly JWT cookie —
      // the server no longer trusts a client-supplied userId. The instance
      // lives in a module singleton (not redux — it isn't serializable).
      const socketio = connectSocket();

      // Full snapshot on connect, then delta events
      socketio.on('getOnlineUsers', (onlineUsers) => {
        dispatch(setOnlineUsers(onlineUsers));
      });
      socketio.on('userOnline', (id) => dispatch(addOnlineUser(id)));
      socketio.on('userOffline', (id) => dispatch(removeOnlineUser(id)));
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
  }, [userId, dispatch]);

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
    <ErrorBoundary>
      <RouterProvider router={browserRouter} />
    </ErrorBoundary>
  )
}

export default App