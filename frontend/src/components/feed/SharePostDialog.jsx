import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import { useDispatch, useSelector } from 'react-redux'
import { Check, Link2, Loader2, Users } from 'lucide-react'
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
  const [selectedGroups, setSelectedGroups] = useState([]) // array of group objects
  const [groups, setGroups] = useState([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Groups are share targets too
  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    axios
      .get('/api/v1/message/group', { withCredentials: true })
      .then((response) => {
        if (!cancelled && response.data.success) setGroups(response.data.groups || [])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, user])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return followings || []
    return (followings || []).filter((u) => u?.username?.toLowerCase().includes(q))
  }, [followings, query])

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => g?.name?.toLowerCase().includes(q))
  }, [groups, query])

  const reset = () => {
    setQuery('')
    setSelected([])
    setSelectedGroups([])
    setMessage('')
  }

  const handleOpenChange = (next) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const toggleRecipient = (u) => {
    setSelected((prev) => {
      if (prev.some((s) => s._id === u._id)) return prev.filter((s) => s._id !== u._id)
      if (prev.length + selectedGroups.length >= MAX_RECIPIENTS) {
        toast.info(`You can share with up to ${MAX_RECIPIENTS} chats`)
        return prev
      }
      return [...prev, u]
    })
  }

  const toggleGroup = (g) => {
    setSelectedGroups((prev) => {
      if (prev.some((s) => s._id === g._id)) return prev.filter((s) => s._id !== g._id)
      if (prev.length + selected.length >= MAX_RECIPIENTS) {
        toast.info(`You can share with up to ${MAX_RECIPIENTS} chats`)
        return prev
      }
      return [...prev, g]
    })
  }

  const totalSelected = selected.length + selectedGroups.length

  const sendHandler = async () => {
    if (!requireLogin()) return
    if (totalSelected === 0 || sending) return
    setSending(true)
    const text = message.trim()
    try {
      const [results] = await Promise.all([
        Promise.all(
          selected.map((recipient) =>
            axios
              .post(
                `/api/v1/message/send/${recipient._id}`,
                { message: text, postId: post._id },
                { headers: { 'Content-Type': 'application/json' }, withCredentials: true }
              )
              .then((response) => ({ recipient, response }))
          )
        ),
        Promise.all(
          selectedGroups.map((group) =>
            axios.post(
              `/api/v1/message/group/${group._id}/send`,
              { message: text, postId: post._id },
              { withCredentials: true }
            )
          )
        ),
      ])
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
      toast.success(`Shared to ${totalSelected} ${totalSelected === 1 ? 'chat' : 'chats'}`)
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
        <DialogTitle className='text-base font-semibold text-gray-100 text-center py-3 border-b border-zinc-800'>
          Share
        </DialogTitle>
        <div className='p-3 border-b border-zinc-800'>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search…'
            className='h-9 focus-visible:ring-transparent'
          />
        </div>
        <div className='overflow-y-auto max-h-[280px] py-1'>
          {filteredGroups.map((g) => {
            const isSelected = selectedGroups.some((s) => s._id === g._id)
            return (
              <div
                key={g._id}
                onClick={() => toggleGroup(g)}
                className='flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-zinc-900 transition-colors'
              >
                <div className='flex h-11 w-11 items-center justify-center rounded-full bg-zinc-800 shrink-0'>
                  <Users size={18} className='text-zinc-300' />
                </div>
                <span className='flex-1 min-w-0 text-sm font-semibold text-gray-100 truncate'>
                  {g.name}
                </span>
                <span
                  className={`flex items-center justify-center h-6 w-6 rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-zinc-800 text-transparent'
                  }`}
                >
                  <Check size={14} strokeWidth={3} />
                </span>
              </div>
            )
          })}
          {filtered.length === 0 && filteredGroups.length === 0 ? (
            <p className='text-sm text-zinc-400 text-center py-6'>No people found.</p>
          ) : (
            filtered.map((u) => {
              const isSelected = selected.some((s) => s._id === u._id)
              return (
                <div
                  key={u?._id}
                  onClick={() => toggleRecipient(u)}
                  className='flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-zinc-900 transition-colors'
                >
                  <Avatar className='h-11 w-11'>
                    <AvatarImage src={u?.profilePicture} />
                    <AvatarFallback>
                      {u?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                    </AvatarFallback>
                  </Avatar>
                  <span className='flex-1 min-w-0 text-sm font-semibold text-gray-100 truncate'>
                    {u?.username}
                  </span>
                  <span
                    className={`flex items-center justify-center h-6 w-6 rounded-full border transition-colors ${
                      isSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-zinc-800 text-transparent'
                    }`}
                  >
                    <Check size={14} strokeWidth={3} />
                  </span>
                </div>
              )
            })
          )}
        </div>
        {totalSelected > 0 && (
          <div className='px-3 pb-2'>
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='Write a message…'
              className='h-9 focus-visible:ring-transparent'
            />
          </div>
        )}
        <div className='p-3 border-t border-zinc-800'>
          <Button
            onClick={sendHandler}
            disabled={totalSelected === 0 || sending}
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
          className='flex items-center gap-3 px-4 py-3 border-t border-zinc-800 cursor-pointer rounded-b-lg hover:bg-zinc-900 transition-colors'
        >
          <Link2 size={20} className='text-gray-100' />
          <span className='text-sm text-gray-100'>Copy link</span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SharePostDialog
