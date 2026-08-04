import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { useParams, Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import Post from './Post'

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
      </div>
    </div>
  )
}

export default PostDetail
