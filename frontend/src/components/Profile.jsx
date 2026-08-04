import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, Grid3x3, Lock, Settings as SettingsIcon, ShieldOff } from 'lucide-react';
import useGetUserProfile from '@/hooks/useGetUserProfile';
import useRequireLogin from '@/hooks/useRequireLogin';
import { cdn } from '@/lib/cdn';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import FollowButton from './profile/FollowButton';
import PostsGrid from './profile/PostsGrid';
import ProfileSkeleton from './profile/ProfileSkeleton';

const Profile = () => {
  const { id: userId } = useParams();
  useGetUserProfile(userId);
  const { userProfile, user } = useSelector(store => store.auth);
  const requireLogin = useRequireLogin();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('posts');

  const blockHandler = async () => {
    if (!requireLogin()) return;
    if (!window.confirm(`Block @${userProfile?.username}? They won't be able to find your profile, follow you, or message you.`)) return;
    try {
      await axios.post(`/api/v1/user/block/${userId}`, {}, { withCredentials: true });
      toast.success('User blocked');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not block user');
    }
  };

  const isOwnProfile = user?._id === userId;
  // Show the skeleton until the profile for THIS route param is in the store
  // (userProfile may still hold a previously visited profile).
  const isLoading = !userProfile || userProfile._id !== userId;

  useEffect(() => {
    setActiveTab('posts');
  }, [userId]);

  if (isLoading) return <ProfileSkeleton />;

  const postsToDisplay =
    activeTab === 'saved' && isOwnProfile ? userProfile.bookmarks : userProfile.posts;

  const stats = [
    { label: 'posts', count: userProfile.restricted ? userProfile.postsCount ?? 0 : userProfile.posts?.length ?? 0 },
    { label: 'followers', count: userProfile.followersCount ?? userProfile.followers?.length ?? 0, to: `/${userProfile._id}/followers` },
    { label: 'following', count: userProfile.followingCount ?? userProfile.following?.length ?? 0, to: `/${userProfile._id}/following` },
  ];

  const tabClass = isActive =>
    `-mt-px flex cursor-pointer items-center gap-1.5 border-t py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
      isActive ? 'border-gray-100 text-gray-100' : 'border-transparent text-zinc-500 hover:text-zinc-400'
    }`;

  return (
    <div className='mx-auto w-full max-w-[935px] px-4'>
      {/* Header */}
      <header className='flex items-center gap-6 py-6 sm:gap-10 sm:py-10 md:gap-20'>
        <Avatar className='h-[77px] w-[77px] shrink-0 sm:h-[150px] sm:w-[150px]'>
          <AvatarImage src={cdn(userProfile.profilePicture, 300)} alt={userProfile.username} />
          <AvatarFallback className='text-2xl'>
            {userProfile.username?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        <section className='flex min-w-0 flex-1 flex-col gap-4'>
          <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
            <h1 className='truncate text-xl text-gray-100'>{userProfile.username}</h1>
            {isOwnProfile ? (
              <div className='flex items-center gap-2'>
                <Link to='/profile/edit'>
                  <Button variant='secondary' className='h-8 font-semibold'>
                    Edit profile
                  </Button>
                </Link>
                <Link to='/settings' title='Settings' aria-label='Settings'>
                  <Button variant='secondary' className='h-8 px-2'>
                    <SettingsIcon size={16} />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className='flex items-center gap-2'>
                <FollowButton
                  userId={userProfile._id}
                  initialRequested={Boolean(userProfile.requestedByMe)}
                />
                <Link
                  to={`/chat/${userProfile._id}`}
                  onClick={(e) => {
                    if (!requireLogin()) e.preventDefault();
                  }}
                >
                  <Button variant='secondary' className='h-8 font-semibold'>
                    Message
                  </Button>
                </Link>
                {user && (
                  <Button
                    variant='secondary'
                    title='Block user'
                    aria-label='Block user'
                    className='h-8 px-2 text-red-500'
                    onClick={blockHandler}
                  >
                    <ShieldOff size={16} />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Stats — inline on desktop */}
          <div className='hidden items-center gap-10 text-sm text-gray-100 sm:flex'>
            {stats.map(s =>
              s.to ? (
                <Link key={s.label} to={s.to} className='cursor-pointer hover:text-zinc-400'>
                  <span className='font-semibold'>{s.count}</span> {s.label}
                </Link>
              ) : (
                <span key={s.label}>
                  <span className='font-semibold'>{s.count}</span> {s.label}
                </span>
              )
            )}
          </div>

          {/* Bio — desktop */}
          {userProfile.bio ? (
            <p className='hidden whitespace-pre-line text-sm text-gray-100 sm:block'>
              {userProfile.bio}
            </p>
          ) : null}
        </section>
      </header>

      {/* Bio — mobile */}
      {userProfile.bio ? (
        <p className='whitespace-pre-line pb-4 text-sm text-gray-100 sm:hidden'>
          {userProfile.bio}
        </p>
      ) : null}

      {/* Stats — bordered row on mobile */}
      <div className='grid grid-cols-3 border-y border-zinc-800 py-3 text-center sm:hidden'>
        {stats.map(s => {
          const inner = (
            <>
              <span className='text-sm font-semibold text-gray-100'>{s.count}</span>
              <span className='text-sm text-zinc-400'>{s.label}</span>
            </>
          );
          return s.to ? (
            <Link key={s.label} to={s.to} className='flex cursor-pointer flex-col'>
              {inner}
            </Link>
          ) : (
            <div key={s.label} className='flex flex-col'>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className='flex items-center justify-center gap-12 border-t border-zinc-800 max-sm:border-t-0'>
        <button onClick={() => setActiveTab('posts')} className={tabClass(activeTab === 'posts')}>
          <Grid3x3 size={14} /> Posts
        </button>
        {isOwnProfile ? (
          <button onClick={() => setActiveTab('saved')} className={tabClass(activeTab === 'saved')}>
            <Bookmark size={14} /> Saved
          </button>
        ) : null}
      </div>

      <div className='pb-8'>
        {userProfile.restricted ? (
          <div className='flex flex-col items-center gap-2 py-14 text-center'>
            <div className='rounded-full border border-zinc-700 p-4'>
              <Lock size={28} className='text-gray-100' />
            </div>
            <p className='text-sm font-semibold text-gray-100'>This account is private</p>
            <p className='text-sm text-zinc-400'>Follow to see their photos.</p>
          </div>
        ) : (
          <PostsGrid
            posts={postsToDisplay}
            emptyText={activeTab === 'saved' ? 'No saved posts yet' : 'No posts yet'}
          />
        )}
      </div>
    </div>
  );
};

export default Profile;
