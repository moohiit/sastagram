import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cdn } from '@/lib/cdn'
import Post from './Post'

// "More like this" grid under the post — semantic vector search when AI is
// enabled, hashtag/author fallback otherwise.
function SimilarPosts({ postId }) {
  const [posts, setPosts] = useState([])

  useEffect(() => {
    let cancelled = false
    setPosts([])
    axios
      .get(`/api/v1/post/${postId}/similar`, { withCredentials: true })
      .then((response) => {
        if (!cancelled && response.data.success) setPosts(response.data.posts || [])
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [postId])

  if (posts.length === 0) return null
  return (
    <div className='mt-6 border-t border-zinc-800 pt-4'>
      <p className='text-sm font-semibold text-zinc-400 mb-3'>More like this</p>
      <div className='grid grid-cols-3 gap-1'>
        {posts.map((p) => (
          <Link key={p._id} to={`/post/${p._id}`} className='aspect-square'>
            <img
              src={cdn(p.image, 300)}
              alt={p.altText || p.caption?.slice(0, 60) || 'Post'}
              loading='lazy'
              className='w-full h-full object-cover rounded-sm hover:opacity-80 transition-opacity'
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

// Deep-link target for shared post URLs (/post/:id) — also opened from push
// notifications and the public API.
function PostDetail() {
  const { id } = useParams()
  const [post, setPost] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | missing

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const fetchPost = async () => {
      try {
        const response = await axios.get(`/api/v1/post/${id}`, { withCredentials: true })
        if (cancelled) return
        if (response.data.success) {
          setPost(response.data.post)
          setStatus('ready')
        } else {
          setStatus('missing')
        }
      } catch (error) {
        console.error(error)
        if (!cancelled) setStatus('missing')
      }
    }
    fetchPost()
    return () => {
      cancelled = true
    }
  }, [id])

  if (status === 'loading') {
    return (
      <div className='flex justify-center items-center min-h-[60vh]'>
        <Loader2 className='h-8 w-8 animate-spin text-zinc-500' />
      </div>
    )
  }

  if (status === 'missing') {
    return (
      <div className='flex flex-col items-center justify-center min-h-[60vh] gap-3'>
        <p className='text-gray-100 font-semibold'>This post isn&apos;t available.</p>
        <p className='text-sm text-zinc-400'>It may have been deleted.</p>
        <Link to='/' className='text-sm font-semibold text-blue-400 hover:text-blue-300'>
          Back to home
        </Link>
      </div>
    )
  }

  return (
    <div className='flex justify-center w-full py-6'>
      <div className='w-full max-w-[470px]'>
        <Post post={post} />
        <SimilarPosts postId={post._id} />
      </div>
    </div>
  )
}

export default PostDetail
