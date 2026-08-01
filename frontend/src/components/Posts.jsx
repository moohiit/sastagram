import React, { useCallback, useEffect, useRef, useState } from 'react'
import Post from './Post'
import PostSkeleton from './feed/PostSkeleton'
import { useDispatch, useSelector } from 'react-redux'
import { appendFeedPage } from '@/redux/postSlice'
import axios from 'axios'
import { Loader2 } from 'lucide-react'
import { Button } from './ui/button'

const PAGE_SIZE = 10

function Posts() {
  const { posts, nextCursor, hasFetched } = useSelector((store) => store.post)
  const dispatch = useDispatch()
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const sentinelRef = useRef(null)
  const loadingRef = useRef(false)
  const cursorRef = useRef(nextCursor)
  cursorRef.current = nextCursor
  const errorRef = useRef(loadError)
  errorRef.current = loadError

  const loadNextPage = useCallback(async () => {
    if (loadingRef.current || !cursorRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    setLoadError(false)
    try {
      const response = await axios.get(
        `/api/v1/post/all?limit=${PAGE_SIZE}&cursor=${cursorRef.current}`,
        { withCredentials: true }
      )
      if (response.data.success) {
        dispatch(
          appendFeedPage({
            posts: response.data.posts,
            nextCursor: response.data.nextCursor,
          })
        )
      } else {
        setLoadError(true)
      }
    } catch (error) {
      console.error(error)
      setLoadError(true)
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }, [dispatch])

  // Infinite scroll: fetch the next cursor page when the sentinel is visible.
  // Pauses while in the error state so retry stays a manual action.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !errorRef.current) loadNextPage()
      },
      { rootMargin: '400px' }
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [loadNextPage])

  // First page still loading (fetched by useGetAllPost on Home)
  if (!hasFetched && posts.length === 0) {
    return (
      <>
        <PostSkeleton />
        <PostSkeleton />
        <PostSkeleton />
      </>
    )
  }

  return (
    <>
      {hasFetched && posts.length === 0 && (
        <div className='bg-black border border-zinc-800 rounded-lg p-8 text-center'>
          <p className='text-base font-semibold text-gray-100'>No posts yet</p>
          <p className='text-sm text-zinc-400 mt-1'>Follow people to see their photos here.</p>
        </div>
      )}

      {posts.map((post) => (
        <Post key={post._id} post={post} />
      ))}

      <div ref={sentinelRef} className='flex flex-col items-center justify-center py-4 gap-2'>
        {loadingMore && <Loader2 className='h-6 w-6 animate-spin text-zinc-400' />}
        {loadError && !loadingMore && (
          <>
            <span className='text-sm text-zinc-400'>Couldn&apos;t load more posts.</span>
            <Button onClick={loadNextPage} className='bg-blue-500 hover:bg-blue-600 h-8'>
              Retry
            </Button>
          </>
        )}
        {!nextCursor && posts.length > 0 && (
          <span className='text-xs text-zinc-500'>You&apos;re all caught up</span>
        )}
      </div>
    </>
  )
}

export default Posts
