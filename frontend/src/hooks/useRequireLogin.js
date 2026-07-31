import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

// Gate for user actions in guest mode. Usage:
//   const requireLogin = useRequireLogin();
//   const onLike = () => { if (!requireLogin()) return; ...actual action... }
// Returns true when a user is logged in; otherwise toasts, redirects to
// /login (remembering where the guest was), and returns false.
const useRequireLogin = () => {
  const { user } = useSelector((store) => store.auth);
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    if (user) return true;
    toast.info("Log in to continue");
    navigate("/login", { state: { from: location.pathname } });
    return false;
  }, [user, navigate, location.pathname]);
};

export default useRequireLogin;
