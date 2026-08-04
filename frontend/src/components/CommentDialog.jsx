import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Heart, Trash2, X } from 'lucide-react'
import { cdn } from '@/lib/cdn'
import { timeAgo } from '@/lib/utils'
import { updatePostById } from '@/redux/postSlice'
import RichText from './feed/RichText'
import useRequireLogin from '@/hooks/useRequireLogin'

// Instagram-style comments dialog: image left / thread right on desktop,
// stacked on mobile. Keeps redux feed state in sync; also works for posts
// that are not in the feed slice (e.g. opened from Explore) via local state.
function CommentDialog({ open, setOpen, post }) {
  const { posts } = useSelector((store) => store.post)
  const { user } = useSelector((store) => store.auth)
  const dispatch = useDispatch()
  const requireLogin = useRequireLogin()

  const feedPost = posts.find((p) => p._id === post._id)
  const [localComments, setLocalComments] = useState(post.comments || [])
  const comments = localComments

  const [comment, setComment] = useState('')
  const [replyTo, setReplyTo] = useState(null) // comment being replied to

  // The feed only carries a capped comment preview — load the full thread
  // when the dialog opens.
  useEffect(() => {
    if (!open) return
    setLocalComments(feedPost?.comments || post.comments || [])
    let cancelled = false
    const fetchComments = async () => {
      try {
        const response = await axios.get(`/api/v1/post/${post._id}/comment/all`, {
          withCredentials: true,
        })
        if (!cancelled && response.data.success) {
          setLocalComments(response.data.comments || [])
        }
      } catch (error) {
        console.error(error)
      }
    }
    fetchComments()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, post._id])

  const syncComments = (updatedComments) => {
    setLocalComments(updatedComments)
    if (feedPost) {
      // Keep the feed's preview + count in sync without replacing the array
      dispatch(
        updatePostById({
          _id: post._id,
          changes: { comments: updatedComments, commentsCount: updatedComments.length },
        })
      )
    }
  }

  const sendComment = async (force = false) => {
    if (!requireLogin()) return
    const text = comment.trim()
    if (!text) return
    try {
      const response = await axios.post(
        `/api/v1/post/${post._id}/comment`,
        { text, force, ...(replyTo ? { parentId: replyTo._id } : {}) },
        { withCredentials: true }
      )
      if (response.data.flagged) {
        toast.warning('This comment may be hurtful', {
          description: 'Our AI flagged it. Post it anyway?',
          action: { label: 'Post anyway', onClick: () => sendComment(true) },
        })
        return
      }
      if (response.data.success) {
        syncComments([...comments, response.data.comment])
        setComment('')
        setReplyTo(null)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not add comment')
    }
  }

  const deleteCommentHandler = async (commentId) => {
    if (!requireLogin()) return
    try {
      const response = await axios.delete(`/api/v1/post/comment/${commentId}`, {
        withCredentials: true,
      })
      if (response.data.success) {
        // Server removes the comment plus its replies
        const removed = new Set(response.data.removedIds || [response.data.commentId])
        syncComments(comments.filter((cmnt) => !removed.has(cmnt._id)))
        toast.success('Comment deleted')
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Failed to delete comment')
    }
  }

  const toggleCommentLike = async (target) => {
    if (!requireLogin()) return
    try {
      const response = await axios.post(
        `/api/v1/post/comment/${target._id}/like`,
        {},
        { withCredentials: true }
      )
      if (response.data.success) {
        setLocalComments((prev) =>
          prev.map((c) =>
            c._id === target._id
              ? { ...c, likedByMe: response.data.liked, likesCount: response.data.likesCount }
              : c
          )
        )
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not like comment')
    }
  }

  const fallbackInitials = (username) => (username || 'U').slice(0, 2).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='max-w-4xl p-0 gap-0 overflow-hidden rounded-lg'>
        <DialogTitle className='hidden'>Comments</DialogTitle>
        <DialogDescription className='hidden'>Comments on this post.</DialogDescription>
        <div className='flex flex-col md:flex-row max-h-[85vh]'>
          {/* Image */}
          <div className='bg-black md:w-1/2 shrink-0 flex items-center justify-center'>
            <img
              src={cdn(post.image, 800)}
              alt='Post'
              loading='lazy'
              className='w-full object-cover max-h-[35vh] md:max-h-none md:aspect-square'
            />
          </div>

          {/* Thread */}
          <div className='flex flex-col md:w-1/2 min-h-0 max-h-[85vh]'>
            {/* Header */}
            <div className='flex items-center gap-3 p-3 border-b border-zinc-800'>
              <Link to={`/profile/${post.author?._id}`}>
                <Avatar className='h-8 w-8'>
                  <AvatarImage src={post.author?.profilePicture} alt={post.author?.username} />
                  <AvatarFallback>{fallbackInitials(post.author?.username)}</AvatarFallback>
                </Avatar>
              </Link>
              <Link
                to={`/profile/${post.author?._id}`}
                className='text-sm font-semibold text-gray-100 hover:opacity-70'
              >
                {post.author?.username || 'Anonymous'}
              </Link>
            </div>

            {/* Comment list */}
            <div className='flex-1 overflow-y-auto p-3 space-y-4 min-h-[200px] max-h-[50vh] md:max-h-none'>
              {post.caption && (
                <div className='flex gap-3'>
                  <Avatar className='h-8 w-8 shrink-0'>
                    <AvatarImage src={post.author?.profilePicture} alt={post.author?.username} />
                    <AvatarFallback>{fallbackInitials(post.author?.username)}</AvatarFallback>
                  </Avatar>
                  <p className='text-sm text-gray-100'>
                    <span className='font-semibold mr-1.5'>{post.author?.username}</span>
                    <RichText text={post.caption} />
                    <span className='block text-xs text-zinc-500 mt-1'>{timeAgo(post.createdAt)}</span>
                  </p>
                </div>
              )}

              {comments.length === 0 && !post.caption && (
                <p className='text-sm text-zinc-400 text-center pt-8'>
                  No comments yet. Start the conversation.
                </p>
              )}

              {(() => {
                const topLevel = comments.filter((c) => !c.parent)
                const repliesFor = (id) => comments.filter((c) => c.parent === id)
                const renderRow = (cmnt, isReply) => (
                  <div key={cmnt._id} className={`flex gap-3 group ${isReply ? 'ml-10' : ''}`}>
                    <Link to={`/profile/${cmnt.author?._id}`} className='shrink-0'>
                      <Avatar className={isReply ? 'h-6 w-6' : 'h-8 w-8'}>
                        <AvatarImage src={cmnt.author?.profilePicture} alt={cmnt.author?.username} />
                        <AvatarFallback>{fallbackInitials(cmnt.author?.username)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm text-gray-100 break-words'>
                        <Link
                          to={`/profile/${cmnt.author?._id}`}
                          className='font-semibold mr-1.5 hover:opacity-70'
                        >
                          {cmnt.author?.username || 'Anonymous'}
                        </Link>
                        <RichText text={cmnt.text} />
                      </p>
                      <div className='flex items-center gap-3 text-xs text-zinc-500'>
                        <span>{timeAgo(cmnt.createdAt)}</span>
                        {(cmnt.likesCount ?? 0) > 0 && (
                          <span>{cmnt.likesCount} {cmnt.likesCount === 1 ? 'like' : 'likes'}</span>
                        )}
                        {user && (
                          <button
                            onClick={() => {
                              setReplyTo(cmnt)
                              setComment(`@${cmnt.author?.username} `)
                            }}
                            className='font-semibold hover:text-gray-100 cursor-pointer'
                          >
                            Reply
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => toggleCommentLike(cmnt)}
                      title={cmnt.likedByMe ? 'Unlike' : 'Like'}
                      className='self-start p-1 cursor-pointer'
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          cmnt.likedByMe ? 'text-red-500 fill-red-500' : 'text-zinc-500 hover:text-gray-100'
                        }`}
                      />
                    </button>
                    {user && (cmnt.author?._id === user._id || post.author?._id === user._id) && (
                      <button
                        onClick={() => deleteCommentHandler(cmnt._id)}
                        title='Delete comment'
                        className='text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity self-start p-1 cursor-pointer'
                      >
                        <Trash2 className='w-4 h-4' />
                      </button>
                    )}
                  </div>
                )
                return topLevel.map((cmnt) => (
                  <React.Fragment key={cmnt._id}>
                    {renderRow(cmnt, false)}
                    {repliesFor(cmnt._id).map((reply) => renderRow(reply, true))}
                  </React.Fragment>
                ))
              })()}
            </div>

            {/* Add comment */}
            {replyTo && (
              <div className='flex items-center justify-between border-t border-zinc-800 px-3 py-1.5 text-xs text-zinc-400'>
                <span>Replying to @{replyTo.author?.username}</span>
                <button
                  onClick={() => {
                    setReplyTo(null)
                    setComment('')
                  }}
                  className='p-1 cursor-pointer hover:text-gray-100'
                  title='Cancel reply'
                >
                  <X className='w-3.5 h-3.5' />
                </button>
              </div>
            )}
            <div className='flex items-center gap-2 border-t border-zinc-800 p-3'>
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
                  if (e.key === 'Enter') sendComment()
                }}
                placeholder={user ? 'Add a comment...' : 'Log in to comment'}
                className='flex-1 outline-none text-sm text-gray-100 placeholder:text-zinc-500 bg-transparent'
              />
              <button
                onClick={() => sendComment()}
                disabled={!comment.trim()}
                className='text-sm font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-default cursor-pointer'
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default CommentDialog
