import useGetAllPost from '@/hooks/useGetAllPost';
import useGetSuggestedUsers from '@/hooks/useGetSuggestedUsers';
import useGetFollowings from '@/hooks/useGetFollowings';
import Posts from './Posts';
import RightSidebar from './RightSidebar';

export default function Home() {
  useGetAllPost();
  useGetSuggestedUsers();
  useGetFollowings();

  return (
    <div className='flex justify-center gap-16 px-4'>
      <div className='w-full max-w-[470px]'>
        <Posts />
      </div>
      <aside className='hidden min-[1160px]:block w-[320px] shrink-0'>
        <RightSidebar />
      </aside>
    </div>
  );
}
