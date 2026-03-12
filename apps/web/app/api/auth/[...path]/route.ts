import { auth } from '@/auth';

export const { GET, POST, PUT, PATCH, DELETE } = auth.handler();
