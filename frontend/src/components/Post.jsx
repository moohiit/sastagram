import React, { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch, useSelector } from 'react-redux'
import { Heart } from 'lucide-react'
import { cdn } from '@/lib/cdn'
import { updatePostById, removePostById, setPostLiked } from '@/redux/postSlice'
import { setAuthUser } from '@/redux/authSlice'
import useRequireLogin from '@/hooks/useRequireLogin'
import CommentDialog from './CommentDialog'
import PostHeader from './feed/PostHeader'
import PostActions from './feed/PostActions'
import PostCaption from './feed/PostCaption'
import PostPoll from './feed/PostPoll'
import EditCaptionDialog from './feed/EditCaptionDialog'
import SharePostDialog from './feed/SharePostDialog'
import './feed/feed.css'

const DOUBLE_TAP_MS = 300

function Post({ post }) {
  const { user } = useSelector((store) => store.auth)
  const dispatch = useDispatch()
  const requireLogin = useRequireLogin()

  const [comment, setComment] = useState('')
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Stage 2 API shape (likedByMe/likesCount) with legacy likes-array fallback
  const [liked, setLiked] = useState(
    post.likedByMe ?? post.likes?.includes(user?._id) ?? false
  )
  const [likeCount, setLikeCount] = useState(post.likesCount ?? post.likes?.length ?? 0)
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
  // Per-post reducer — replacing the whole array from a pre-await snapshot
  // used to wipe feed pages loaded while the request was in flight.
  const setLikeState = (nextLiked) => {
    setLiked(nextLiked)
    setLikeCount((c) => (nextLiked ? c + 1 : c - 1))
    dispatch(setPostLiked({ _id: post._id, userId: user._id, liked: nextLiked }))
  }

  const toggleLike = async (forceLike = false) => {
    if (!requireLogin()) return
    if (likeBusyRef.current) return
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
      if (!requireLogin()) return
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
  const addCommentHandler = async (force = false) => {
    if (!requireLogin()) return
    const text = comment.trim()
    if (!text) return
    try {
      const response = await axios.post(
        `/api/v1/post/${post._id}/comment`,
        { text, force },
        { withCredentials: true }
      )
      if (response.data.flagged) {
        toast.warning('This comment may be hurtful', {
          description: 'Our AI flagged it. Post it anyway?',
          action: { label: 'Post anyway', onClick: () => addCommentHandler(true) },
        })
        return
      }
      if (response.data.success) {
        dispatch(
          updatePostById({
            _id: post._id,
            changes: {
              comments: [...comments, response.data.comment],
              commentsCount: (post.commentsCount ?? comments.length) + 1,
            },
          })
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
    if (!requireLogin()) return
    try {
      const response = await axios.get(`/api/v1/post/${post._id}/bookmark`, {
        withCredentials: true,
      })
      if (response?.data.success) {
        const saved = response.data?.type === 'saved'
        // Guarded — a persisted auth object from an old app version may not
        // have these arrays at all
        const bookmarks = user.bookmarks || []
        const newBookmarks = saved
          ? [...bookmarks.filter((id) => id !== post._id), post._id]
          : bookmarks.filter((id) => id !== post._id)
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
        dispatch(removePostById(post._id))
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
    if (!requireLogin()) return
    try {
      const response = await axios.get(`/api/v1/user/followorunfollow/${post.author._id}`, {
        withCredentials: true,
      })
      if (response.data.success) {
        const following = user.following || []
        const newFollowing =
          response.data.type === 'follow'
            ? [...following.filter((id) => id !== post.author._id), post.author._id]
            : following.filter((id) => id !== post.author._id)
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
    <article className='bg-black border-b border-zinc-800 pb-4 mb-4 w-full'>
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

      {post.mediaType === 'video' ? (
        <video
          src={post.video}
          poster={cdn(post?.image, 800)}
          controls
          playsInline
          loop
          preload='metadata'
          className='w-full aspect-square object-contain bg-black'
        />
      ) : (
        <div
          className='relative w-full select-none cursor-pointer'
          style={{ touchAction: 'manipulation' }}
          onClick={imageTapHandler}
        >
          <img
            className='w-full aspect-square object-cover'
            src={cdn(post?.image, 800)}
            alt={post?.altText || (post?.caption ? post.caption.slice(0, 80) : 'Post')}
            loading='lazy'
            draggable={false}
          />
          {showBurst && (
            <div key={burstKey} className='absolute inset-0 flex items-center justify-center pointer-events-none'>
              <Heart size={96} fill='white' className='text-white heart-burst drop-shadow-lg' />
            </div>
          )}
        </div>
      )}

      <PostActions
        liked={liked}
        popping={popping}
        bookmarked={bookmarked}
        onLike={() => toggleLike()}
        onComment={() => setCommentsOpen(true)}
        onShare={() => setShareOpen(true)}
        onBookmark={bookmarkHandler}
      />

      {likeCount > 0 && (
        <div className='px-3 pt-2'>
          <span className='text-sm font-semibold text-gray-100'>
            {likeCount.toLocaleString()} {likeCount === 1 ? 'like' : 'likes'}
          </span>
        </div>
      )}

      <PostCaption post={post} />

      {post.poll && <PostPoll post={post} />}

      {(post.commentsCount ?? comments.length) > 0 && (
        <button
          onClick={() => setCommentsOpen(true)}
          className='block px-3 pt-1 text-sm text-zinc-400 cursor-pointer hover:text-gray-100'
        >
          {(post.commentsCount ?? comments.length) === 1
            ? 'View 1 comment'
            : `View all ${post.commentsCount ?? comments.length} comments`}
        </button>
      )}

      <div className='flex items-center gap-2 px-3 py-3'>
        <input
          type='text'
          value={comment}
          readOnly={!user}
          onFocus={(e) => {
            if (!user) {
              e.target.blur()
              requireLogin()
            }
          }}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addCommentHandler()
          }}
          placeholder={user ? 'Add a comment...' : 'Log in to comment'}
          className='flex-1 outline-none text-sm text-gray-100 placeholder:text-zinc-500 bg-transparent'
        />
        {comment.trim() && (
          <button
            onClick={() => addCommentHandler()}
            className='text-sm font-semibold text-blue-400 hover:text-blue-300 cursor-pointer'
          >
            Post
          </button>
        )}
      </div>

      <CommentDialog open={commentsOpen} setOpen={setCommentsOpen} post={post} />
      <EditCaptionDialog open={editOpen} setOpen={setEditOpen} post={post} />
      <SharePostDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        post={post}
        onCopyLink={copyLinkHandler}
      />
    </article>
  )
}

export default Post
