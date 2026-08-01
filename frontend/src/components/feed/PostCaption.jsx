import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

// Caption with bold username, 2-line clamp and a "more" expander when clamped.
function PostCaption({ post }) {
  const [expanded, setExpanded] = useState(false)
  const [clamped, setClamped] = useState(false)
  const textRef = useRef(null)

  useEffect(() => {
    setExpanded(false)
  }, [post?.caption])

  useEffect(() => {
    const el = textRef.current
    if (!el || expanded) return
    // When line-clamped, scrollHeight exceeds clientHeight if text overflows.
    setClamped(el.scrollHeight > el.clientHeight + 1)
  }, [post?.caption, expanded])

  if (!post?.caption) return null

  return (
    <div className='px-3 pt-1 text-sm text-gray-100'>
      <p
        ref={textRef}
        className={expanded ? '' : 'line-clamp-2'}
        style={expanded ? undefined : { wordBreak: 'break-word' }}
      >
        <Link
          to={`/profile/${post?.author?._id}`}
          className='font-semibold mr-1.5 hover:opacity-70'
        >
          {post?.author?.username}
        </Link>
        {post.caption}
      </p>
      {!expanded && clamped && (
        <button
          onClick={() => setExpanded(true)}
          className='text-zinc-400 cursor-pointer hover:text-gray-100'
        >
          more
        </button>
      )}
    </div>
  )
}

export default PostCaption
