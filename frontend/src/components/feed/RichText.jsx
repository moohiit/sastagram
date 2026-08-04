import React from 'react'
import { Link } from 'react-router-dom'

// Renders caption/comment text with #hashtags linking to the tag feed and
// @mentions linking to the username resolver route.
const TOKEN_RE = /(#[\p{L}\p{N}_]{1,50}|@[a-zA-Z0-9._-]{3,30})/u

function RichText({ text }) {
  if (!text) return null
  return (
    <>
      {text.split(new RegExp(TOKEN_RE.source, 'gu')).map((part, i) => {
        if (part?.startsWith('#')) {
          return (
            <Link
              key={i}
              to={`/tags/${part.slice(1).toLowerCase()}`}
              className='text-blue-400 hover:text-blue-300'
            >
              {part}
            </Link>
          )
        }
        if (part?.startsWith('@')) {
          return (
            <Link
              key={i}
              to={`/u/${part.slice(1)}`}
              className='text-blue-400 hover:text-blue-300'
            >
              {part}
            </Link>
          )
        }
        return <React.Fragment key={i}>{part}</React.Fragment>
      })}
    </>
  )
}

export default RichText
