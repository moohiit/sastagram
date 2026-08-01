import React from 'react';
import { Camera, Heart, MessageCircle } from 'lucide-react';
import { cdn } from '@/lib/cdn';

// 3-column square grid of posts with an Instagram-style hover overlay
// showing like/comment counts.
const PostsGrid = ({ posts, emptyText = 'No posts yet' }) => {
  if (!posts || posts.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center gap-3 py-16'>
        <div className='flex h-14 w-14 items-center justify-center rounded-full border-2 border-gray-100'>
          <Camera size={28} strokeWidth={1.5} className='text-gray-100' />
        </div>
        <p className='text-base font-semibold text-gray-100'>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-3 gap-1'>
      {posts.map(post => (
        <div key={post?._id} className='group relative cursor-pointer'>
          <img
            src={cdn(post?.image, 500)}
            alt={post?.altText || 'Post'}
            loading='lazy'
            className='aspect-square w-full object-cover'
          />
          <div className='absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex'>
            <div className='flex items-center gap-6 text-sm font-semibold text-white'>
              <span className='flex items-center gap-2'>
                <Heart size={20} fill='currentColor' />
                {post?.likes?.length ?? 0}
              </span>
              <span className='flex items-center gap-2'>
                <MessageCircle size={20} fill='currentColor' />
                {post?.comments?.length ?? 0}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PostsGrid;
