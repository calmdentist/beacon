'use client';

import { NeonAuthUIProvider } from '@neondatabase/auth/react';

import { authClient } from '@/lib/auth-client';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const compatibleAuthClient = authClient as unknown as React.ComponentProps<
    typeof NeonAuthUIProvider
  >['authClient'];

  return (
    <NeonAuthUIProvider
      authClient={compatibleAuthClient}
      emailOTP
      social={{
        providers: ['google']
      }}
      redirectTo="/dashboard"
    >
      {children}
    </NeonAuthUIProvider>
  );
}
