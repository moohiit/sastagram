import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

/**
 * "New chat" picker. Only mutual follows can be messaged, so the candidate
 * list comes from store.auth.followings (populated by useGetFollowings in the
 * shell).
 */
const NewChatDialog = ({ open, onOpenChange, onSelect }) => {
  const { followings } = useSelector((store) => store.auth);
  const { onlineUsers } = useSelector((store) => store.chat);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return followings || [];
    return (followings || []).filter((u) => u?.username?.toLowerCase().includes(q));
  }, [followings, query]);

  const handleOpenChange = (next) => {
    if (!next) setQuery('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-sm p-0 gap-0'>
        <DialogTitle className='text-base font-semibold text-gray-900 text-center py-3 border-b border-gray-200'>
          New message
        </DialogTitle>
        <div className='p-3 border-b border-gray-200'>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search…'
            className='h-9 focus-visible:ring-transparent'
          />
        </div>
        <div className='overflow-y-auto max-h-[320px] py-1'>
          {filtered.length === 0 ? (
            <p className='text-sm text-gray-500 text-center py-6'>No people found.</p>
          ) : (
            filtered.map((u) => {
              const isOnline = onlineUsers?.includes(u?._id);
              return (
                <div
                  key={u?._id}
                  onClick={() => {
                    setQuery('');
                    onSelect(u);
                  }}
                  className='flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-gray-100 transition-colors'
                >
                  <div className='relative'>
                    <Avatar className='h-11 w-11'>
                      <AvatarImage src={u?.profilePicture} />
                      <AvatarFallback>
                        {u?.username?.slice(0, 2)?.toUpperCase() || 'US'}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span className='absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white' />
                    )}
                  </div>
                  <div className='flex flex-col'>
                    <span className='text-sm font-semibold text-gray-900'>{u?.username}</span>
                    <span className='text-xs text-gray-500'>{isOnline ? 'Active now' : 'Offline'}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;
