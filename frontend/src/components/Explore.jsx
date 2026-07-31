import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Heart, MessageCircle } from 'lucide-react'
import { cdn } from '@/lib/cdn'
import CommentDialog from './CommentDialog'

function Explore() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [open, setOpen] = useState(false)

  const fetchPosts = async () => {
    setLoading(true)
    setError(false)
    try {
      const response = await axios.get('/api/v1/post/all?limit=30', { withCredentials: true })
      if (response.data.success) {
        setPosts(response.data.posts || [])
      } else {
        setError(true)
      }
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const openPost = (post) => {
    setSelectedPost(post)
    setOpen(true)
  }

  return (
    <div className='max-w-4xl mx-auto p-4'>
      <h1 className='text-xl font-bold text-gray-900 mb-4'>Explore</h1>

      {loading && (
        <div className='grid grid-cols-3 gap-1'>
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className='aspect-square animate-pulse bg-gray-200 rounded' />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className='flex flex-col items-center gap-2 py-16'>
          <p className='text-sm text-gray-500'>Couldn&apos;t load posts.</p>
          <button
            onClick={fetchPosts}
            className='text-sm font-semibold text-blue-500 hover:text-blue-700 cursor-pointer'
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className='grid grid-cols-3 gap-1'>
          {posts.map((post) => (
            <button
              key={post._id}
              onClick={() => openPost(post)}
              className='group relative aspect-square overflow-hidden bg-gray-100 focus:outline-none cursor-pointer'
            >
              <img
                src={cdn(post.image, 500)}
                alt={post.caption ? post.caption.slice(0, 60) : 'Post'}
                loading='lazy'
                className='w-full h-full object-cover'
              />
              {/* Hover overlay with like/comment counts (desktop) */}
              <div className='absolute inset-0 hidden md:flex items-center justify-center gap-6 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity'>
                <span className='flex items-center gap-1.5 text-white text-sm font-semibold'>
                  <Heart size={20} fill='currentColor' />
                  {post.likes?.length ?? 0}
                </span>
                <span className='flex items-center gap-1.5 text-white text-sm font-semibold'>
                  <MessageCircle size={20} fill='currentColor' />
                  {post.comments?.length ?? 0}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selectedPost && <CommentDialog open={open} setOpen={setOpen} post={selectedPost} />}
    </div>
  )
}

export default Explore
