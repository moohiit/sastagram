import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, Lock, ShieldOff, Trash2, KeyRound } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { resetApp } from '@/redux/store';

// /settings — password change, private-account toggle, blocked users,
// account deletion.
function Settings() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isPrivate, setIsPrivate] = useState(null); // null = loading
  const [blocked, setBlocked] = useState([]);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [changing, setChanging] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      axios.get('/api/v1/user/me', { withCredentials: true }),
      axios.get('/api/v1/user/blocked', { withCredentials: true }),
    ])
      .then(([me, blockedRes]) => {
        if (cancelled) return;
        setIsPrivate(Boolean(me.data.user?.isPrivate));
        setBlocked(blockedRes.data.blocked || []);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, []);

  const togglePrivacy = async () => {
    const next = !isPrivate;
    setIsPrivate(next);
    try {
      const response = await axios.patch(
        '/api/v1/user/privacy',
        { isPrivate: next },
        { withCredentials: true }
      );
      toast.success(response.data.message);
    } catch (error) {
      setIsPrivate(!next);
      toast.error(error.response?.data?.message || 'Could not update privacy');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwords.next.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    try {
      setChanging(true);
      const response = await axios.post(
        '/api/v1/user/password/change',
        { currentPassword: passwords.current, newPassword: passwords.next },
        { withCredentials: true }
      );
      toast.success(response.data.message);
      setPasswords({ current: '', next: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not change password');
    } finally {
      setChanging(false);
    }
  };

  const unblock = async (userId) => {
    try {
      await axios.post(`/api/v1/user/unblock/${userId}`, {}, { withCredentials: true });
      setBlocked((prev) => prev.filter((u) => u._id !== userId));
      toast.success('User unblocked');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not unblock');
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    try {
      setDeleting(true);
      await axios.delete('/api/v1/user/account', {
        data: { password: deletePassword },
        withCredentials: true,
      });
      dispatch(resetApp());
      toast.success('Account deleted');
      navigate('/login');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not delete account');
    } finally {
      setDeleting(false);
    }
  };

  const sectionClass = 'bg-black border border-zinc-800 rounded-lg p-4';

  return (
    <div className='w-full max-w-[470px] mx-auto px-4 py-6 flex flex-col gap-4'>
      <h1 className='text-xl font-bold text-gray-100'>Settings</h1>

      {/* Privacy */}
      <section className={sectionClass}>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <Lock size={18} className='text-zinc-400 mt-0.5 shrink-0' />
            <div>
              <p className='text-sm font-semibold text-gray-100'>Private account</p>
              <p className='text-xs text-zinc-400 mt-0.5'>
                Only approved followers can see your posts. Switching to public
                accepts all pending requests.
              </p>
            </div>
          </div>
          <button
            type='button'
            role='switch'
            aria-checked={Boolean(isPrivate)}
            disabled={isPrivate === null}
            onClick={togglePrivacy}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer ${
              isPrivate ? 'bg-blue-500' : 'bg-zinc-700'
            } disabled:opacity-50`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                isPrivate ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Password */}
      <section className={sectionClass}>
        <div className='flex items-center gap-2 mb-3'>
          <KeyRound size={18} className='text-zinc-400' />
          <p className='text-sm font-semibold text-gray-100'>Change password</p>
        </div>
        <form onSubmit={changePassword} className='flex flex-col gap-2'>
          <Input
            type='password'
            placeholder='Current password'
            value={passwords.current}
            onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
            autoComplete='current-password'
          />
          <Input
            type='password'
            placeholder='New password (min 8 characters)'
            value={passwords.next}
            onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
            autoComplete='new-password'
          />
          <Button
            type='submit'
            disabled={changing || !passwords.current || !passwords.next}
            className='bg-blue-500 hover:bg-blue-600 h-9 mt-1'
          >
            {changing ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Update password'}
          </Button>
        </form>
      </section>

      {/* Blocked users */}
      <section className={sectionClass}>
        <div className='flex items-center gap-2 mb-3'>
          <ShieldOff size={18} className='text-zinc-400' />
          <p className='text-sm font-semibold text-gray-100'>Blocked accounts</p>
        </div>
        {blocked.length === 0 ? (
          <p className='text-xs text-zinc-400'>You haven&apos;t blocked anyone.</p>
        ) : (
          <div className='flex flex-col gap-3'>
            {blocked.map((u) => (
              <div key={u._id} className='flex items-center gap-3'>
                <Link to={`/profile/${u._id}`}>
                  <Avatar className='h-8 w-8'>
                    <AvatarImage src={u.profilePicture} alt={u.username} />
                    <AvatarFallback>{u.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Link>
                <span className='text-sm text-gray-100 flex-1 truncate'>{u.username}</span>
                <Button
                  variant='secondary'
                  className='h-7 px-3 text-xs font-semibold'
                  onClick={() => unblock(u._id)}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className={`${sectionClass} border-red-900/60`}>
        <div className='flex items-center gap-2 mb-2'>
          <Trash2 size={18} className='text-red-500' />
          <p className='text-sm font-semibold text-red-500'>Delete account</p>
        </div>
        <p className='text-xs text-zinc-400 mb-3'>
          Permanently removes your profile, posts, comments, likes, messages and
          followers. This cannot be undone.
        </p>
        {!confirmingDelete ? (
          <Button
            variant='secondary'
            className='h-9 text-red-500 font-semibold'
            onClick={() => setConfirmingDelete(true)}
          >
            Delete my account
          </Button>
        ) : (
          <form onSubmit={deleteAccount} className='flex flex-col gap-2'>
            <Input
              type='password'
              placeholder='Confirm your password'
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete='current-password'
            />
            <div className='flex gap-2'>
              <Button
                type='submit'
                disabled={deleting || !deletePassword}
                className='bg-red-600 hover:bg-red-700 h-9 flex-1'
              >
                {deleting ? <Loader2 className='h-4 w-4 animate-spin' /> : 'Permanently delete'}
              </Button>
              <Button
                type='button'
                variant='secondary'
                className='h-9'
                onClick={() => {
                  setConfirmingDelete(false);
                  setDeletePassword('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default Settings;
