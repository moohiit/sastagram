import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { setAuthUser } from '@/redux/authSlice';
import { Button } from '../ui/button';
import useRequireLogin from '@/hooks/useRequireLogin';

// Reusable follow/unfollow toggle. Keeps the existing
// GET /api/v1/user/followorunfollow/:id contract and authSlice update.
// Guests see the Follow button too — clicking it routes them to /login.
// variant="link" renders the IG-sidebar textual blue link instead of a button.
const FollowButton = ({ userId, className = '', variant = 'button', initialRequested = false }) => {
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();
  const requireLogin = useRequireLogin();
  const [loading, setLoading] = useState(false);
  // Private accounts: a follow becomes a pending request ("Requested")
  const [requested, setRequested] = useState(initialRequested);

  if (!userId || (user && user._id === userId)) return null;
  const isFollowing = user?.following?.includes(userId);

  const followUnfollowHandler = async () => {
    if (!requireLogin()) return;
    if (loading) return;
    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/user/followorunfollow/${userId}`, {
        withCredentials: true,
      });
      if (response.data.success) {
        const { type } = response.data;
        if (type === 'requested' || type === 'unrequested') {
          setRequested(type === 'requested');
        } else {
          const newFollowing = type === 'follow'
            ? [...(user.following || []), userId]
            : (user.following || []).filter(id => id !== userId);
          dispatch(setAuthUser({ ...user, following: newFollowing }));
        }
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  const labelText = isFollowing ? 'Following' : requested ? 'Requested' : 'Follow';
  const muted = isFollowing || requested;

  if (variant === 'link') {
    return (
      <button
        type='button'
        onClick={followUnfollowHandler}
        disabled={loading}
        className={`text-xs font-semibold cursor-pointer disabled:opacity-50 ${
          muted ? 'text-zinc-400 hover:text-gray-100' : 'text-blue-400 hover:text-blue-300'
        } ${className}`}
      >
        {labelText}
      </button>
    );
  }

  return (
    <Button
      onClick={followUnfollowHandler}
      disabled={loading}
      variant={muted ? 'secondary' : 'default'}
      className={`h-8 px-4 text-sm font-semibold ${
        muted ? 'text-gray-100' : 'bg-blue-500 hover:bg-blue-600 text-white'
      } ${className}`}
    >
      {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : labelText}
    </Button>
  );
};

export default FollowButton;
