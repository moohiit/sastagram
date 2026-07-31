import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch, useSelector } from 'react-redux'
import { Heart } from 'lucide-react'
import { cdn } from '@/lib/cdn'
import { setPosts } from '@/redux/postSlice'
import { setAuthUser } from '@/redux/authSlice'
import CommentDialog from './CommentDialog'
import PostHeader from './feed/PostHeader'
import PostActions from './feed/PostActions'
import PostCaption from './feed/PostCaption'
import EditCaptionDialog from './feed/EditCaptionDialog'
import './feed/feed.css'

const DOUBLE_TAP_MS = 300

function Post({ post }) {
  const { user } = useSelector((store) => store.auth)
  const { posts } = useSelector((store) => store.post)
  const dispatch = useDispatch()

  const [comment, setComment] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [liked, setLiked] = useState(post.likes.includes(user?._id))
  const [likeCount, setLikeCount] = useState(post.likes.length)
  const [popping, setPopping] = useState(false)
  const [burstKey, setBurstKey] = useState(0)
  const [showBurst, setShowBurst] = useState(false)
  const bookmarked = user?.bookmarks?.includes(post._id)
  const isOwn = user?._id === post?.author?._id
  const isFollowing = user?.following?.includes(post?.author?._id)

  const lastTapRef = useRef(0)
  const burstTimerRef = useRef(null)
  const likeBusyRef = useRef(false)

  const comments = post.comments || []

  useEffect(() => () => clearTimeout(burstTimerRef.current), [])

  // ---- like / dislike (optimistic, reverts on failure) ----
  const setLikeState = (nextLiked) => {
    setLiked(nextLiked)
    setLikeCount((c) => (nextLiked ? c + 1 : c - 1))
    dispatch(
      setPosts(
        posts.map((p) =>
          p._id === post._id
            ? {
                ...p,
                likes: nextLiked
                  ? [...p.likes.filter((id) => id !== user._id), user._id]
                  : p.likes.filter((id) => id !== user._id),
              }
            : p
        )
      )
    )
  }

  const toggleLike = async (forceLike = false) => {
    if (!user || likeBusyRef.current) return
    const nextLiked = forceLike ? true : !liked
    if (forceLike && liked) return
    likeBusyRef.current = true
    setLikeState(nextLiked)
    if (nextLiked) {
      setPopping(true)
      setTimeout(() => setPopping(false), 350)
    }
    try {
      const action = nextLiked ? 'like' : 'dislike'
      const response = await axios.get(`/api/v1/post/${post._id}/${action}`, {
        withCredentials: true,
      })
      if (!response.data.success) setLikeState(!nextLiked)
    } catch (error) {
      console.error(error)
      setLikeState(!nextLiked)
      toast.error(error.response?.data?.message || 'Could not update like')
    } finally {
      likeBusyRef.current = false
    }
  }

  // Double-tap / double-click on the image: big heart burst + like.
  const imageTapHandler = () => {
    const now = Date.now()
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0
      setBurstKey((k) => k + 1)
      setShowBurst(true)
      clearTimeout(burstTimerRef.current)
      burstTimerRef.current = setTimeout(() => setShowBurst(false), 950)
      toggleLike(true)
    } else {
      lastTapRef.current = now
    }
  }

  // ---- comments ----
  const addCommentHandler = async () => {
    const text = comment.trim()
    if (!text) return
    try {
      const response = await axios.post(
        `/api/v1/post/${post._id}/comment`,
        { text },
        { withCredentials: true }
      )
      if (response.data.success) {
        const updatedComments = [...comments, response.data.comment]
        dispatch(
          setPosts(posts.map((p) => (p._id === post._id ? { ...p, comments: updatedComments } : p)))
        )
        setComment('')
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not add comment')
    }
  }

  // ---- bookmark ----
  const bookmarkHandler = async () => {
    try {
      const response = await axios.get(`/api/v1/post/${post._id}/bookmark`, {
        withCredentials: true,
      })
      if (response?.data.success) {
        const saved = response.data?.type === 'saved'
        const newBookmarks = saved
          ? [...user.bookmarks, post._id]
          : user.bookmarks.filter((id) => id !== post._id)
        dispatch(setAuthUser({ ...user, bookmarks: newBookmarks }))
        toast.success(response.data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not update bookmark')
    }
  }

  // ---- delete own post ----
  const deletePostHandler = async () => {
    try {
      setDeleting(true)
      const response = await axios.delete(`/api/v1/post/delete/${post._id}`, {
        withCredentials: true,
      })
      if (response.data.success) {
        dispatch(setPosts(posts.filter((p) => p._id !== post._id)))
        toast.success(response.data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not delete post')
    } finally {
      setDeleting(false)
    }
  }

  // ---- follow / unfollow ----
  const toggleFollowHandler = async () => {
    try {
      const response = await axios.get(`/api/v1/user/followorunfollow/${post.author._id}`, {
        withCredentials: true,
      })
      if (response.data.success) {
        const newFollowing =
          response.data.type === 'follow'
            ? [...user.following, post.author._id]
            : user.following.filter((id) => id !== post.author._id)
        dispatch(setAuthUser({ ...user, following: newFollowing }))
        toast.success(response.data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Something went wrong')
    }
  }

  // ---- share = copy link ----
  const copyLinkHandler = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/post/${post._id}`)
      toast.success('Link copied to clipboard')
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <article className='bg-white border border-gray-200 rounded-lg mb-4 w-full'>
      <PostHeader
        post={post}
        isOwn={isOwn}
        isFollowing={isFollowing}
        deleting={deleting}
        onDelete={deletePostHandler}
        onEditCaption={() => setEditOpen(true)}
        onCopyLink={copyLinkHandler}
        onToggleFollow={toggleFollowHandler}
      />

      <div
        className='relative w-full select-none cursor-pointer'
        style={{ touchAction: 'manipulation' }}
        onClick={imageTapHandler}
      >
        <img
          className='w-full aspect-square object-cover'
          src={cdn(post?.image, 800)}
          alt={post?.caption ? post.caption.slice(0, 80) : 'Post'}
          loading='lazy'
          draggable={false}
        />
        {showBurst && (
          <div key={burstKey} className='absolute inset-0 flex items-center justify-center pointer-events-none'>
            <Heart size={96} fill='white' className='text-white heart-burst drop-shadow-lg' />
          </div>
        )}
      </div>

      <PostActions
        liked={liked}
        popping={popping}
        bookmarked={bookmarked}
        onLike={() => toggleLike()}
        onComment={() => setCommentsOpen(true)}
        onShare={copyLinkHandler}
        onBookmark={bookmarkHandler}
      />

      {likeCount > 0 && (
        <div className='px-3 pt-2'>
          <span className='text-sm font-semibold text-gray-900'>
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </span>
        </div>
      )}

      <PostCaption post={post} />

      {comments.length > 0 && (
        <button
          onClick={() => setCommentsOpen(true)}
          className='block px-3 pt-1 text-sm text-gray-500 cursor-pointer hover:text-gray-900'
        >
          {comments.length === 1 ? 'View 1 comment' : `View all ${comments.length} comments`}
        </button>
      )}

      <div className='flex items-center gap-2 px-3 py-3'>
        <input
          type='text'
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addCommentHandler()
          }}
          placeholder='Add a comment...'
          className='flex-1 outline-none text-sm text-gray-900 placeholder:text-gray-400 bg-transparent'
        />
        {comment.trim() && (
          <button
            onClick={addCommentHandler}
            className='text-sm font-semibold text-blue-500 hover:text-blue-700 cursor-pointer'
          >
            Post
          </button>
        )}
      </div>

      <CommentDialog open={commentsOpen} setOpen={setCommentsOpen} post={post} />
      <EditCaptionDialog open={editOpen} setOpen={setEditOpen} post={post} />
    </article>
  )
}

export default Post
