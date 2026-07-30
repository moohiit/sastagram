import React, { useEffect, useRef, useState } from 'react'
import Post from './Post'
import { useDispatch, useSelector } from 'react-redux'
import { appendFeedPage } from '@/redux/postSlice'
import axios from 'axios'
import { Loader2 } from 'lucide-react'

const PAGE_SIZE = 10;

function Posts() {
  const { posts, nextCursor } = useSelector(store => store.post);
  const dispatch = useDispatch();
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const cursorRef = useRef(nextCursor);
  cursorRef.current = nextCursor;

  // Infinite scroll: fetch the next cursor page when the sentinel is visible
  useEffect(() => {
    const observer = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingRef.current || !cursorRef.current) return;
      loadingRef.current = true;
      setLoadingMore(true);
      try {
        const response = await axios.get(
          `/api/v1/post/all?limit=${PAGE_SIZE}&cursor=${cursorRef.current}`,
          { withCredentials: true }
        );
        if (response.data.success) {
          dispatch(appendFeedPage({
            posts: response.data.posts,
            nextCursor: response.data.nextCursor,
          }));
        }
      } catch (error) {
        console.log(error);
      } finally {
        loadingRef.current = false;
        setLoadingMore(false);
      }
    }, { rootMargin: "400px" });

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [dispatch]);

  return (
    <>
      {posts.map((post) => (
        <Post key={post._id} post={post} />
      ))}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {loadingMore && <Loader2 className="h-6 w-6 animate-spin text-gray-500" />}
        {!nextCursor && posts.length > 0 && (
          <span className="text-xs text-gray-400">You're all caught up</span>
        )}
      </div>
    </>
  )
}

export default Posts
