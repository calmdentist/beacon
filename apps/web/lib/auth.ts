import { auth } from '@/auth';
import { getDb, schema } from '@beacon/db';
import { eq } from 'drizzle-orm';

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function getCurrentUserId(): Promise<string> {
  const { data: session } = await auth.getSession();
  const user = session?.user;
  const userId = user?.id;
  const email = user?.email;

  if (!userId || !email) {
    throw new UnauthorizedError();
  }

  await ensureLocalUserRecord({
    id: userId,
    email,
    name: user.name ?? null,
    image: user.image ?? null,
    emailVerified: user.emailVerified
  });

  return userId;
}

type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
};

async function ensureLocalUserRecord(user: SessionUser): Promise<void> {
  const db = getDb();

  const emailVerifiedAt = user.emailVerified ? new Date() : null;

  const [existing] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
      image: schema.users.image,
      emailVerified: schema.users.emailVerified
    })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (!existing) {
    await db.insert(schema.users).values({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: emailVerifiedAt
    });
    return;
  }

  const shouldUpdate =
    existing.email !== user.email ||
    (existing.name ?? null) !== user.name ||
    (existing.image ?? null) !== user.image ||
    Boolean(existing.emailVerified) !== user.emailVerified;

  if (!shouldUpdate) {
    return;
  }

  await db
    .update(schema.users)
    .set({
      email: user.email,
      name: user.name,
      image: user.image,
      emailVerified: emailVerifiedAt,
      updatedAt: new Date()
    })
    .where(eq(schema.users.id, user.id));
}
