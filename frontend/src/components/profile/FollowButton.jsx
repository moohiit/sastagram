import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { setAuthUser } from '@/redux/authSlice';
import { Button } from '../ui/button';

// Reusable follow/unfollow toggle. Keeps the existing
// GET /api/v1/user/followorunfollow/:id contract and authSlice update.
const FollowButton = ({ userId, className = '' }) => {
  const { user } = useSelector(store => store.auth);
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);

  if (!user || !userId || user._id === userId) return null;
  const isFollowing = user.following?.includes(userId);

  const followUnfollowHandler = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const response = await axios.get(`/api/v1/user/followorunfollow/${userId}`, {
        withCredentials: true,
      });
      if (response.data.success) {
        const newFollowing = response.data.type === 'follow'
          ? [...(user.following || []), userId]
          : (user.following || []).filter(id => id !== userId);
        dispatch(setAuthUser({ ...user, following: newFollowing }));
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={followUnfollowHandler}
      disabled={loading}
      variant={isFollowing ? 'secondary' : 'default'}
      className={`h-8 px-4 text-sm font-semibold ${
        isFollowing ? 'text-gray-900' : 'bg-blue-500 hover:bg-blue-600 text-white'
      } ${className}`}
    >
      {loading ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : isFollowing ? (
        'Following'
      ) : (
        'Follow'
      )}
    </Button>
  );
};

export default FollowButton;
