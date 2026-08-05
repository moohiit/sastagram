import React, { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useSelector } from 'react-redux'
import { Loader2, Send, Trash2, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { cdn } from '@/lib/cdn'
import { timeAgo } from '@/lib/utils'

const STORY_DURATION_MS = 5000
const TAP_MAX_MS = 250
const SWIPE_DOWN_PX = 80
const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😮']

// Full-screen story viewer overlay. Auto-advances every 5s (CSS animation),
// pauses on press-and-hold, taps on left/right thirds navigate, swipe-down or
// Escape closes. Marks each story seen as it is displayed.
function StoryViewer({ groups, initialGroupIndex, onClose, onSeen, onDelete }) {
  const { user } = useSelector((store) => store.auth)
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)
  const [composing, setComposing] = useState(false) // reply input focused
  const pointerRef = useRef(null)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isOwn = group?.user._id === user?._id

  const goNext = useCallback(() => {
    const current = groups[groupIndex]
    if (!current) return onClose()
    if (storyIndex < current.stories.length - 1) {
      setStoryIndex(storyIndex + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex(groupIndex + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }, [groups, groupIndex, storyIndex, onClose])

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1)
    } else if (groupIndex > 0) {
      const prevGroup = groups[groupIndex - 1]
      setGroupIndex(groupIndex - 1)
      setStoryIndex(Math.max(prevGroup.stories.length - 1, 0))
    }
  }, [groups, groupIndex, storyIndex])

  // Close if the current group vanished (e.g. last story deleted elsewhere)
  useEffect(() => {
    if (!group || !story) onClose()
  }, [group, story, onClose])

  // Mark the displayed story as seen (server + local bar state)
  const storyId = story?._id
  useEffect(() => {
    if (!storyId) return
    axios
      .patch(`/api/v1/story/${storyId}/seen`, {}, { withCredentials: true })
      .catch(() => {})
    onSeen(groupIndex, storyId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId])

  // Keyboard: arrows navigate, Escape closes
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, goNext, goPrev])

  // Lock body scroll while the overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handlePointerDown = (e) => {
    pointerRef.current = { time: Date.now(), x: e.clientX, y: e.clientY }
    setPaused(true)
  }

  const handlePointerUp = (e) => {
    setPaused(false)
    const start = pointerRef.current
    pointerRef.current = null
    if (!start) return
    // Swipe down to close
    if (e.clientY - start.y > SWIPE_DOWN_PX) {
      onClose()
      return
    }
    // Short press = tap navigation (left third prev, rest next)
    if (Date.now() - start.time < TAP_MAX_MS && Math.abs(e.clientY - start.y) < 30) {
      const { left, width } = e.currentTarget.getBoundingClientRect()
      if (e.clientX - left < width / 3) goPrev()
      else goNext()
    }
  }

  // Reply / quick-react: lands in the DM thread with the author
  const sendReply = async (text) => {
    const message = (text ?? reply).trim()
    if (!message || replying || !story) return
    try {
      setReplying(true)
      const response = await axios.post(
        `/api/v1/story/${story._id}/reply`,
        { message },
        { withCredentials: true }
      )
      if (response.data.success) {
        toast.success('Sent')
        setReply('')
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not send reply')
    } finally {
      setReplying(false)
    }
  }

  const deleteStoryHandler = async () => {
    if (!story || deleting) return
    try {
      setDeleting(true)
      const response = await axios.delete(`/api/v1/story/${story._id}`, { withCredentials: true })
      if (response.data.success) {
        toast.success(response.data.message)
        const remaining = group.stories.length - 1
        onDelete(groupIndex, story._id)
        if (remaining === 0) onClose()
        else setStoryIndex((i) => Math.min(i, remaining - 1))
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not delete story')
    } finally {
      setDeleting(false)
    }
  }

  if (!group || !story) return null

  return (
    <div className='fixed inset-0 z-50 bg-black flex items-center justify-center' role='dialog' aria-label='Story viewer'>
      <div className='relative w-full h-full max-w-[470px] flex flex-col'>
        {/* Progress bars */}
        <div className='absolute top-0 inset-x-0 z-20 flex gap-1 p-3'>
          {group.stories.map((s, i) => (
            <div key={s._id} className='h-[3px] flex-1 rounded-full bg-gray-100/30 overflow-hidden'>
              {i < storyIndex && <div className='h-full w-full bg-gray-100' />}
              {i === storyIndex && (
                <div
                  key={`${group.user._id}-${s._id}`}
                  onAnimationEnd={goNext}
                  className='h-full bg-gray-100'
                  style={{
                    animation: `story-progress ${STORY_DURATION_MS}ms linear forwards`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Author header */}
        <div className='absolute top-6 inset-x-0 z-20 flex items-center gap-2 px-3'>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={cdn(group.user.profilePicture, 100)} alt={group.user.username} />
            <AvatarFallback>{(group.user.username || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className='text-sm font-semibold text-white'>{group.user.username}</span>
          <span className='text-xs text-white/70'>{timeAgo(story.createdAt)}</span>
          <div className='ml-auto flex items-center gap-1'>
            {isOwn && (
              <button
                onClick={deleteStoryHandler}
                disabled={deleting}
                aria-label='Delete story'
                className='p-2 text-white/90 hover:text-white cursor-pointer'
              >
                {deleting ? <Loader2 size={20} className='animate-spin' /> : <Trash2 size={20} />}
              </button>
            )}
            <button
              onClick={onClose}
              aria-label='Close'
              className='p-2 text-white/90 hover:text-white cursor-pointer'
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Story image + tap/hold/swipe surface */}
        <div
          className='flex-1 flex items-center justify-center select-none touch-none'
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => {
            pointerRef.current = null
            setPaused(false)
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={cdn(story.image, 1080)}
            alt={`Story by ${group.user.username}`}
            draggable={false}
            className='max-h-full max-w-full object-contain'
          />
        </div>

        {/* Reply bar — hidden on own stories. Pauses playback while typing. */}
        {!isOwn && (
          <div className='absolute bottom-0 inset-x-0 z-20 p-3 flex items-center gap-2'>
            <div className='flex-1 flex items-center gap-2 rounded-full border border-white/40 bg-black/40 backdrop-blur px-3 py-1.5'>
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onFocus={() => {
                  setComposing(true)
                  setPaused(true)
                }}
                onBlur={() => {
                  setComposing(false)
                  setPaused(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendReply()
                  e.stopPropagation()
                }}
                placeholder={`Reply to ${group.user.username}…`}
                className='flex-1 bg-transparent text-sm text-white placeholder:text-white/60 outline-none'
              />
              {reply.trim() && (
                <button
                  onClick={() => sendReply()}
                  disabled={replying}
                  aria-label='Send reply'
                  className='text-white cursor-pointer disabled:opacity-50'
                >
                  <Send size={16} />
                </button>
              )}
            </div>
            {!composing &&
              QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReply(emoji)}
                  disabled={replying}
                  aria-label={`React ${emoji}`}
                  className='text-xl leading-none cursor-pointer hover:scale-125 transition-transform disabled:opacity-50'
                >
                  {emoji}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default StoryViewer
