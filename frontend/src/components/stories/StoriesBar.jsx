import React, { useCallback, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useSelector } from 'react-redux'
import { Loader2, Plus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { cdn } from '@/lib/cdn'
import StoryViewer from './StoryViewer'

// Horizontal scrollable stories row at the top of the Home feed column.
// Guests see nothing (the /feed endpoint requires auth).
function StoriesBar() {
  const { user } = useSelector((store) => store.auth)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewerGroupIndex, setViewerGroupIndex] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const fetchFeed = async () => {
      try {
        const response = await axios.get('/api/v1/story/feed', { withCredentials: true })
        if (!cancelled && response.data.success) setGroups(response.data.groups)
      } catch (error) {
        console.error(error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchFeed()
    return () => { cancelled = true }
  }, [user])

  const uploadStory = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    const formData = new FormData()
    formData.append('image', file)
    try {
      setUploading(true)
      const response = await axios.post('/api/v1/story', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      })
      if (response.data.success) {
        const story = response.data.story
        setGroups((prev) => {
          const mine = prev.find((g) => g.user._id === user._id)
          const newStory = { _id: story._id, image: story.image, createdAt: story.createdAt, seen: false }
          if (mine) {
            return prev.map((g) =>
              g.user._id === user._id
                ? { ...g, allSeen: false, stories: [...g.stories, newStory] }
                : g
            )
          }
          const myGroup = {
            user: { _id: user._id, username: user.username, profilePicture: user.profilePicture },
            stories: [newStory],
            allSeen: false,
          }
          return [myGroup, ...prev]
        })
        toast.success(response.data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not add story')
    } finally {
      setUploading(false)
    }
  }

  // Mark a story seen in local state (the viewer already PATCHed the server)
  const markSeen = useCallback((groupIndex, storyId) => {
    setGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) return g
        const stories = g.stories.map((s) => (s._id === storyId ? { ...s, seen: true } : s))
        return { ...g, stories, allSeen: stories.every((s) => s.seen) }
      })
    )
  }, [])

  const removeStory = useCallback((groupIndex, storyId) => {
    setGroups((prev) =>
      prev
        .map((g, i) =>
          i === groupIndex ? { ...g, stories: g.stories.filter((s) => s._id !== storyId) } : g
        )
        .filter((g) => g.stories.length > 0)
    )
  }, [])

  if (!user) return null

  return (
    <>
      <div className='bg-white border border-gray-200 rounded-lg mb-4 px-3 py-3'>
        <div className='flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
          {/* Your story tile */}
          <button
            onClick={() => !uploading && inputRef.current?.click()}
            className='flex flex-col items-center gap-1 shrink-0 w-[66px] cursor-pointer'
            aria-label='Add to your story'
          >
            <div className='relative'>
              <div className='rounded-full p-[2px] bg-gray-200'>
                <div className='rounded-full p-[2px] bg-white'>
                  <Avatar className='h-14 w-14'>
                    <AvatarImage src={cdn(user.profilePicture, 150)} alt={user.username} />
                    <AvatarFallback>{(user.username || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className='absolute bottom-0 right-0 h-5 w-5 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white'>
                {uploading ? <Loader2 size={12} className='animate-spin' /> : <Plus size={12} strokeWidth={3} />}
              </span>
            </div>
            <span className='text-xs text-gray-900 truncate w-full text-center'>Your story</span>
          </button>
          <input ref={inputRef} onChange={uploadStory} type='file' accept='image/*' className='hidden' />

          {loading &&
            [1, 2, 3].map((i) => (
              <div key={i} className='flex flex-col items-center gap-1 shrink-0 w-[66px]'>
                <div className='h-[64px] w-[64px] rounded-full animate-pulse bg-gray-200' />
                <div className='h-3 w-12 animate-pulse bg-gray-200 rounded' />
              </div>
            ))}

          {groups.map((group, index) => (
            <button
              key={group.user._id}
              onClick={() => setViewerGroupIndex(index)}
              className='flex flex-col items-center gap-1 shrink-0 w-[66px] cursor-pointer'
              aria-label={`View ${group.user.username}'s story`}
            >
              <div
                className={`rounded-full p-[2px] ${
                  group.allSeen
                    ? 'bg-gray-200'
                    : 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500'
                }`}
              >
                <div className='rounded-full p-[2px] bg-white'>
                  <Avatar className='h-14 w-14'>
                    <AvatarImage src={cdn(group.user.profilePicture, 150)} alt={group.user.username} />
                    <AvatarFallback>
                      {(group.user.username || 'U').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className='text-xs text-gray-900 truncate w-full text-center'>
                {group.user._id === user._id ? 'Your story' : group.user.username}
              </span>
            </button>
          ))}
        </div>
      </div>

      {viewerGroupIndex !== null && groups[viewerGroupIndex] && (
        <StoryViewer
          groups={groups}
          initialGroupIndex={viewerGroupIndex}
          onClose={() => setViewerGroupIndex(null)}
          onSeen={markSeen}
          onDelete={removeStory}
        />
      )}
    </>
  )
}

export default StoriesBar
