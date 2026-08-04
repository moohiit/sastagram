import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

// /u/:username — resolves a username (e.g. from an @mention link) to the
// id-based profile route.
function UsernameRedirect() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    axios
      .get(`/api/v1/user/search/${encodeURIComponent(username)}`, {
        withCredentials: true,
      })
      .then((response) => {
        if (cancelled) return
        if (response.data.success && response.data.user?._id) {
          navigate(`/profile/${response.data.user._id}`, { replace: true })
        } else {
          setMissing(true)
        }
      })
      .catch(() => !cancelled && setMissing(true))
    return () => {
      cancelled = true
    }
  }, [username, navigate])

  if (missing) {
    return (
      <div className='flex flex-col items-center justify-center min-h-[60vh] gap-3'>
        <p className='text-gray-100 font-semibold'>@{username} doesn&apos;t exist.</p>
        <Link to='/' className='text-sm font-semibold text-blue-400 hover:text-blue-300'>
          Back to home
        </Link>
      </div>
    )
  }
  return (
    <div className='flex justify-center items-center min-h-[60vh]'>
      <Loader2 className='h-8 w-8 animate-spin text-zinc-500' />
    </div>
  )
}

export default UsernameRedirect
