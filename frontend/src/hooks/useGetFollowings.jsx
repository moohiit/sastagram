import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { setFollowings } from '@/redux/authSlice';
import { toast } from 'sonner';

const useGetFollowings = () => {
  const dispatch = useDispatch();
  // Keyed on the id, not the user object — every like/bookmark dispatches a
  // fresh user object and used to refire this fetch on each one.
  const userId = useSelector(store => store.auth.user?._id);

  useEffect(() => {
    const getFollowings = async () => {
      try {
        const response = await axios.get(`/api/v1/user/${userId}/following`, {
          withCredentials: true,
        });
        if (response.data.success) {
          // console.log(response.data.following)
          // toast.success(response.data.message)
          dispatch(setFollowings(response.data.following));
        }
      } catch (error) {
        // console.log("Something went wrong")
        console.log(error);
        toast.error(error.response?.data?.message || 'Something went wrong');
      }
    };

    if (userId) {
      getFollowings();
    }
  }, [dispatch, userId]);
};

export default useGetFollowings;
