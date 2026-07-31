import { setFeedPage } from "@/redux/postSlice";
import axios from "axios";
import { useEffect } from "react";
import { useDispatch } from "react-redux";

const PAGE_SIZE = 10;

const useGetAllPost = () => {
  const dispatch = useDispatch();
  // Fetch the first page once on mount — depending on `posts` here caused an
  // infinite fetch -> setPosts -> refetch loop that hammered the API.
  useEffect(() => {
    const fetchFirstPage = async () => {
      try {
        const response = await axios.get(`/api/v1/post/all?limit=${PAGE_SIZE}`, {
          withCredentials: true,
        });
        if (response.data.success) {
          dispatch(setFeedPage({
            posts: response.data.posts,
            nextCursor: response.data.nextCursor,
          }));
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchFirstPage();
  }, [dispatch]);
};

export default useGetAllPost;
