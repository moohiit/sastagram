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
import { io } from 'socket.io-client';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSocket } from './redux/socketSlice';
import { setOnlineUsers } from './redux/chatSlice';
import { setLiveNotification } from './redux/rtnSlice';
import ProtectedRoutes from './components/ProtectedRoutes';
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
        element: <Chat />
      },
      {
        path: "/notifications",
        element: <Notifications />
      },
      {
        path: "/profile/edit",
        element: <EditProfile />
      },
      {
        path: "/chat",
        element: <Chat />
      },
      {
        path: "/chat/:id",
        element: <Chat />
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
  const { socket } = useSelector(store => store.socketio);
  const dispatch = useDispatch();
  useEffect(() => {
    if (user) {
      // Same-origin connection: proxied by Vite in dev, served by the backend
      // itself in production. Identity comes from the httpOnly JWT cookie —
      // the server no longer trusts a client-supplied userId.
      const socketio = io("/", {
        transports: ['websocket'],
        withCredentials: true,
      });

      socketio.on('connect', () => {
        console.log('Connected to socket server');
      });

      dispatch(setSocket(socketio));

      socketio.on('getOnlineUsers', (onlineUsers) => {
        console.log('Online Users:', onlineUsers);
        dispatch(setOnlineUsers(onlineUsers));
      });
      socketio.on('notification', (notification) => {
        dispatch(setLiveNotification(notification))
      })
      return () => {
        socketio.close();
        dispatch(setOnlineUsers(null));
        console.log('Socket closed');
      }
    } else if (socket) {
      socket.close();
      dispatch(setOnlineUsers(null));
      console.log('Socket closed due to user logout');
    }
  }, [user, dispatch]);

  return (
    <>
      <RouterProvider router={browserRouter} />
    </>
  )
}

export default App