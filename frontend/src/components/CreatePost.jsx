import React, { useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { readFileAsDataURL } from '@/lib/utils'
import { setPosts } from '@/redux/postSlice'

const MAX_CAPTION = 2200
const MAX_FILE_MB = 10

// Create-post dialog. Rendered by MainLayout via lifted { open, setOpen } state.
function CreatePost({ open, setOpen }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [caption, setCaption] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const { user } = useSelector((store) => store.auth)
  const { posts } = useSelector((store) => store.post)
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const acceptFile = async (picked) => {
    if (!picked) return
    if (!picked.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }
    if (picked.size > MAX_FILE_MB * 1024 * 1024) {
      toast.error(`Image must be smaller than ${MAX_FILE_MB}MB`)
      return
    }
    setFile(picked)
    const dataUrl = await readFileAsDataURL(picked)
    setImagePreview(dataUrl)
  }

  const fileHandler = (e) => {
    acceptFile(e.target.files?.[0])
    e.target.value = ''
  }

  const dropHandler = (e) => {
    e.preventDefault()
    setDragOver(false)
    acceptFile(e.dataTransfer.files?.[0])
  }

  const removeImage = () => {
    setFile(null)
    setImagePreview('')
  }

  const resetAndClose = () => {
    if (loading) return
    setFile(null)
    setImagePreview('')
    setCaption('')
    setDragOver(false)
    setOpen(false)
  }

  const createPostHandler = async () => {
    if (!file) {
      toast.error('Please select a photo first')
      return
    }
    const formData = new FormData()
    formData.append('caption', caption)
    formData.append('image', file)
    try {
      setLoading(true)
      const response = await axios.post('/api/v1/post/addpost', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      })
      if (response.data.success) {
        dispatch(setPosts([response.data.post, ...posts]))
        toast.success(response.data.message)
        setFile(null)
        setCaption('')
        setImagePreview('')
        setOpen(false)
        navigate('/')
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not create post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && resetAndClose()}>
      <DialogContent className='max-w-lg rounded-xl'>
        <DialogTitle className='text-base font-semibold text-gray-900 text-center'>
          Create new post
        </DialogTitle>
        <DialogDescription className='hidden'>Share a new photo.</DialogDescription>

        <div className='flex items-center gap-3'>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={user?.profilePicture} alt={user?.username} />
            <AvatarFallback>{(user?.username || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className='text-sm font-semibold text-gray-900'>{user?.username}</span>
        </div>

        {imagePreview ? (
          <div className='relative w-full'>
            <img
              src={imagePreview}
              alt='Preview'
              className='w-full max-h-[320px] object-cover rounded-lg border border-gray-200'
            />
            <button
              onClick={removeImage}
              disabled={loading}
              aria-label='Remove photo'
              className='absolute top-2 right-2 bg-gray-900/70 hover:bg-gray-900 text-white rounded-full p-1.5 cursor-pointer transition-colors'
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={dropHandler}
            className={`flex flex-col items-center justify-center gap-2 h-56 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-100'
            }`}
          >
            <ImagePlus size={40} className='text-gray-400' />
            <p className='text-sm text-gray-900'>Drag a photo here</p>
            <p className='text-xs text-gray-400'>or click to select from your device</p>
          </div>
        )}

        <input
          ref={inputRef}
          onChange={fileHandler}
          type='file'
          accept='image/*'
          className='hidden'
        />

        <div>
          <Textarea
            value={caption}
            maxLength={MAX_CAPTION}
            onChange={(e) => setCaption(e.target.value)}
            placeholder='Write a caption...'
            disabled={loading}
            className='min-h-[80px] text-sm border-gray-200 focus-visible:ring-transparent resize-none'
          />
          <div className='flex justify-end mt-1'>
            <span className='text-xs text-gray-400'>
              {caption.length}/{MAX_CAPTION}
            </span>
          </div>
        </div>

        <Button
          onClick={createPostHandler}
          disabled={loading || !file}
          className='w-full bg-blue-500 hover:bg-blue-600'
        >
          {loading ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Posting...
            </>
          ) : (
            'Share'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export default CreatePost
