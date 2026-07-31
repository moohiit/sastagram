import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useSelector } from 'react-redux'
import useRequireLogin from '@/hooks/useRequireLogin'
import useSocket from '@/hooks/useSocket'

// Single-choice poll under the caption. Before voting: option buttons.
// After voting (or for guests): result bars with live counts via "pollUpdate".
// Tapping a result bar re-votes (changeable choice); guests get the login gate.
function PostPoll({ post }) {
  const { user } = useSelector((store) => store.auth)
  const requireLogin = useRequireLogin()
  const socket = useSocket()
  const poll = post?.poll

  // Derive the user's existing choice from the votes arrays on the post doc
  const initialChoice = () => {
    if (!user || !poll) return null
    const idx = poll.options.findIndex((o) => (o.votes || []).includes(user._id))
    return idx === -1 ? null : idx
  }
  const [myOption, setMyOption] = useState(initialChoice)
  const [counts, setCounts] = useState(() =>
    (poll?.options || []).map((o) => (o.votes || []).length)
  )
  const [voting, setVoting] = useState(false)

  // Live updates: counts are public — update whenever this post's poll changes,
  // but keep our own selection state untouched.
  useEffect(() => {
    if (!socket) return
    const onPollUpdate = ({ postId, counts: nextCounts } = {}) => {
      if (postId === post._id && Array.isArray(nextCounts)) setCounts(nextCounts)
    }
    socket.on('pollUpdate', onPollUpdate)
    return () => socket.off('pollUpdate', onPollUpdate)
  }, [socket, post._id])

  if (!poll) return null

  const totalVotes = counts.reduce((sum, n) => sum + n, 0)
  // Guests see results (public data); logged-in users see buttons until they vote
  const showResults = !user || myOption !== null

  const voteHandler = async (optionIndex) => {
    if (!requireLogin()) return
    if (voting || optionIndex === myOption) return
    try {
      setVoting(true)
      const response = await axios.post(
        `/api/v1/post/${post._id}/vote`,
        { optionIndex },
        { withCredentials: true }
      )
      if (response.data.success) {
        setCounts(response.data.counts)
        setMyOption(response.data.userOption)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not record vote')
    } finally {
      setVoting(false)
    }
  }

  return (
    <div className='px-3 pt-2'>
      <div className='border border-gray-200 rounded-lg p-3'>
        <p className='text-sm font-semibold text-gray-900 mb-2'>{poll.question}</p>
        <div className='space-y-1.5'>
          {poll.options.map((option, index) =>
            showResults ? (
              <button
                key={index}
                onClick={() => voteHandler(index)}
                disabled={voting}
                className='relative w-full overflow-hidden rounded-md border border-gray-200 px-3 py-1.5 text-left cursor-pointer disabled:opacity-70'
              >
                <span
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ${
                    index === myOption ? 'bg-blue-500/20' : 'bg-gray-200'
                  }`}
                  style={{
                    width: `${totalVotes ? Math.round((counts[index] / totalVotes) * 100) : 0}%`,
                  }}
                />
                <span className='relative flex items-center justify-between gap-2 text-sm'>
                  <span
                    className={
                      index === myOption ? 'font-semibold text-blue-500' : 'text-gray-900'
                    }
                  >
                    {option.text}
                  </span>
                  <span className='text-xs text-gray-500 shrink-0'>
                    {totalVotes ? Math.round((counts[index] / totalVotes) * 100) : 0}% ·{' '}
                    {counts[index] ?? 0}
                  </span>
                </span>
              </button>
            ) : (
              <button
                key={index}
                onClick={() => voteHandler(index)}
                disabled={voting}
                className='w-full rounded-md border border-gray-200 px-3 py-1.5 text-left text-sm text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors disabled:opacity-70'
              >
                {option.text}
              </button>
            )
          )}
        </div>
        <p className='text-xs text-gray-400 mt-2'>
          {totalVotes.toLocaleString()} {totalVotes === 1 ? 'vote' : 'votes'}
          {user && myOption !== null && ' · Tap to change'}
        </p>
      </div>
    </div>
  )
}

export default PostPoll
