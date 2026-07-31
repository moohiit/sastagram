import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch } from 'react-redux'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { Loader2 } from 'lucide-react'
import { updatePostById } from '@/redux/postSlice'

const MAX_CAPTION = 2200

// Small dialog to edit the caption of your own post (PUT /post/:id/caption).
function EditCaptionDialog({ open, setOpen, post }) {
  const [caption, setCaption] = useState(post?.caption || '')
  const [saving, setSaving] = useState(false)
  const dispatch = useDispatch()

  useEffect(() => {
    if (open) setCaption(post?.caption || '')
  }, [open, post])

  const saveHandler = async () => {
    try {
      setSaving(true)
      const response = await axios.put(
        `/api/v1/post/${post._id}/caption`,
        { caption },
        { withCredentials: true }
      )
      if (response.data.success) {
        dispatch(updatePostById({ _id: post._id, changes: { caption } }))
        toast.success(response.data.message || 'Caption updated')
        setOpen(false)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Failed to update caption')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className='max-w-md rounded-xl'>
        <DialogTitle className='text-base font-semibold text-gray-900'>Edit caption</DialogTitle>
        <DialogDescription className='hidden'>Edit the caption of your post.</DialogDescription>
        <Textarea
          value={caption}
          maxLength={MAX_CAPTION}
          onChange={(e) => setCaption(e.target.value)}
          placeholder='Write a caption...'
          className='min-h-[100px] text-sm focus-visible:ring-transparent'
        />
        <div className='flex items-center justify-between'>
          <span className='text-xs text-gray-400'>
            {caption.length}/{MAX_CAPTION}
          </span>
          <div className='flex gap-2'>
            <Button variant='secondary' className='h-8' onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              className='bg-blue-500 hover:bg-blue-600 h-8'
              onClick={saveHandler}
              disabled={saving || caption === (post?.caption || '')}
            >
              {saving ? (
                <>
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' /> Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default EditCaptionDialog
