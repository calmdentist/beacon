import { redirect } from 'next/navigation';

import { auth, signIn } from '@/auth';

async function signInWithGoogle() {
  'use server';
  await signIn('google', { redirectTo: '/dashboard' });
}

async function signInWithMagicLink(formData: FormData) {
  'use server';

  const email = formData.get('email');
  if (typeof email !== 'string' || email.trim().length === 0) {
    throw new Error('A valid email is required.');
  }

  await signIn('nodemailer', {
    email: email.trim(),
    redirectTo: '/dashboard'
  });
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <main className="container pb-16">
      <h1 className="mb-2 text-3xl font-semibold">Login</h1>
      <p className="mb-6 text-sm text-neutral-700">Sign in with Google or request a magic link by email.</p>
      <section className="card max-w-xl space-y-6 p-6">
        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Continue with Google
          </button>
        </form>
        <form action={signInWithMagicLink} className="space-y-3">
          <label htmlFor="email" className="block text-sm font-medium text-neutral-800">
            Email for magic link
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="w-full rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Send magic link
          </button>
        </form>
      </section>
    </main>
  );
}
