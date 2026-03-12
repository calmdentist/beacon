import { redirect } from 'next/navigation';

import { auth } from '@/auth';

export default async function LoginPage() {
  const { data: session } = await auth.getSession();
  if (session?.user) {
    redirect('/dashboard');
  }

  redirect('/auth/sign-in');
}
