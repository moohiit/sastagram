import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarImage, AvatarFallback } from '../ui/avatar'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '../ui/dialog'
import { Loader2, MoreHorizontal } from 'lucide-react'
import { timeAgo } from '@/lib/utils'

// Post card header: avatar + username + relative time + "..." options menu.
function PostHeader({
  post,
  isOwn,
  isFollowing,
  deleting,
  onDelete,
  onEditCaption,
  onCopyLink,
  onToggleFollow,
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  const menuItem =
    'w-full py-3 text-sm text-center cursor-pointer hover:bg-gray-100 transition-colors border-b border-gray-200 last:border-b-0'

  return (
    <div className='flex items-center justify-between px-3 py-2.5'>
      <div className='flex items-center gap-2 min-w-0'>
        <Link to={`/profile/${post?.author?._id}`}>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={post?.author?.profilePicture} alt={post?.author?.username} />
            <AvatarFallback>
              {(post?.author?.username || 'U').slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className='flex items-center gap-1.5 min-w-0'>
          <Link
            to={`/profile/${post?.author?._id}`}
            className='text-sm font-semibold text-gray-900 truncate hover:opacity-70'
          >
            {post?.author?.username}
          </Link>
          <span className='text-gray-400'>&middot;</span>
          <span className='text-xs text-gray-400'>{timeAgo(post?.createdAt)}</span>
        </div>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogTrigger asChild>
          <button
            aria-label='Post options'
            className='cursor-pointer rounded-full p-1 hover:bg-gray-100 transition-colors text-gray-900'
          >
            <MoreHorizontal size={20} />
          </button>
        </DialogTrigger>
        <DialogContent className='max-w-xs p-0 gap-0 rounded-xl overflow-hidden'>
          <DialogTitle className='hidden'>Post options</DialogTitle>
          <DialogDescription className='hidden'>Options for this post.</DialogDescription>
          {isOwn && (
            <button
              onClick={() => {
                if (!deleting) onDelete()
              }}
              className={`${menuItem} text-red-500 font-semibold`}
              disabled={deleting}
            >
              {deleting ? (
                <span className='inline-flex items-center gap-2 justify-center'>
                  <Loader2 className='h-4 w-4 animate-spin' /> Deleting...
                </span>
              ) : (
                'Delete'
              )}
            </button>
          )}
          {isOwn && (
            <button
              onClick={() => {
                setMenuOpen(false)
                onEditCaption()
              }}
              className={menuItem}
            >
              Edit caption
            </button>
          )}
          {!isOwn && (
            <button
              onClick={() => {
                setMenuOpen(false)
                onToggleFollow()
              }}
              className={`${menuItem} ${isFollowing ? 'text-red-500 font-semibold' : 'text-blue-500 font-semibold'}`}
            >
              {isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
          <button
            onClick={() => {
              setMenuOpen(false)
              onCopyLink()
            }}
            className={menuItem}
          >
            Copy link
          </button>
          <button onClick={() => setMenuOpen(false)} className={menuItem}>
            Cancel
          </button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PostHeader
