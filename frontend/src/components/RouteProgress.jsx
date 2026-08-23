'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const firstRender = useRef(true);

  const startProgress = () => {
    clearInterval(timerRef.current);
    setVisible(true);
    setProgress(15);
    timerRef.current = setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.random() * 10 : p));
    }, 200);
  };

  const finishProgress = () => {
    clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  };

  // Kick the bar off the moment someone clicks an internal link, before
  // Next.js finishes fetching/rendering the new route.
  useEffect(() => {
    const handleClick = (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || anchor.target === '_blank') return;
      if (href === window.location.pathname + window.location.search) return;
      startProgress();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // Route has committed - finish the bar.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    finishProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => clearInterval(timerRef.current), []);

  if (!visible) return null;

  return (
    <div className="fixed left-0 top-0 z-[100] h-[3px] w-full bg-transparent">
      <div
        className="h-full bg-[var(--gov-primary)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%`, boxShadow: '0 0 8px var(--gov-primary)' }}
      />
    </div>
  );
}