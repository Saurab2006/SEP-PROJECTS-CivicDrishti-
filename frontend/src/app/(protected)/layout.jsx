import ProtectedLayout from '@/components/ProtectedLayout';
export default function Layout({ children }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
