import { setUserProfile } from "@/redux/authSlice";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

const useGetUserProfile = (userId) => {
  const dispatch = useDispatch();
  useEffect(() => {
    if (!userId) return; // allows callers to invoke the hook unconditionally
    const fetchUserProfile = async () => {
      try {
        // console.log("ID",userId);
        const response = await axios.get(`/api/v1/user/${userId}/profile`, {
          withCredentials: true
        })
        if (response.data.success) {
          dispatch(setUserProfile(response.data.user))
        }
      } catch (error) {
        console.log(error);
        console.log("Error in fetching user profile");
      }
    }
    fetchUserProfile();
  }, [userId])
}

export default useGetUserProfile;