import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from 'sonner';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export const metadata = {
  title: 'Civicदृष्टि - Civic Service Accountability Platform',
  description: 'Human-centered ward reporting, verification, authority assignment, and public resolution tracking for Nepal',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.svg',
    apple: '/icons/icon-512.svg',
  },
};

export const viewport = {
  themeColor: '#0f3d3e',
};

// Runs before React hydrates so the page never flashes light-mode colors
// for a dark-mode user (reads the same key ThemeContext writes to).
const noFlashScript = `(function(){try{var t=localStorage.getItem('civic-theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}if(t==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="min-h-screen bg-[#f5f1e8] text-[#102a2b] antialiased dark:bg-[#0b1220] dark:text-[#e7e9ee]">
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              {children}
              <Toaster position="bottom-right" toastOptions={{ style: { borderRadius: 12, fontSize: 13 } }} />
              <ServiceWorkerRegistration />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}