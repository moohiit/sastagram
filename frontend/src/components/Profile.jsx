import useGetUserProfile from '@/hooks/useGetUserProfile';
import { cdn } from '@/lib/cdn'
import React, { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Button } from './ui/button';
import { Dialog } from '@radix-ui/react-dialog';
import { DialogContent, DialogTrigger } from './ui/dialog';
import { AtSign, Heart, MessageCircle, MoreHorizontal } from 'lucide-react';
import { Badge } from './ui/badge';
import axios from 'axios';
import { setAuthUser } from '@/redux/authSlice';

const Profile = () => {
  const params = useParams();
  const userId = params?.id;
  // console.log("ID:",userId);
  const dispatch = useDispatch()
  useGetUserProfile(userId);
  const { userProfile, user } = useSelector(store => store.auth);
  const [activeTab, setActiveTab] = useState("posts");
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  }
  const postsToDisplay = activeTab === "posts" ? userProfile?.posts : userProfile?.bookmarks;

  //Follow and unfollow handler
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
    <div className='flex flex-col m-8 justify-center items-center'>
      <section className='flex items-center justify-start gap-4'>
        {/* profile picture */}
        <div className='my-4 mx-4'>
          <Avatar className='w-40 h-40'>
            <AvatarImage src={userProfile?.profilePicture} />
            <AvatarFallback>MP</AvatarFallback>
          </Avatar>
        </div>
        {/* User Details */}
        <div className='flex flex-col justify-center items-start'>
          <div className='flex gap-5 mb-1 items-center'>
            <span className='text-gray-900 font-medium cursor-pointer'>{userProfile?.username}</span>
            {
              user?._id !== userProfile?._id ? (
                user?.following.includes(userProfile?._id) ? (
                  <>
                    <Button onClick={() => followUnfollowHandler(userProfile?._id)} className='bg-gray-800 hover:bg-red-700 h-8'>Unfollow</Button>
                    <Link to={`/chat/${userProfile?._id}`}>
                    <Button className='bg-gray-800 hover:bg-[#1d7deb] h-8'>Message</Button>
                    </Link>
                  </>
                ) : (
                    <Button onClick={() => followUnfollowHandler(userProfile?._id)} variant="secondary" className='bg-[#0095F6] hover:bg-[#0087f6] h-8 text-white'>follow</Button>
                )
              ) : (
                <>
                    <Link to={"/profile/edit"}><Button className='bg-gray-800 hover:bg-gray-950 h-8'>Edit Profile</Button></Link>
                  <Button className='bg-gray-800 hover:bg-gray-950 h-8'>View Archive</Button>
                  <Button className='bg-gray-800 hover:bg-gray-950 h-8'>Ad Tools</Button>
                </>
              )
            }

            <Dialog>
              <DialogTrigger>
                <MoreHorizontal />
              </DialogTrigger>
              <DialogContent className='flex flex-col gap-2 items-center justify-center w-72'>
                <Button className='text-[white] bg-[#b90404] w-[80%]'>Block</Button>
                <Button className='text-[white] bg-[#b90404] w-[80%]'>Report</Button>
                <Button className='text-[white] bg-[#b90404] w-[80%]'>Spam</Button>
                <Button className='w-[80%]'>More</Button>
              </DialogContent>
            </Dialog>
          </div>
          <div className='flex  gap-5 mb-1'>
            <p><span className='font-semibold'> {userProfile?.posts.length}</span> Posts</p>
            <div className='flex gap-1'>
              <span className='font-semibold'>{userProfile?.followers.length}</span>
              <Link to={`/${userProfile?._id}/followers`} >followers</Link>
            </div>
            <div className='flex gap-1'><span className='font-semibold'>{userProfile?.following.length}</span>
            <Link to={`/${userProfile?._id}/following`}>following</Link>
            </div>
          </div>
          <div className='flex flex-col'>
            <span className='text-gray-500 font-semibold'> {userProfile?.bio}</span>
            <Badge className='w-fit text-sm mt-1' variant={"secondary"}><AtSign /><span className='pl-1'>{userProfile?.username}</span></Badge>
          </div>
        </div>
      </section>
      <hr className="border-gray-300 border-t-2 my-4 w-full " />
      <section className='flex flex-col my-5 items-center text-center w-full '>
        <div className='flex items-center justify-evenly gap-10 text-sm my-4 bg-gray-100 w-full'>
          <span className={`py-3 cursor-pointer min-w-fit ${activeTab === "posts" ? "font-bold" : ""}`} onClick={() => { handleTabChange("posts") }}>Posts</span>
          <span className={`py-3 cursor-pointer min-w-fit ${activeTab === "saved" ? "font-bold" : ""}`} onClick={() => { handleTabChange("saved") }}>Saved</span>
        </div>
        <div className='grid grid-cols-3 gap-1'>
          {
            postsToDisplay?.length > 0 ? (
              postsToDisplay?.map((post) => {
                return (
                  <div key={post?._id} className='relative group cursor-pointer'>
                    <img src={cdn(post?.image, 500)} alt="Post Image" loading="lazy" className='rounded-sm w-full aspect-square object-cover' />
                    <div className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                      <div className='flex items-center text-white space-x-4'>
                        <button className='flex items-center gap-2 hover:text-gray-300'>
                          <Heart />
                          <span>{post?.likes.length}</span>
                        </button>
                        <button className='flex items-center gap-2 hover:text-gray-300'>
                          <MessageCircle />
                          <span>{post?.comments.length}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className='font-semibold text-gray-500'>No posts yet...😒🤡</div>
            )
          }

        </div>
      </section>
    </div>
  )
}

export default Profile
