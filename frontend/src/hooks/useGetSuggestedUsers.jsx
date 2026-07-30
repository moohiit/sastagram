import { setSuggestedusers } from "@/redux/authSlice";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

const useGetSuggestedUsers = () => {
  const dispatch = useDispatch();
  // Fetch once on mount — depending on the result caused an infinite refetch loop
  useEffect(() => {
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
  }, [dispatch]);
};

export default useGetSuggestedUsers;
