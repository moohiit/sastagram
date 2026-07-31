import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

// Route wrapper for pages that only make sense with a logged-in user
// (messages, notifications, edit profile). Guests are sent to /login and
// returned to where they were headed after logging in.
const RequireAuth = ({ children }) => {
  const { user } = useSelector((store) => store.auth);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
};

export default RequireAuth;
