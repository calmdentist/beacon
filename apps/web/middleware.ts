import { auth } from '@/auth';

export default auth.middleware({
  loginUrl: '/login'
});

export const config = {
  matcher: [
    '/admin/:path*',
    '/beacons/:path*',
    '/dashboard/:path*',
    '/intros/:path*',
    '/matches/:path*',
    '/onboarding/:path*',
    '/settings/:path*'
  ]
};
