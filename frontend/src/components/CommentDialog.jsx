import { useEffect } from 'react';
import { cdn } from '@/lib/cdn'
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogTrigger, DialogDescription } from './ui/dialog';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Loader2, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import axios from 'axios';
import { setPosts } from '@/redux/postSlice';
import { setAuthUser } from '@/redux/authSlice'; // Make sure you import this

function CommentDialog({ open, setOpen, post }) {
  const { posts } = useSelector(store => store.post);
  const { user } = useSelector(store => store.auth);
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bookmarked, setBookmarked] = useState(user?.bookmarks.includes(post._id));
  useEffect(() => {
    setComments(post.comments);
  }, [post]);

  const dispatch = useDispatch();

  const isFollowing = user?.following.includes(post.author?._id);

  const commentHandler = (e) => {
    const inputText = e.target.value;
    setComment(inputText.trim() ? inputText : "");
  };

  const sendComment = async () => {
    try {
      const response = await axios.post(`/api/v1/post/${post._id}/comment`, { text: comment }, { withCredentials: true });
      if (response.data.success) {
        const updatedComments = [...comments, response.data.comment];
        setComments(updatedComments);

        const updatedPostData = posts.map(p => p._id === post._id ? { ...p, comments: updatedComments } : p);
        dispatch(setPosts(updatedPostData));

        setComment('');
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  const bookmarkHandler = async () => {  // Corrected function name
    try {
      const response = await axios.get(`/api/v1/post/${post?._id}/bookmark`, { withCredentials: true });
      if (response?.data.success) {
        const newBookmarks = response.data?.type === 'saved'
          ? [...user.bookmarks, post._id]
          : user.bookmarks.filter(bmrk => bmrk !== post._id);
        setBookmarked(response.data?.type === 'saved');
        dispatch(setAuthUser({ ...user, bookmarks: newBookmarks }));
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  const deletePostHandler = async () => {
    try {
      setLoading(true);
      const postId = post._id;
      const newPosts = posts.filter(pos => pos._id !== postId);

      const response = await axios.delete(`/api/v1/post/delete/${post._id}`, { withCredentials: true });
      if (response.data.success) {
        dispatch(setPosts([...newPosts]));
        toast.success(response.data.message);
        setOpen(false);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCommentHandler = async (commentId) => {
    try {
      const response = await axios.delete(`/api/v1/post/comment/${commentId}`, { withCredentials: true });
      if (response.data.success) {
        const updatedComments = comments.filter(cmnt => cmnt._id !== response.data.commentId);
        setComments(updatedComments);

        const updatedPostData = posts.map(p => p._id === post._id ? { ...p, comments: updatedComments } : p);
        dispatch(setPosts(updatedPostData));

        toast.success('Comment deleted');
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Failed to delete comment');
    }
  };

  const followUnfollowHandler = async (userId) => {
    try {
      const response = await axios.get(`/api/v1/user/followorunfollow/${userId}`, { withCredentials: true });
      if (response.data.success) {
        const newFollowingData = response.data.type === 'follow'
          ? [...user?.following, userId]
          : user?.following.filter(id => id !== userId);

        dispatch(setAuthUser({ ...user, following: newFollowingData }));
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Something went wrong!');
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent onInteractOutside={() => setOpen(false)} className='max-w-5xl p-0 flex flex-col'>
        <DialogDescription className='hidden'>This is comments section of a post.</DialogDescription>
        <DialogTitle className='flex text-center pt-2 align-middle justify-center items-center '>Comments</DialogTitle>
        <div className='flex flex-1'>
          <div className='flex w-1/2'>
            <img src={cdn(post.image, 800)} alt="Image" loading="lazy" className='rounded-sm p-2 w-full aspect-square object-cover' />
          </div>
          <div className='flex w-1/2 flex-col justify-between'>
            <div className='flex justify-between p-4'>
              <div className='flex gap-3 items-center'>
                <Link>
                  <Avatar>
                    <AvatarImage src={post.author?.profilePicture || '/default-profile-picture.jpg'} />
                    <AvatarFallback>MP</AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <Link className='font-semibold text-sm'>{post.author?.username || 'Anonymous'}</Link>
                </div>
              </div>
              <Dialog>
                <DialogTrigger className='cursor-pointer select-none'>
                  <MoreHorizontal />
                </DialogTrigger>
                <DialogContent className='flex flex-col p-0 gap-0 items-center text-sm'>
                  <DialogDescription className='hidden'>Options for the post deletion and follow/unfollow.</DialogDescription>
                  <Button onClick={bookmarkHandler} variant='secondary' className='cursor-pointer bg-slate-100 m-[1px] w-full text-gray-500 hover:bg-slate-200 '>
                    Add to favorites
                  </Button>
                  {user && user._id !== post.author._id && (
                    <Button
                      variant='secondary'
                      onClick={() => followUnfollowHandler(post.author._id)}
                      className={`cursor-pointer bg-slate-100 m-[1px] w-full hover:bg-slate-200  ${isFollowing ? 'text-[#f83b3b] hover:text-[#f53131]' : 'text-[#3BADF8] hover:text-[#31bdf5]'}`}
                    >
                      {isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                  )}
                  {user && user._id === post.author._id && (
                    loading ? (
                      <Button disabled>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Deleting...
                      </Button>
                    ) : (
                      <Button onClick={deletePostHandler} variant='ghost' className='cursor-pointer bg-slate-100 m-[1px] w-full text-[red]'>
                        Delete
                      </Button>
                    )
                  )}
                </DialogContent>
              </Dialog>
            </div>
            <hr className='bg-slate-100' />
            <div className='flex-1 overflow-auto max-h-96 p-4'>
              {comments.map((cmnt, index) => (
                <div key={cmnt._id || index} className='flex gap-2 items-center group'>
                  <Avatar>
                    <AvatarImage src={cmnt.author?.profilePicture || '/default-profile-picture.jpg'} />
                    <AvatarFallback>MP</AvatarFallback>
                  </Avatar>
                  <div className='flex flex-col flex-1'>
                    <span className='font-semibold'>{cmnt.author?.username || 'Anonymous'}</span>
                    <span>{cmnt.text}</span>
                  </div>
                  {user && (cmnt.author?._id === user._id || post.author?._id === user._id) && (
                    <button
                      onClick={() => deleteCommentHandler(cmnt._id)}
                      title='Delete comment'
                      className='text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className='p-4'>
              <div className='flex items-center gap-2'>
                <input
                  type="text"
                  value={comment}
                  onChange={commentHandler}
                  placeholder='Add a comment'
                  className='w-full outline-none border border-gray-300 p-2 rounded'
                />
                <Button disabled={!comment.trim()} onClick={sendComment} variant='outline' className='border border-gray-300'>
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CommentDialog;
