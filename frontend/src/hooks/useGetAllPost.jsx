import { setPosts } from "@/redux/postSlice";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

const useGetAllPost = () => {
  const dispatch = useDispatch();
  // Fetch once on mount — depending on `posts` here caused an infinite
  // fetch -> setPosts -> refetch loop that hammered the API.
  useEffect(() => {
    const fetchAllPost = async () => {
      try {
        const response = await axios.get("/api/v1/post/all", {
          withCredentials: true,
        });
        if (response.data.success) {
          dispatch(setPosts(response.data.posts));
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchAllPost();
  }, [dispatch]);
};

export default useGetAllPost;
