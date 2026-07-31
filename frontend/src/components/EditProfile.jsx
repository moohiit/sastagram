import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { setAuthUser } from '@/redux/authSlice';
import { cdn } from '@/lib/cdn';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const EditProfile = () => {
  const { user } = useSelector(store => store.auth);
  const fileRef = useRef();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null); // object URL for a newly chosen photo
  const [input, setInput] = useState({
    profilePicture: null, // File — only appended when the user picks a new photo
    bio: user?.bio || '',
    gender: user?.gender || '',
  });

  // Revoke the preview object URL when it changes / on unmount
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const fileChangeHandler = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setInput(prev => ({ ...prev, profilePicture: file }));
    setPreview(URL.createObjectURL(file));
  };

  const editProfileHandler = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('bio', input.bio);
      formData.append('gender', input.gender);
      if (input.profilePicture) {
        formData.append('profilePicture', input.profilePicture);
      }
      const response = await axios.post('/api/v1/user/profile/edit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
      });
      if (response.data.success) {
        dispatch(
          setAuthUser({
            ...user,
            bio: response.data.user.bio,
            gender: response.data.user.gender,
            profilePicture: response.data.user.profilePicture,
          })
        );
        toast.success(response.data.message);
        navigate(`/profile/${user?._id}`);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Could not update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mx-auto w-full max-w-[470px] px-4 py-6'>
      <h1 className='mb-4 text-xl font-bold text-gray-900'>Edit profile</h1>
      <section className='flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-4'>
        {/* Avatar + change photo */}
        <div className='flex items-center justify-between gap-3 rounded-lg bg-gray-100 p-4'>
          <div className='flex min-w-0 items-center gap-4'>
            <Link to={`/profile/${user?._id}`}>
              <Avatar className='h-11 w-11'>
                <AvatarImage
                  src={preview || cdn(user?.profilePicture, 100)}
                  alt={user?.username}
                />
                <AvatarFallback>{user?.username?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
            </Link>
            <div className='min-w-0'>
              <p className='truncate text-sm font-semibold text-gray-900'>
                <Link to={`/profile/${user?._id}`}>{user?.username}</Link>
              </p>
              {user?.bio ? (
                <p className='truncate text-sm text-gray-500'>{user.bio}</p>
              ) : null}
            </div>
          </div>
          <input
            onChange={fileChangeHandler}
            type='file'
            accept='image/*'
            className='hidden'
            ref={fileRef}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            className='h-8 shrink-0 bg-blue-500 font-semibold text-white hover:bg-blue-600'
          >
            Change photo
          </Button>
        </div>

        {/* Bio */}
        <div>
          <Label htmlFor='edit-bio' className='text-sm font-semibold text-gray-900'>
            Bio
          </Label>
          <Textarea
            id='edit-bio'
            value={input.bio}
            onChange={e => setInput(prev => ({ ...prev, bio: e.target.value }))}
            placeholder='Tell people about yourself'
            className='mt-1 focus-visible:ring-transparent'
          />
        </div>

        {/* Gender */}
        <div>
          <Label className='text-sm font-semibold text-gray-900'>Gender</Label>
          <Select
            defaultValue={input.gender || undefined}
            onValueChange={value => setInput(prev => ({ ...prev, gender: value }))}
          >
            <SelectTrigger className='mt-1 w-[180px]'>
              <SelectValue placeholder='Select gender' />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value='male'>Male</SelectItem>
                <SelectItem value='female'>Female</SelectItem>
                <SelectItem value='other'>Other</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Submit */}
        <div className='flex justify-end'>
          <Button
            onClick={editProfileHandler}
            disabled={loading}
            className='h-8 bg-blue-500 font-semibold text-white hover:bg-blue-600'
          >
            {loading ? (
              <>
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Saving...
              </>
            ) : (
              'Submit'
            )}
          </Button>
        </div>
      </section>
    </div>
  );
};

export default EditProfile;
