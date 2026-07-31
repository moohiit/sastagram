import React, { useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch, useSelector } from 'react-redux'
import { Check, Link2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { upsertConversation } from '@/redux/chatSlice'
import useRequireLogin from '@/hooks/useRequireLogin'

const MAX_RECIPIENTS = 5

/**
 * "Share post to DM" picker. Candidates are mutual follows
 * (store.auth.followings — same source NewChatDialog uses). Multi-select up
 * to 5 people, optional message, plus a copy-link fallback row.
 */
function SharePostDialog({ open, onOpenChange, post, onCopyLink }) {
  const dispatch = useDispatch()
  const requireLogin = useRequireLogin()
  const { user, followings } = useSelector((store) => store.auth)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([]) // array of user objects
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return followings || []
    return (followings || []).filter((u) => u?.username?.toLowerCase().includes(q))
  }, [followings, query])

  const reset = () => {
    setQuery('')
    setSelected([])
    setMessage('')
  }

  const handleOpenChange = (next) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const toggleRecipient = (u) => {
    setSelected((prev) => {
      if (prev.some((s) => s._id === u._id)) return prev.filter((s) => s._id !== u._id)
      if (prev.length >= MAX_RECIPIENTS) {
        toast.info(`You can share with up to ${MAX_RECIPIENTS} people`)
        return prev
      }
      return [...prev, u]
    })
  }

  const sendHandler = async () => {
    if (!requireLogin()) return
    if (selected.length === 0 || sending) return
    setSending(true)
    const text = message.trim()
    try {
      const results = await Promise.all(
        selected.map((recipient) =>
          axios
            .post(
              `/api/v1/message/send/${recipient._id}`,
              { message: text, postId: post._id },
              { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
            )
            .then((response) => ({ recipient, response }))
        )
      )
      results.forEach(({ recipient, response }) => {
        if (!response.data.success) return
        const newMessage = response.data.newMessage
        dispatch(
          upsertConversation({
            userId: recipient._id,
            lastMessage: newMessage.message || 'Shared a post',
            lastMessageAt: newMessage.createdAt || new Date().toISOString(),
            lastSenderId: user?._id,
            unreadDelta: 0,
            user: {
              _id: recipient._id,
              username: recipient.username,
              profilePicture: recipient.profilePicture,
            },
          })
        )
      })
      const n = selected.length
      toast.success(`Shared to ${n} ${n === 1 ? 'person' : 'people'}`)
      handleOpenChange(false)
    } catch (error) {
      console.error(error)
      toast.error(error.response?.data?.message || 'Could not share post')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined} className='max-w-sm p-0 gap-0'>
        <DialogTitle className='text-base font-semibold text-gray-900 text-center py-3 border-b border-gray-200'>
          Share
        </DialogTitle>
        <div className='p-3 border-b border-gray-200'>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search…'
            className='h-9 focus-visible:ring-transparent'
          />
        </div>
        <div className='overflow-y-auto max-h-[280px] py-1'>
          {filtered.length === 0 ? (
            <p className='text-sm text-gray-500 text-center py-6'>No people found.</p>
          ) : (
            filtered.map((u) => {
              const isSelected = selected.some((s) => s._id === u._id)
              return (
                <div
                  key={u?._id}
                  onClick={() => toggleRecipient(u)}
                  className='flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors'
                >
                  <Avatar className='h-11 w-11'>
                    <AvatarImage src={u?.profilePicture} />
                    <AvatarFallback>
                      {u?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <span className='flex-1 min-w-0 text-sm font-semibold text-gray-900 truncate'>
                    {u?.username}
                  </span>
                  <span
                    className={`flex items-center justify-center h-6 w-6 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-200 text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                </div>
              )
            })
          )}
        </div>
        {selected.length > 0 && (
          <div className='px-3 pb-2'>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Write a message…'
              className='h-9 focus-visible:ring-transparent'
            />
          </div>
        )}
        <div className='p-3 border-t border-gray-200'>
          <Button
            onClick={sendHandler}
            disabled={selected.length === 0 || sending}
            className='w-full bg-blue-500 hover:bg-blue-600 h-8'
          >
            {sending ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Send'}
          </Button>
        </div>
        <div
          onClick={() => {
            onCopyLink?.()
            handleOpenChange(false)
          }}
          className='flex items-center gap-3 px-4 py-3 border-t border-gray-200 cursor-pointer rounded-b-lg hover:bg-gray-100 transition-colors'
        >
          <Link2 size={20} className='text-gray-900' />
          <span className='text-sm text-gray-900'>Copy link</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SharePostDialog
