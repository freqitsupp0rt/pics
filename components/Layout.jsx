'use client';

import { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Menu, X, Home, User, HouseWifi, Router, Logs, FilePlus2, LogOut, Flag } from 'lucide-react'; 
import { useAuth } from '@/hooks/useAuth';
import { usePathname, useRouter } from 'next/navigation';

const MySwal = withReactContent(Swal);

const links = [
  { name: 'Dashboard', href: '/dashboard', icon: <Home size={18} /> },
  { name: 'Sites', href: '/sites', icon: <HouseWifi size={18} /> },
  { name: 'Clients', href: '/site-clients', icon: <User size={18} /> },
  { name: 'AP Devices', href: '/site-aps', icon: <Router size={18} /> },
  { name: 'Generate', href: '/generate', icon: <FilePlus2 size={18} /> },
  { name: 'Manual Data', href: '/manual-data', icon: <FilePlus2 size={18} />, role: 'developer' },
  { name: 'Events', href: '/events', icon: <Logs size={18} />, role: 'developer' },
  { name: 'MIR', href: '/mir', icon: <Flag size={18} />, role: 'developer' },
];

// Text Type Animation Component
const TypewriterText = ({ text, speed = 100, className = "" }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);

  return (
    <span className={className}>
      {displayText}
      <span className="animate-pulse">|</span>
    </span>
  );
};

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // Initialize the current path listener


  const isRestrictedPage = pathname === '/site-aps' || pathname === '/site-clients';


  const sidebarClass =
    'backdrop-blur-md bg-white/10 dark:bg-gray-800/20 border-r border-white/20 text-white';

  const headerClass =
    'backdrop-blur-md bg-white/10 dark:bg-gray-800/20 border-b border-white/20 shadow';

  const handleLogout = async () => {
    const result = await MySwal.fire({
      title: 'Are you sure?',
      text: "You will be logged out of the system.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, logout',
      cancelButtonText: 'Cancel',
      background: '#1f2937',
      color: 'white',
    });

    if (result.isConfirmed) {
      try {
        await logout();
        await MySwal.fire({
          title: 'Logged out!',
          text: 'You have been successfully logged out.',
          icon: 'success',
          confirmButtonColor: '#10b981',
          background: '#1f2937',
          color: 'white',
        });
      } catch (error) {
        MySwal.fire({
          icon: 'error',
          title: 'Logout Failed',
          text: 'Could not logout. Please try again.',
          confirmButtonColor: '#dc2626',
          background: '#1f2937',
          color: 'white',
        });
      }
    }
  };

  const SidebarContent = () => (
    <nav className="space-y-2">
      {links
        .filter(link => {
          // 1. First check if the user has the required role for the link
          const roleMatch = !link.role || link.role === user?.role;
          
          // 2. Then check if we are on a restricted page (/site-aps or /site-clients)
          // If so, hide any link that has the 'developer' role
          if (isRestrictedPage && link.role === 'developer') {
            return false;
          }

          return roleMatch;
        })
        .map(({ name, href, icon }) => (
          <Link
            key={name}
            href={href}
            className={`flex items-center gap-3 hover:bg-white/10 rounded-lg px-4 py-3 transition-all duration-200 hover:translate-x-1 ${
              pathname === href ? 'bg-white/20 border-l-4 border-blue-500' : ''
            }`}
            onClick={() => setSidebarOpen(false)}
          >
            {icon}
            <span className="font-medium">{name}</span>
          </Link>
        ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: sidebarOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={`fixed z-50 inset-y-0 left-0 w-64 p-5 md:hidden overflow-y-auto flex flex-col ${sidebarClass}`}
        aria-label="Sidebar"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold min-h-[28px]">
            <TypewriterText text="PICS MONITORING" speed={80} />
          </h2>
          <button 
            onClick={() => setSidebarOpen(false)} 
            aria-label="Close sidebar"
            className="hover:bg-white/10 p-1 rounded transition"
          >
            <X size={24} />
          </button>
        </div>
        <SidebarContent />
      </motion.aside>

      {/* Desktop Sidebar - Now FIXED not sticky */}
      <aside className={`hidden md:flex md:flex-col md:w-64 p-5 overflow-y-auto fixed top-0 left-0 h-full ${sidebarClass}`}>
        <h2 className="text-xl font-bold mb-6 ml-1 min-h-[28px]">
          <TypewriterText text="PICS MONITORING" speed={80} />
        </h2>
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <div className="md:ml-64"> {/* Add margin for desktop sidebar */}
        {/* Header - Now FIXED not sticky */}
        <header className={`p-4 flex items-center justify-between fixed top-0 right-0 left-0 md:left-64 z-30 ${headerClass}`}>
          {/* Left side - Menu button (mobile only) */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-white focus:outline-none focus:ring-2 focus:ring-gray-500 rounded p-1 hover:bg-white/10 transition"
            aria-label="Open sidebar"
          >
            <Menu size={24} />
          </button>

          {/* Center - Empty space for mobile balance */}
          <div className="flex-1 md:hidden"></div>

          {/* Right side - User info and logout (always visible) */}
          <div className="flex items-center gap-4 ml-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <User size={16} />
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{user?.name || 'User'}</p>
                <p className="text-xs text-gray-300">{user?.role || 'Admin'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg px-3 py-2 transition-all duration-200 border border-red-400/30"
              aria-label="Logout"
            >
              <LogOut size={18} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </header>
        
        {/* Page Content - Scrollable area with padding for fixed header */}
        <main className="pt-16 p-4"> {/* pt-16 for header height */}
          {children}
        </main>
      </div>
    </div>
  );
}