
import React, { useEffect, useState } from 'react'
import { cdn } from '@/lib/cdn'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { Badge } from './ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog'
import { Bookmark, Loader2, MessageCircle, MoreHorizontal, Send } from 'lucide-react'
import { Button } from './ui/button'
import { FaHeart, FaRegHeart } from 'react-icons/fa'
import CommentDialog from './CommentDialog'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'sonner'
import axios from 'axios'
import { setPosts } from '@/redux/postSlice'
import { setAuthUser } from '@/redux/authSlice'
import { Link } from 'react-router-dom'
function Post({ post }) {
  const { user } = useSelector(store => store.auth);
  const { posts } = useSelector(store => store.post);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  useEffect(() => {
    setComments(post.comments)
  }, [comments, post])
  const [open, setOpen] = useState(false);
  const dispatch = useDispatch();
  const [liked, setLiked] = useState(post.likes.includes(user?._id) || false);
  const [postLikes, setPostlikes] = useState(post.likes.length);
  useEffect(() => {
    setPostlikes(post.likes.length)
  },[post,postLikes])
  const [bookmarked, setBookmarked] = useState(user?.bookmarks.includes(post._id));
  const isFollowing = user?.following.includes(post.author?._id);
  const [loading, setLoading] = useState(false);


  //Delete Post Handler
  const deletePostHandler = async () => {
    try {
      setLoading(true);
      const postId = post._id
      const newPosts = posts.filter(pos => pos._id !== postId)
      // console.log("Old Posts", posts.length)
      // console.log("New Posts", newPosts.length)
      const response = await axios.delete(`/api/v1/post/delete/${post._id}`, {
        withCredentials: true
      })
      if (response.data.success) {
        dispatch(setPosts([...newPosts]))
        toast.success(response.data.message);
        setOpen(false);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response.data.message);
    } finally {
      setLoading(false);
    }
  }

  //Like and Dislike Handler
  const likeDislikeHandler = async () => {
    try {
      let response;
      if (liked) {
        response = await axios.get(`/api/v1/post/${post?._id}/dislike`, {
          withCredentials: true
        });
      } else {
        response = await axios.get(`/api/v1/post/${post?._id}/like`, {
          withCredentials: true
        });
      }
      if (response.data.success) {
        const updatedPostLikes = liked ? postLikes - 1 : postLikes + 1;
        const updatedPostData =
          posts?.map(p => (p._id === post._id) ? {
            ...p, likes: (liked) ? (p.likes.filter(id => id !== user._id)) : ([...p.likes, user._id])
          } : p);
        setPostlikes(updatedPostLikes);
        dispatch(setPosts(updatedPostData));
        setLiked(!liked)
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response.data.message)
    }
  }

  //Comment  change Handler
  const commentChangeHandler = (e) => {
    const inputText = e.target.value;
    if (inputText.trim()) {
      setComment(inputText);
    } else {
      setComment('');
    }
  }
  // show Comments handler
  const showComment = () => {
    setOpen(!open);
  }
  //Comment Handler
  const commentHandler = async () => {
    try {
      const response = await axios.post(`/api/v1/post/${post?._id}/comment`, { text: comment }, {
        withCredentials: true,
      })
      if (response.data.success) {
        const updatedComments = [...comments, response.data.comment];
        setComments(updatedComments);
        const updatedPostData = posts.map(p => p._id === post._id ? { ...p, comments: updatedComments } : p
        );
        dispatch(
          setPosts(
            updatedPostData
          )
        )
        setComment('');
        toast.success(response.data.message);
      }
    } catch (error) {
      console.log(error)
      toast.error(error.response.data.message);
    }
  }

  //Bookmark Handler
  const bookamarkHandler = async () => {
    try {
      const response = await axios.get(`/api/v1/post/${post?._id}/bookmark`, {
        withCredentials: true
      });
      if (response?.data.success) {
        const newBookmarks = response.data?.type === 'saved'
          ? [...user.bookmarks, post._id]
          : user.bookmarks.filter(bmrk => bmrk !== post._id);
        setBookmarked(response.data?.type === 'saved');
        dispatch(setAuthUser({ ...user, bookmarks: newBookmarks }));
        toast.success(response.data.message);
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response.data.message)
    }
  }

  // followUnfollowHandler
  const followUnfollowHandler = async (userId) => {
    try {
      const response = await axios.get(`/api/v1/user/followorunfollow/${userId}`, {
        withCredentials: true
      });

      if (response.data.success) {
        const newFollowingData = response.data.type === 'follow'
          ? [...user?.following, userId]
          : user?.following.filter(id => id !== userId);

        // Dispatch the updated user state
        dispatch(setAuthUser({ ...user, following: newFollowingData }));

        // Show success toast
        toast.success(response.data.message);
      }
    } catch (error) {
      console.error(error);

      // Show error toast
      toast.error(error.response?.data?.message || 'Something went wrong!');
    }
  }

  return (
    <div className='flex flex-col my-8 w-full max-w-sm mx-auto  border shadow-sm p-4
    '>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Link to={`/profile/${post?.author._id}`}>
            <Avatar className='w-6 h-6'>
              <AvatarImage src={post?.author.profilePicture} />
              <AvatarFallback>MP</AvatarFallback>
            </Avatar>
          </Link>
          <Link to={`/profile/${post?.author._id}`}>
            <h1>{post.author.username}</h1>
          </Link>
          {
            user?._id === post?.author._id && <Badge className={"bg-slate-400"} varient="primary">Author</Badge>
          }
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <MoreHorizontal className='cursor-pointer' />
          </DialogTrigger>
          <DialogContent className='flex flex-col p-0 gap-0 items-center text-sm'>
            <DialogDescription className='hidden'>This is options section of a post.</DialogDescription>
            <DialogTitle className='hidden text-center pt-2 align-middle justify-center items-center '>Post Options</DialogTitle>
            <Button onClick={bookamarkHandler} varient='secondary' className={`cursor-pointer bg-slate-100 m-[1px] w-full ${bookmarked ? 'text-[#f83b3b] hover:text-[#f53131]' : 'text-[#3BADF8] hover:text-[#31bdf5]'}  hover:bg-slate-200 `} >{bookmarked ? "Remove Bookmark" : "Add Bookmark"}</Button>
            {user && user._id !== post.author._id && (
              <Button
                variant='secondary'
                onClick={() => followUnfollowHandler(post.author._id)}
                className={`cursor-pointer bg-slate-100 m-[1px] w-full hover:bg-slate-200  ${isFollowing ? 'text-[#f83b3b] hover:text-[#f53131]' : 'text-[#3BADF8] hover:text-[#31bdf5]'} `}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
            {user && user._id === post.author._id && (
              loading ? (<Button disabled  >
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                Deleting...
              </Button>) : (<Button
                onClick={deletePostHandler}
                varient='ghost' className='cursor-pointer bg-slate-100 m-[1px] w-full text-[red]' >Delete</Button>)
            )}

          </DialogContent>
        </Dialog>
      </div>
      <img className='rounded-sm my-2 w-full aspect-square object-cover' src={cdn(post?.image, 800)} alt="post_Image" loading="lazy" />
      <div className='flex justify-between'>
        <div className='flex gap-3'>
          {
            liked ? (
              <FaHeart onClick={likeDislikeHandler} size={"22px"} className='cursor-pointer hover:text-red-600 text-red-600' />
            ) : (
              <FaRegHeart onClick={likeDislikeHandler} size={"22px"} className='cursor-pointer hover:text-gray-600' />
            )
          }

          <MessageCircle onClick={showComment} className='cursor-pointer hover:text-gray-600' />
          <Send className='cursor-pointer hover:text-gray-600' />
        </div>
        <Bookmark
          onClick={bookamarkHandler}
          className={`cursor-pointer hover:text-gray-600 ${bookmarked ? 'text-red-600' : ''}`} />
      </div>
      <span className='font-medium block mb-2 '>{postLikes} likes</span>
      <p><span className='font-medium mr-2'>{post.author.username}</span>{post.caption}</p>
      {comments.length > 0 && (
        <span onClick={showComment} className="cursor-pointer text-sm text-gray-400">
          {comments.length === 1 ? 'View 1 comment' : `View all ${comments.length} comments`}
        </span>
      )}
      <CommentDialog open={open} setOpen={setOpen} post={post} />
      <div className='flex justify-between border p-2 rounded-md mt-2'>
        <input
          type="text"
          value={comment}
          onChange={commentChangeHandler}
          placeholder='Add a comment'
          className='outline-none text-sm w-full'
        />
        {
          comment && <span
            onClick={commentHandler}
            className='cursor-pointer font-semibold text-[#38adf8]'>Post</span>
        }
      </div>
    </div>

  )
}

export default Post
