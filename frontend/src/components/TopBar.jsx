import React from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MessageCircle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';

// Mobile-only (< 768px) sticky header: logo left, messages right.
// Guests get a Log in button instead of the messages shortcut.
function TopBar() {
  const { user } = useSelector(store => store.auth);

  return (
    <header className='md:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black px-4'>
      <Link to='/' className='font-bold text-xl tracking-tight ig-gradient-text'>
        SastaGram
      </Link>
      {user ? (
        <div className='flex items-center gap-1'>
          <ThemeToggle />
          <Link to='/messages' aria-label='Messages' className='p-1 text-zinc-900 dark:text-gray-100'>
            <MessageCircle size={24} />
          </Link>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <ThemeToggle />
          <Link
            to='/login'
            className='rounded-lg bg-blue-500 hover:bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors'
          >
            Log in
          </Link>
        </div>
      )}
    </header>
  );
}

export default TopBar;
