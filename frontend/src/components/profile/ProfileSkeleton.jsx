import React from 'react';

// Loading skeleton matching the profile page layout.
const ProfileSkeleton = () => (
  <div className='mx-auto w-full max-w-[935px] px-4'>
    <header className='flex items-center gap-6 py-6 sm:gap-10 sm:py-10 md:gap-20'>
      <div className='h-[77px] w-[77px] shrink-0 animate-pulse rounded-full bg-zinc-800 sm:h-[150px] sm:w-[150px]' />
      <div className='flex min-w-0 flex-1 flex-col gap-4'>
        <div className='h-6 w-40 animate-pulse rounded bg-zinc-800' />
        <div className='hidden h-4 w-64 animate-pulse rounded bg-zinc-800 sm:block' />
        <div className='hidden h-4 w-52 animate-pulse rounded bg-zinc-800 sm:block' />
      </div>
    </header>
    <div className='grid grid-cols-3 gap-1 border-t border-zinc-800 pt-1'>
      {[...Array(6)].map((_, i) => (
        <div key={i} className='aspect-square w-full animate-pulse rounded bg-zinc-800' />
      ))}
    </div>
  </div>
);

export default ProfileSkeleton;
