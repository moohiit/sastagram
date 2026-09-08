import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, toggleTheme } from '@/lib/theme';

// Light/dark switcher. variant="row" renders a sidebar-style row with a
// label; variant="icon" renders a bare icon button (TopBar).
function ThemeToggle({ variant = 'icon', className = '', label = null }) {
  const [theme, setTheme] = useState(getTheme());
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const text = isDark ? 'Light mode' : 'Dark mode';

  const handleClick = () => setTheme(toggleTheme());

  if (variant === 'row') {
    return (
      <button type='button' onClick={handleClick} title={text} aria-label={text} className={className}>
        <Icon size={26} className='shrink-0' />
        {label ? label(text, false) : <span className='text-[15px]'>{text}</span>}
      </button>
    );
  }

  return (
    <button
      type='button'
      onClick={handleClick}
      title={text}
      aria-label={text}
      className={`p-1 text-zinc-900 dark:text-gray-100 cursor-pointer ${className}`}
    >
      <Icon size={24} />
    </button>
  );
}

export default ThemeToggle;
