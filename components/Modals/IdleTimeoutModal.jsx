'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

const IdleTimeoutModal = () => {
  const { logout, checkTokenExpiry: authCheckTokenExpiry } = useAuth(); // Renamed to avoid conflict
  const router = useRouter();
  const hasShownExpiredModalRef = useRef(false);
  const hasShownWarningModalRef = useRef(false);
  const tokenCheckIntervalRef = useRef(null);
  const idleTimeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const [isClient, setIsClient] = useState(false);

  // Idle timeout duration (1 hour in milliseconds)
  const IDLE_TIMEOUT = 60 * 60 * 1000; // 1 hour
  const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000; // Show warning 5 minutes before timeout

  // Reset idle timer on user interaction
  const resetIdleTimer = useCallback(() => {
    // Clear existing timeouts
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    
    // Reset modal flags if user is active
    if (hasShownWarningModalRef.current) {
      hasShownWarningModalRef.current = false;
      // Close any warning modal that might be open
      if (Swal.isVisible()) {
        Swal.close();
      }
    }

    // Set new warning timeout (55 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      showIdleWarning();
    }, IDLE_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Set new idle timeout (1 hour)
    idleTimeoutRef.current = setTimeout(() => {
      handleIdleTimeout();
    }, IDLE_TIMEOUT);
  }, [IDLE_TIMEOUT, WARNING_BEFORE_TIMEOUT]);

  // Show warning modal
  const showIdleWarning = () => {
    if (hasShownWarningModalRef.current || !isClient) return;
    hasShownWarningModalRef.current = true;

    // Close any existing modals
    if (Swal.isVisible()) {
      Swal.close();
    }

    setTimeout(() => {
      Swal.fire({
        title: '<strong style="font-size: 24px;">Session About to Expire</strong>',
        html: `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: #F59E0B; margin-bottom: 20px;">
              ⏰
            </div>
            <p style="font-size: 18px; color: #374151; margin-bottom: 10px;">
              Your session will expire in 5 minutes due to inactivity.
            </p>
            <p style="font-size: 14px; color: #6B7280;">
              Click anywhere to continue your session.
            </p>
          </div>
        `,
        icon: 'warning',
        showConfirmButton: false,
        showCancelButton: false,
        allowOutsideClick: true,
        allowEscapeKey: true,
        backdrop: 'rgba(0, 0, 0, 0.6)',
        background: 'rgba(255, 255, 255, 0.95)',
        timer: 60000, // Auto close after 1 minute
        timerProgressBar: true,
        showClass: {
          popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
          popup: 'animate__animated animate__fadeOutUp'
        },
        customClass: {
          popup: 'rounded-[20px] backdrop-blur-sm',
          container: 'backdrop-blur-sm',
          timerProgressBar: 'bg-blue-500'
        },
        willOpen: () => {
          document.body.style.overflow = 'hidden';
        },
        willClose: () => {
          document.body.style.overflow = 'auto';
          hasShownWarningModalRef.current = false;
        }
      }).then((result) => {
        if (result.dismiss === Swal.DismissReason.timer) {
          // Timer expired, session will timeout in 4 more minutes
        }
      });
    }, 100);
  };

  // Handle idle timeout
  const handleIdleTimeout = async () => {
    if (hasShownExpiredModalRef.current || !isClient) return;
    hasShownExpiredModalRef.current = true;

    // Close any existing modals
    if (Swal.isVisible()) {
      Swal.close();
    }

    setTimeout(() => {
      Swal.fire({
        title: '<strong style="font-size: 24px;">Session Expired Due to Inactivity</strong>',
        html: `
          <div style="text-align: center; padding: 20px;">
            <div style="font-size: 48px; color: #EF4444; margin-bottom: 20px;">
              🔒
            </div>
            <p style="font-size: 18px; color: #374151; margin-bottom: 10px;">
              You have been logged out due to inactivity.
            </p>
            <p style="font-size: 14px; color: #6B7280;">
              Please log in again to continue.
            </p>
          </div>
        `,
        icon: 'warning',
        confirmButtonText: 'Go to Login',
        confirmButtonColor: '#3B82F6',
        showCancelButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        backdrop: 'rgba(0, 0, 0, 0.9)',
        background: 'rgba(255, 255, 255, 0.95)',
        showClass: {
          popup: 'animate__animated animate__fadeInDown'
        },
        hideClass: {
          popup: 'animate__animated animate__fadeOutUp'
        },
        customClass: {
          popup: 'rounded-[20px] backdrop-blur-sm',
          container: 'backdrop-blur-sm',
          confirmButton: 'rounded-lg px-6 py-3 font-semibold'
        },
        willOpen: () => {
          document.body.style.overflow = 'hidden';
        },
        willClose: () => {
          document.body.style.overflow = 'auto';
        }
      }).then(() => {
        handleLogout();
      });
    }, 100);
  };

  // Check token expiration (for JWT expiry) - renamed function
  const checkJWTTokenExpiry = () => {
    const token = localStorage.getItem('token');
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        const timeLeft = expiresAt - now;
        
        // If token is already expired, show expired modal
        if (timeLeft <= 0 && !hasShownExpiredModalRef.current) {
          handleSessionExpired();
        }
      } catch (error) {
        console.error('Error checking token:', error);
        if (!hasShownExpiredModalRef.current) {
          handleSessionExpired();
        }
      }
    }
  };

  // Handle session expired (JWT expired)
  const handleSessionExpired = () => {
    if (hasShownExpiredModalRef.current || !isClient) return;
    hasShownExpiredModalRef.current = true;

    // Clear all timeouts
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    if (tokenCheckIntervalRef.current) clearInterval(tokenCheckIntervalRef.current);

    setTimeout(() => {
      if (Swal.isVisible()) {
        Swal.close();
      }

      setTimeout(() => {
        Swal.fire({
          title: '<strong style="font-size: 24px;">Session Expired</strong>',
          html: `
            <div style="text-align: center; padding: 20px;">
              <div style="font-size: 48px; color: #EF4444; margin-bottom: 20px;">
                🔒
              </div>
              <p style="font-size: 18px; color: #374151; margin-bottom: 10px;">
                Your session has expired.
              </p>
              <p style="font-size: 14px; color: #6B7280;">
                Please log in again to continue
              </p>
            </div>
          `,
          icon: 'warning',
          confirmButtonText: 'Go to Login',
          confirmButtonColor: '#3B82F6',
          showCancelButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          backdrop: 'rgba(0, 0, 0, 0.9)',
          background: 'rgba(255, 255, 255, 0.95)',
          showClass: {
            popup: 'animate__animated animate__fadeInDown'
          },
          hideClass: {
            popup: 'animate__animated animate__fadeOutUp'
          },
          customClass: {
            popup: 'rounded-[20px] backdrop-blur-sm',
            container: 'backdrop-blur-sm',
            confirmButton: 'rounded-lg px-6 py-3 font-semibold'
          },
          willOpen: () => {
            document.body.style.overflow = 'hidden';
          },
          willClose: () => {
            document.body.style.overflow = 'auto';
          }
        }).then(() => {
          handleLogout();
        });
      }, 100);
    }, 0);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      router.push('/login?expired=true');
    }
  };

  // Setup event listeners for user activity
  useEffect(() => {
    if (!isClient) return;

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    const handleUserActivity = () => {
      resetIdleTimer();
    };

    // Add event listeners
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity);
    });

    // Initialize idle timer
    resetIdleTimer();

    return () => {
      // Cleanup event listeners
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity);
      });

      // Clear timeouts
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (tokenCheckIntervalRef.current) clearInterval(tokenCheckIntervalRef.current);
    };
  }, [isClient, resetIdleTimer]);

  // Check token expiration every 30 seconds - using renamed function
  useEffect(() => {
    if (!isClient) return;

    tokenCheckIntervalRef.current = setInterval(checkJWTTokenExpiry, 30000);
    
    return () => {
      if (tokenCheckIntervalRef.current) {
        clearInterval(tokenCheckIntervalRef.current);
      }
    };
  }, [isClient]);

  // Ensure we're on the client
  useEffect(() => {
    setIsClient(true);
  }, []);

  return null;
};

export default IdleTimeoutModal;