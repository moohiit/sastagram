import React from 'react'
import { Bookmark, Heart, MessageCircle, Send } from 'lucide-react'
import './feed.css'

// Action row under the post image: like / comment / share, bookmark right-aligned.
function PostActions({ liked, popping, bookmarked, onLike, onComment, onShare, onBookmark }) {
  return (
    <div className='flex items-center justify-between px-3 pt-2'>
      <div className='flex items-center gap-4'>
        <button
          aria-label={liked ? 'Unlike' : 'Like'}
          onClick={onLike}
          className='cursor-pointer transition-colors'
        >
          <Heart
            size={24}
            strokeWidth={liked ? 2.5 : 2}
            fill={liked ? 'currentColor' : 'none'}
            className={`${liked ? 'text-red-500' : 'text-gray-900 hover:text-gray-500'} ${popping ? 'like-pop' : ''}`}
          />
        </button>
        <button aria-label='Comments' onClick={onComment} className='cursor-pointer'>
          <MessageCircle size={24} className='text-gray-900 hover:text-gray-500 -scale-x-100' />
        </button>
        <button aria-label='Share' onClick={onShare} className='cursor-pointer'>
          <Send size={24} className='text-gray-900 hover:text-gray-500' />
        </button>
      </div>
      <button
        aria-label={bookmarked ? 'Remove bookmark' : 'Save'}
        onClick={onBookmark}
        className='cursor-pointer'
      >
        <Bookmark
          size={24}
          strokeWidth={bookmarked ? 2.5 : 2}
          fill={bookmarked ? 'currentColor' : 'none'}
          className='text-gray-900 hover:text-gray-500'
        />
      </button>
    </div>
  )
}

export default PostActions
