import React, { useLayoutEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Loader2, SmilePlus, Trash2 } from 'lucide-react';
import { setMessageReactions, markMessageUnsent } from '@/redux/chatSlice';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { cdn } from '@/lib/cdn';
import { timeAgo } from '@/lib/utils';
import useGetAllMessage from '@/hooks/useGetAllMessage';
import CommentDialog from './CommentDialog';

// Compact shared-post card rendered inside a message bubble.
const SharedPostCard = ({ post, onOpen }) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      onOpen(post);
    }}
    className='w-56 max-w-full bg-black border border-zinc-800 rounded-lg overflow-hidden cursor-pointer'
  >
    <div className='flex items-center gap-2 px-2.5 py-2'>
      <Avatar className='h-6 w-6'>
        <AvatarImage src={post?.author?.profilePicture} />
        <AvatarFallback>
          {post?.author?.username?.slice(0, 2)?.toUpperCase() || 'US'}
        </AvatarFallback>
      </Avatar>
      <span className='text-xs font-semibold text-gray-100 truncate'>
        {post?.author?.username}
      </span>
    </div>
    <img
      src={cdn(post?.image, 300)}
      alt={post?.caption ? post.caption.slice(0, 60) : 'Shared post'}
      loading='lazy'
      className='w-full aspect-square object-cover'
    />
    {post?.caption && (
      <p className='px-2.5 py-1.5 text-xs text-zinc-400 truncate'>{post.caption}</p>
    )}
  </div>
);

const LOAD_OLDER_THRESHOLD_PX = 60;

// Mirrors the backend's allowed reaction set
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

const dayKey = (dateString) => new Date(dateString).toDateString();

const formatDayLabel = (dateString) => {
  const d = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
  });
};

/**
 * Scrollable message history for the open thread: grouped bubbles, date
 * separators, tap-for-timestamp, "Seen" receipt, and cursor-based
 * load-older-on-scroll-top with scroll position preservation.
 */
