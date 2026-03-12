import { AuthView, type AuthViewPath } from '@neondatabase/auth/react';

export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  return (
    <main className="container pb-16">
      <AuthView path={path as AuthViewPath} />
    </main>
  );
}
