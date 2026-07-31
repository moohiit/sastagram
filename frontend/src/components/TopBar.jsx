import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

// Mobile-only (< 768px) sticky header: logo left, messages right.
function TopBar() {
  return (
    <header className='md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4'>
      <Link to='/' className='font-bold text-xl tracking-tight text-gray-900'>
        SastaGram
      </Link>
      <Link to='/messages' aria-label='Messages' className='p-1 text-gray-900'>
        <MessageCircle size={24} />
      </Link>
    </header>
  );
}

export default TopBar;