const Messages = ({ selectedUser }) => {
  const { loading, loadingOlder, loadOlder, hasMore } = useGetAllMessage();
  const { messages, seen } = useSelector((store) => store.chat);
  const { user } = useSelector((store) => store.auth);
  const dispatch = useDispatch();
  const [expandedId, setExpandedId] = useState(null);
  const [pickerId, setPickerId] = useState(null); // message with the emoji picker open

  const reactHandler = async (msg, emoji) => {
    setPickerId(null);
    try {
      const response = await axios.post(
        `/api/v1/message/${msg._id}/react`,
        { emoji },
        { withCredentials: true }
      );
      if (response.data.success) {
        dispatch(setMessageReactions({ messageId: msg._id, reactions: response.data.reactions }));
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not react');
    }
  };

  const unsendHandler = async (msg) => {
    try {
      const response = await axios.delete(`/api/v1/message/${msg._id}`, {
        withCredentials: true,
      });
      if (response.data.success) dispatch(markMessageUnsent(msg._id));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not unsend');
    }
  };
  // Shared-post card clicked → open it in CommentDialog (local-state mode,
  // same pattern Explore uses for posts outside the feed slice).
  const [sharedPost, setSharedPost] = useState(null);
  const [sharedPostOpen, setSharedPostOpen] = useState(false);

  const openSharedPost = (post) => {
    setSharedPost(post);
    setSharedPostOpen(true);
  };

  const containerRef = useRef(null);
  const restoreRef = useRef(null); // scroll metrics captured before a prepend
  const lastMsgIdRef = useRef(null);

  // Keep the viewport anchored: restore position after prepending older
  // messages, otherwise snap to the bottom when a new message arrives.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const lastId = messages.length ? messages[messages.length - 1]._id : null;
    if (restoreRef.current) {
      el.scrollTop = el.scrollHeight - restoreRef.current.prevScrollHeight + restoreRef.current.prevScrollTop;
      restoreRef.current = null;
    } else if (lastId !== lastMsgIdRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    lastMsgIdRef.current = lastId;
  }, [messages]);

  const handleScroll = async () => {
    const el = containerRef.current;
    if (!el || el.scrollTop > LOAD_OLDER_THRESHOLD_PX) return;
    if (!hasMore || loading || loadingOlder) return;
    restoreRef.current = { prevScrollHeight: el.scrollHeight, prevScrollTop: el.scrollTop };
    const added = await loadOlder();
    if (!added) restoreRef.current = null;
  };

  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  const showSeen =
    lastMessage && lastMessage.senderId === user?._id && !!seen[selectedUser?._id];

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className='flex-1 min-h-0 overflow-y-auto px-4 py-3'
    >
      {loading ? (
        <div className='flex flex-col gap-2 pt-4'>
          {[64, 40, 56, 32, 48].map((w, i) => (
            <div
              key={i}
              className={`h-9 animate-pulse bg-zinc-800 rounded-2xl ${i % 2 ? 'self-end' : 'self-start'}`}
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      ) : (
        <>
          {loadingOlder && (
            <div className='flex justify-center py-2'>
              <Loader2 className='h-5 w-5 animate-spin text-zinc-500' />
            </div>
          )}

          {!hasMore && (
            <div className='flex flex-col items-center py-6'>
              <Avatar className='h-[77px] w-[77px]'>
                <AvatarImage src={selectedUser?.profilePicture} />
                <AvatarFallback>
                  {selectedUser?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                </AvatarFallback>
              </Avatar>
              <span className='text-base font-semibold text-gray-100 mt-2'>
                {selectedUser?.username}
              </span>
              <span className='text-xs text-zinc-400'>SastaGram</span>
              <Link to={`/profile/${selectedUser?._id}`}>
                <Button variant='secondary' className='h-8 mt-3'>View profile</Button>
              </Link>
              {messages.length === 0 && (
                <p className='text-sm text-zinc-400 mt-4'>No messages yet — say hi 👋</p>
              )}
            </div>
          )}

          {messages.map((msg, i) => {
            const prev = messages[i - 1];
            const next = messages[i + 1];
            const mine = msg.senderId === user?._id;
            const newDay = !prev || dayKey(msg.createdAt) !== dayKey(prev.createdAt);
            const isFirstOfGroup = newDay || prev.senderId !== msg.senderId;
            const isLastOfGroup =
              !next ||
              next.senderId !== msg.senderId ||
              dayKey(next.createdAt) !== dayKey(msg.createdAt);
            const expanded = expandedId === msg._id;
            // Reactions grouped by emoji for the pill row under the bubble
            const reactionGroups = (msg.reactions || []).reduce((acc, r) => {
              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              return acc;
            }, {});
            const myReaction = (msg.reactions || []).find((r) => r.user === user?._id)?.emoji;

            const bubbleShape = mine
              ? `rounded-2xl ${isFirstOfGroup ? '' : 'rounded-tr-md'} ${isLastOfGroup ? '' : 'rounded-br-md'}`
              : `rounded-2xl ${isFirstOfGroup ? '' : 'rounded-tl-md'} ${isLastOfGroup ? '' : 'rounded-bl-md'}`;

            return (
              <React.Fragment key={msg._id}>
                {newDay && (
                  <div className='flex justify-center my-4'>
                    <span className='text-xs text-zinc-500'>{formatDayLabel(msg.createdAt)}</span>
                  </div>
                )}
                <div
                  className={`group/msg flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${isFirstOfGroup && !newDay ? 'mt-3' : 'mt-0.5'}`}
                >
                  {!mine && (
                    isLastOfGroup ? (
                      <Avatar className='h-7 w-7 shrink-0'>
                        <AvatarImage src={selectedUser?.profilePicture} />
                        <AvatarFallback>
                          {selectedUser?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className='w-7 shrink-0' />
                    )
                  )}
                  {/* Hover actions (react / unsend) — placed on the inner side */}
                  {mine && !msg.deleted && (
                    <span className='hidden group-hover/msg:flex items-center gap-1 self-center'>
                      <button
                        onClick={() => unsendHandler(msg)}
                        title='Unsend'
                        className='p-1 text-zinc-500 hover:text-red-500 cursor-pointer'
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={() => setPickerId(pickerId === msg._id ? null : msg._id)}
                        title='React'
                        className='p-1 text-zinc-500 hover:text-gray-100 cursor-pointer'
                      >
                        <SmilePlus size={14} />
                      </button>
                    </span>
                  )}
                  <div className='relative max-w-[75%]'>
                    {pickerId === msg._id && (
                      <div className={`absolute -top-9 ${mine ? 'right-0' : 'left-0'} z-10 flex gap-1 rounded-full bg-zinc-900 border border-zinc-700 px-2 py-1 shadow-lg`}>
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => reactHandler(msg, emoji)}
                            className={`text-base leading-none cursor-pointer hover:scale-125 transition-transform ${myReaction === emoji ? 'opacity-100' : 'opacity-80'}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <div
                      onClick={() => setExpandedId(expanded ? null : msg._id)}
                      title={msg.createdAt ? new Date(msg.createdAt).toLocaleString() : undefined}
                      className={`${msg.post ? 'p-1.5' : 'px-3.5 py-2'} text-sm break-words cursor-pointer ${bubbleShape} ${
                        msg.deleted
                          ? 'bg-transparent border border-zinc-800 text-zinc-500 italic'
                          : mine
                            ? 'bg-blue-500 text-white'
                            : 'bg-zinc-900 text-gray-100'
                      }`}
                    >
                      {msg.deleted ? (
                        <span>Message unsent</span>
                      ) : (
                        <>
                          {msg.post && <SharedPostCard post={msg.post} onOpen={openSharedPost} />}
                          {msg.message && (
                            <div className={msg.post ? 'px-2 pt-1.5 pb-0.5' : ''}>{msg.message}</div>
                          )}
                        </>
                      )}
                    </div>
                    {Object.keys(reactionGroups).length > 0 && (
                      <div className={`absolute -bottom-3 ${mine ? 'right-1' : 'left-1'} flex gap-0.5`}>
                        <span className='flex items-center gap-0.5 rounded-full bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[11px] leading-none'>
                          {Object.entries(reactionGroups).map(([emoji, count]) => (
                            <span key={emoji}>
                              {emoji}
                              {count > 1 ? count : ''}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </div>
                  {!mine && !msg.deleted && (
                    <span className='hidden group-hover/msg:flex items-center self-center'>
                      <button
                        onClick={() => setPickerId(pickerId === msg._id ? null : msg._id)}
                        title='React'
                        className='p-1 text-zinc-500 hover:text-gray-100 cursor-pointer'
                      >
                        <SmilePlus size={14} />
                      </button>
                    </span>
                  )}
                </div>
                {Object.keys(reactionGroups).length > 0 && <div className='h-2.5' />}
                {expanded && (
                  <div className={`text-[11px] text-zinc-500 mt-0.5 ${mine ? 'text-right pr-1' : 'text-left pl-10'}`}>
                    {timeAgo(msg.createdAt)}
                  </div>
                )}
              </React.Fragment>
            );
          })}

          {showSeen && (
            <div className='text-xs text-zinc-500 text-right mt-1 pr-1'>Seen</div>
          )}

          {sharedPost && (
            <CommentDialog open={sharedPostOpen} setOpen={setSharedPostOpen} post={sharedPost} />
          )}
        </>
      )}
    </div>
  );
};

export default Messages;
