'use client';

import { useEffect, useRef, useCallback } from 'react';

const ContextMenu = ({ x, y, onClose, items }) => {
  const menuRef = useRef(null);

  // Handle click outside
  const handleClickOutside = useCallback((event) => {
    if (menuRef.current && !menuRef.current.contains(event.target)) {
      onClose();
    }
  }, [onClose]);

  // Handle escape key
  const handleEscapeKey = useCallback((event) => {
    if (event.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    // Add event listeners with a small delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [handleClickOutside, handleEscapeKey]);

  // Adjust position if menu would go off-screen
  const adjustPosition = () => {
    if (!menuRef.current) return { x, y };
    
    const rect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = x;
    let adjustedY = y;
    
    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10;
    }
    
    if (y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 10;
    }
    
    return { x: Math.max(10, adjustedX), y: Math.max(10, adjustedY) };
  };

  const position = adjustPosition();

  return (
    <div
      ref={menuRef}
      className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-[1000] py-1 min-w-[160px]"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {items.map((item, index) => (
        <button
          key={index}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className="w-full px-4 py-2 text-left hover:bg-gray-700 text-white text-sm flex items-center gap-2"
          disabled={item.disabled}
        >
          {item.icon && <span className="w-4 h-4">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;