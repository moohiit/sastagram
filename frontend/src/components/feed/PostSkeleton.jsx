import React from 'react'

// Placeholder card matching the Post layout, shown while the first page loads.
function PostSkeleton() {
  return (
    <div className='bg-white border border-gray-200 rounded-lg mb-4 overflow-hidden'>
      <div className='flex items-center gap-2 px-3 py-2.5'>
        <div className='h-8 w-8 rounded-full animate-pulse bg-gray-200' />
        <div className='h-3 w-28 animate-pulse bg-gray-200 rounded' />
      </div>
      <div className='w-full aspect-square animate-pulse bg-gray-200' />
      <div className='p-3 space-y-2'>
        <div className='h-4 w-40 animate-pulse bg-gray-200 rounded' />
        <div className='h-3 w-64 animate-pulse bg-gray-200 rounded' />
        <div className='h-3 w-32 animate-pulse bg-gray-200 rounded' />
      </div>
    </div>
  )
}

export default PostSkeleton
