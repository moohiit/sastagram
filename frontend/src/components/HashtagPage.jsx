import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useParams } from 'react-router-dom'
import { Heart, Loader2, MessageCircle, Play } from 'lucide-react'
import { cdn } from '@/lib/cdn'

// /tags/:tag — grid of posts carrying a hashtag, with load-more pagination.
function HashtagPage() {
  const { tag } = useParams()
  const [posts, setPosts] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchPage = async (cursor) => {
    const url = `/api/v1/post/tags/${encodeURIComponent(tag)}${
      cursor ? `?cursor=${cursor}` : ''
    }`
    const response = await axios.get(url, { withCredentials: true })
    return response.data
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPosts([])
    setNextCursor(null)
    fetchPage(null)
      .then((data) => {
        if (cancelled || !data.success) return
        setPosts(data.posts || [])
        setNextCursor(data.nextCursor)
      })
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag])

  const loadMore = async () => {
    try {
      const data = await fetchPage(nextCursor)
      if (data.success) {
        setPosts((prev) => [...prev, ...(data.posts || [])])
        setNextCursor(data.nextCursor)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className='w-full max-w-4xl mx-auto px-4 py-6'>
      <h1 className='text-xl font-bold text-gray-100 mb-1'>#{tag}</h1>
      <p className='text-sm text-zinc-400 mb-4'>
        {posts.length.toLocaleString()} {posts.length === 1 ? 'post' : 'posts'}
        {nextCursor ? '+' : ''}
      </p>
      {loading ? (
        <div className='flex justify-center py-16'>
          <Loader2 className='h-8 w-8 animate-spin text-zinc-500' />
        </div>
      ) : posts.length === 0 ? (
        <p className='text-sm text-zinc-400 py-16 text-center'>
          No posts with this hashtag yet.
        </p>
      ) : (
        <div className='grid grid-cols-3 gap-1'>
          {posts.map((post) => (
            <Link key={post._id} to={`/post/${post._id}`} className='relative group aspect-square'>
              <img
                src={cdn(post.image, 400)}
                alt={post.altText || post.caption?.slice(0, 80) || 'Post'}
                loading='lazy'
                className='w-full h-full object-cover'
              />
              {post.mediaType === 'video' && (
                <Play size={18} fill='white' className='absolute top-2 right-2 text-white drop-shadow' />
              )}
              <div className='absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white text-sm font-semibold'>
                <span className='flex items-center gap-1'>
                  <Heart size={16} fill='white' /> {post.likesCount ?? 0}
                </span>
                <span className='flex items-center gap-1'>
                  <MessageCircle size={16} fill='white' /> {post.comments?.length ?? 0}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
      {nextCursor && !loading && (
        <div className='flex justify-center mt-6'>
          <button
            onClick={loadMore}
            className='text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer'
          >
            Load more
          </button>
        </div>
      )}
    </div>
  )
}

export default HashtagPage
