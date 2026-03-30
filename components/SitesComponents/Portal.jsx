'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState(null);

  useEffect(() => {
    setMounted(true);
    
    // Create a div for the portal
    const portalContainer = document.createElement('div');
    portalContainer.className = 'react-portal-container';
    document.body.appendChild(portalContainer);
    setContainer(portalContainer);

    return () => {
      // Clean up safely
      if (portalContainer && portalContainer.parentNode) {
        portalContainer.parentNode.removeChild(portalContainer);
      }
    };
  }, []);

  if (!mounted || !container) return null;

  return createPortal(children, container);
}