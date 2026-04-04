import { useEffect } from 'react';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    // Standard check to be safe in native environments
    if (typeof window !== 'undefined' && (window as any).frameworkReady) {
      (window as any).frameworkReady();
    }
  }, []);
}
