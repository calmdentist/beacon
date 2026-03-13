import { AuthView, type AuthViewPath } from '@neondatabase/auth/react';

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  return (
    <main className="container pb-20">
      <section className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="chip mb-3">Welcome</p>
          <h1 className="text-4xl font-semibold leading-tight md:text-5xl">Sign in to Vibecast</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-muted)] md:text-base">
            Continue with Google or use email OTP to get back to your inquiry workspace.
          </p>
        </div>
        <div className="card p-4 md:p-7">
          <AuthView path={path as AuthViewPath} />
        </div>
      </section>
    </main>
  );
}
