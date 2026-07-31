import { setSuggestedusers } from "@/redux/authSlice";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

const useGetSuggestedUsers = () => {
  const dispatch = useDispatch();
  const userId = useSelector((store) => store.auth.user?._id);
  // Fetch once on mount — depending on the result caused an infinite refetch loop.
  // No-ops for guests: the suggestions endpoint requires auth.
  useEffect(() => {
    if (!userId) return;
    const fetchSuggestedUsers = async () => {
      try {
        const response = await axios.get("/api/v1/user/suggested", {
          withCredentials: true,
        });
        if (response.data.success) {
          dispatch(setSuggestedusers(response.data.users));
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchSuggestedUsers();
  }, [dispatch, userId]);
};

export default useGetSuggestedUsers;
