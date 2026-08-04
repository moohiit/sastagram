import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

// Create a group chat: name + at least 2 people from your followings.
const NewGroupDialog = ({ open, onOpenChange, onCreated }) => {
  const { followings = [] } = useSelector((store) => store.auth);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]); // user ids
  const [creating, setCreating] = useState(false);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return followings;
    return followings.filter((f) => f?.username?.toLowerCase().includes(q));
  }, [followings, query]);

  const toggle = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const create = async () => {
    try {
      setCreating(true);
      const response = await axios.post(
        '/api/v1/message/group',
        { name: name.trim(), participantIds: selected },
        { withCredentials: true }
      );
      if (response.data.success) {
        toast.success('Group created');
        setName('');
        setSelected([]);
        setQuery('');
        onOpenChange(false);
        onCreated?.(response.data.group);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create group');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-sm p-4'>
        <DialogTitle>New group</DialogTitle>
        <DialogDescription className='hidden'>
          Create a group chat with people you follow.
        </DialogDescription>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder='Group name'
          maxLength={60}
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search people you follow'
          className='mt-1'
        />
        <div className='max-h-56 overflow-y-auto mt-1 flex flex-col gap-1'>
          {candidates.length === 0 ? (
            <p className='text-sm text-zinc-400 py-4 text-center'>No people found.</p>
          ) : (
            candidates.map((f) => (
              <label
                key={f._id}
                className='flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-900 cursor-pointer'
              >
                <input
                  type='checkbox'
                  checked={selected.includes(f._id)}
                  onChange={() => toggle(f._id)}
                  className='accent-blue-500'
                />
                <Avatar className='h-8 w-8'>
                  <AvatarImage src={f.profilePicture} />
                  <AvatarFallback>
                    {f.username?.slice(0, 2)?.toUpperCase() || 'US'}
                  </AvatarFallback>
                </Avatar>
                <span className='text-sm text-gray-100 truncate'>{f.username}</span>
              </label>
            ))
          )}
        </div>
        <Button
          onClick={create}
          disabled={creating || !name.trim() || selected.length < 2}
          className='bg-blue-500 hover:bg-blue-600 h-9 mt-2'
        >
          {creating ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            `Create group${selected.length ? ` (${selected.length})` : ''}`
          )}
        </Button>
        {selected.length < 2 && (
          <p className='text-xs text-zinc-500 text-center'>Pick at least 2 people</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewGroupDialog;
