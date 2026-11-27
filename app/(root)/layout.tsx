import { ReactNode } from 'react';

import { IdentityProvider } from '@/providers/IdentityProvider';
import StreamVideoProvider from '@/providers/StreamClientProvider';
import { AccountRequiredDialog, WelcomeGate } from '@/components/auth/AccessGates';

const RootLayout = ({ children }: Readonly<{ children: ReactNode }>) => {
  return (
    <main className="w-full h-full min-h-0 overflow-hidden">
      <IdentityProvider>
        <StreamVideoProvider>{children}</StreamVideoProvider>
        <WelcomeGate />
        <AccountRequiredDialog />
      </IdentityProvider>
    </main>
  );
};

export default RootLayout;
