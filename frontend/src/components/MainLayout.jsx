import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import LeftSidebar from './LeftSidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import CreatePost from './CreatePost';

/**
 * App shell:
 *  - < 768px: sticky TopBar + fixed BottomNav
 *  - 768–1263px: fixed 72px icon rail
 *  - >= 1264px: fixed 244px sidebar with labels
 * Pages render centered inside <Outlet/>; the shell owns all chrome offsets.
 */
function MainLayout() {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className='min-h-screen bg-white text-gray-900'>
      <TopBar />
      <LeftSidebar openCreate={() => setCreateOpen(true)} />

      <main className='md:pl-[72px] min-[1264px]:pl-[244px] pb-16 md:pb-0'>
        <div className='mx-auto w-full max-w-[1000px] min-h-screen'>
          <Outlet />
        </div>
      </main>

      <BottomNav openCreate={() => setCreateOpen(true)} />
      <CreatePost open={createOpen} setOpen={setCreateOpen} />
    </div>
  );
}

export default MainLayout;
