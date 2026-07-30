import React, { useEffect, useState } from 'react'
import axios from 'axios';
import { cdn } from '@/lib/cdn';
import CommentDialog from './CommentDialog';

function Explore() {
  const [posts, setPosts] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        const response = await axios.get('/api/v1/post/all?limit=30', { withCredentials: true });
        if (!cancelled && response.data.success) {
          setPosts(response.data.posts || []);
        }
      } catch (error) {
        console.log(error);
      }
    };
    fetchPosts();
    return () => { cancelled = true; };
  }, []);

  const openPost = (post) => {
    setSelectedPost(post);
    setOpen(true);
  };

  return (
    <div className='max-w-4xl mx-auto p-4'>
      <h1 className='font-bold text-2xl text-gray-600 mb-4'>Explore</h1>
      <div className='grid grid-cols-3 gap-1 md:gap-2'>
        {posts.map((post) => (
          <button
            key={post._id}
            onClick={() => openPost(post)}
            className='relative aspect-square overflow-hidden bg-gray-100 focus:outline-none'
          >
            <img
              src={cdn(post.image, 500)}
              alt='Post'
              loading='lazy'
              className='w-full h-full object-cover hover:opacity-90 transition-opacity'
            />
          </button>
        ))}
      </div>
      {selectedPost && (
        <CommentDialog open={open} setOpen={setOpen} post={selectedPost} />
      )}
    </div>
  )
}

export default Explore;
