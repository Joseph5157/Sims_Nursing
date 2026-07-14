import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useToast } from './ui/Toast';
import { APP_SHORT_NAME } from '../utils/branding';

export default function PWAUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  const toast = useToast();

  useEffect(() => {
    if (!needRefresh) return;
    toast({
      message: `Update available — tap to refresh ${APP_SHORT_NAME}.`,
      type: 'info',
      persistent: true,
      onClick: () => updateServiceWorker(true),
    });
  }, [needRefresh, updateServiceWorker, toast]);

  return null;
}
