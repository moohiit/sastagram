import React, { useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { BarChart2, ImagePlus, Loader2, Plus, Sparkles, X } from 'lucide-react'
import useAiEnabled from '@/hooks/useAiEnabled'
import { readFileAsDataURL } from '@/lib/utils'
import { setPosts } from '@/redux/postSlice'

const MAX_CAPTION = 2200
const MAX_FILE_MB = 10
const MAX_POLL_QUESTION = 150
const MAX_POLL_OPTION = 80
const MIN_POLL_OPTIONS = 2
const MAX_POLL_OPTIONS = 4

// Create-post dialog. Rendered by MainLayout via lifted { open, setOpen } state.
function CreatePost({ open, setOpen }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [caption, setCaption] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [pollOpen, setPollOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const aiEnabled = useAiEnabled()
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
    setSuggestions([])
  }

  const suggestCaptions = async () => {
    if (!file || suggesting) return
    const formData = new FormData()
    formData.append('image', file)
    try {
      setSuggesting(true)
      const response = await axios.post('/api/v1/ai/captions', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      })
      if (response.data.success) setSuggestions(response.data.captions)
    } catch (error) {
      toast.error(error.response?.data?.message || 'Caption suggestions unavailable')
    } finally {
      setSuggesting(false)
    }
  }

  const resetPoll = () => {
    setPollOpen(false)
    setPollQuestion('')
    setPollOptions(['', ''])
  }

  const togglePoll = () => {
    if (pollOpen) resetPoll()
    else setPollOpen(true)
  }

  const setPollOption = (index, value) => {
    setPollOptions((opts) => opts.map((o, i) => (i === index ? value : o)))
  }

  const addPollOption = () => {
    setPollOptions((opts) => (opts.length < MAX_POLL_OPTIONS ? [...opts, ''] : opts))
  }

  const removePollOption = (index) => {
    setPollOptions((opts) =>
      opts.length > MIN_POLL_OPTIONS ? opts.filter((_, i) => i !== index) : opts
    )
  }

  const resetAndClose = () => {
    if (loading) return
    setFile(null)
    setImagePreview('')
    setCaption('')
    setDragOver(false)
    resetPoll()
    setOpen(false)
  }

  const createPostHandler = async () => {
    if (!file) {
      toast.error('Please select a photo first')
      return
    }
    // Client-side poll validation, mirroring the server rules
    let trimmedPollOptions = null
    if (pollOpen) {
      const question = pollQuestion.trim()
      if (!question || question.length > MAX_POLL_QUESTION) {
        toast.error(`Poll question is required (max ${MAX_POLL_QUESTION} characters)`)
        return
      }
      trimmedPollOptions = pollOptions.map((o) => o.trim())
      if (trimmedPollOptions.some((o) => !o || o.length > MAX_POLL_OPTION)) {
        toast.error(`Each poll option must be non-empty (max ${MAX_POLL_OPTION} characters)`)
        return
      }
    }
    const formData = new FormData()
    formData.append('caption', caption)
    formData.append('image', file)
    if (pollOpen && trimmedPollOptions) {
      formData.append('pollQuestion', pollQuestion.trim())
      formData.append('pollOptions', JSON.stringify(trimmedPollOptions))
    }
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
        resetPoll()
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
        <DialogTitle className='text-base font-semibold text-gray-100 text-center'>
          Create new post
        </DialogTitle>
        <DialogDescription className='hidden'>Share a new photo.</DialogDescription>

        <div className='flex items-center gap-3'>
          <Avatar className='h-8 w-8'>
            <AvatarImage src={user?.profilePicture} alt={user?.username} />
            <AvatarFallback>{(user?.username || 'U').slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className='text-sm font-semibold text-gray-100'>{user?.username}</span>
        </div>

        {imagePreview ? (
          <div className='relative w-full'>
            <img
              src={imagePreview}
              alt='Preview'
              className='w-full max-h-[320px] object-cover rounded-lg border border-zinc-800'
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
              dragOver ? 'border-blue-500 bg-blue-500/10' : 'border-zinc-800 hover:bg-zinc-900'
            }`}
          >
            <ImagePlus size={40} className='text-zinc-500' />
            <p className='text-sm text-gray-100'>Drag a photo here</p>
            <p className='text-xs text-zinc-500'>or click to select from your device</p>
          </div>
        )}

        <input
          ref={inputRef}
          onChange={fileHandler}
          type='file'
          accept='image/*'
          className='hidden'
        />

        {aiEnabled && imagePreview && (
          <div className='flex flex-col gap-2'>
            <button
              onClick={suggestCaptions}
              disabled={suggesting || loading}
              className='self-start inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-600 disabled:opacity-50'
            >
              {suggesting ? <Loader2 size={14} className='animate-spin' /> : <Sparkles size={14} />}
              {suggesting ? 'Thinking…' : 'Suggest captions'}
            </button>
            {suggestions.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setCaption(s.slice(0, MAX_CAPTION))}
                    className='text-xs border border-zinc-800 rounded-full px-3 py-1.5 text-gray-100 hover:border-blue-500 hover:text-blue-600 text-left'
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <Textarea
            value={caption}
            maxLength={MAX_CAPTION}
            onChange={(e) => setCaption(e.target.value)}
            placeholder='Write a caption...'
            disabled={loading}
            className='min-h-[80px] text-sm border-zinc-800 focus-visible:ring-transparent resize-none'
          />
          <div className='flex justify-end mt-1'>
            <span className='text-xs text-zinc-500'>
              {caption.length}/{MAX_CAPTION}
            </span>
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          <button
            onClick={togglePoll}
            disabled={loading}
            aria-label={pollOpen ? 'Remove poll' : 'Add poll'}
            className={`self-start inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer disabled:opacity-50 ${
              pollOpen ? 'text-red-500 hover:text-red-600' : 'text-blue-400 hover:text-blue-600'
            }`}
          >
            <BarChart2 size={14} />
            {pollOpen ? 'Remove poll' : 'Add poll'}
          </button>

          {pollOpen && (
            <div className='flex flex-col gap-2 border border-zinc-800 rounded-lg p-3'>
              <Input
                value={pollQuestion}
                maxLength={MAX_POLL_QUESTION}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder='Ask a question...'
                disabled={loading}
                className='h-9 text-sm border-zinc-800 focus-visible:ring-transparent'
              />
              {pollOptions.map((option, index) => (
                <div key={index} className='flex items-center gap-2'>
                  <Input
                    value={option}
                    maxLength={MAX_POLL_OPTION}
                    onChange={(e) => setPollOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    disabled={loading}
                    className='h-9 text-sm border-zinc-800 focus-visible:ring-transparent'
                  />
                  {pollOptions.length > MIN_POLL_OPTIONS && (
                    <button
                      onClick={() => removePollOption(index)}
                      disabled={loading}
                      aria-label={`Remove option ${index + 1}`}
                      className='text-zinc-500 hover:text-red-500 cursor-pointer disabled:opacity-50'
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < MAX_POLL_OPTIONS && (
                <button
                  onClick={addPollOption}
                  disabled={loading}
                  className='self-start inline-flex items-center gap-1 text-sm font-semibold text-blue-400 hover:text-blue-600 cursor-pointer disabled:opacity-50'
                >
                  <Plus size={14} /> Add option
                </button>
              )}
            </div>
          )}
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
