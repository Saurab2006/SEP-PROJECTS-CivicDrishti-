'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      title={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      className={`relative inline-flex h-8 w-15 shrink-0 items-center rounded-full border transition-colors ${isDark ? 'border-white/15 bg-[#1b2333]' : 'border-[#e2d9c9] bg-[#f2ede1]'} ${className}`}
      style={{ width: 60 }}
    >
      <span
        className={`absolute top-0.5 flex h-7 w-7 items-center justify-center rounded-full shadow-sm transition-transform ${isDark ? 'translate-x-[29px] bg-[#0f172a]' : 'translate-x-0.5 bg-white'}`}
      >
        {isDark ? <Moon className="h-3.5 w-3.5 text-[#cbd5e1]" /> : <Sun className="h-3.5 w-3.5 text-[#cf1f3b]" />}
      </span>
    </button>
  );
}