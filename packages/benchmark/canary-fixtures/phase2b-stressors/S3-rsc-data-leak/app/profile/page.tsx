import { prisma } from '@/lib/prisma';

// S3 canary — React Server Component passes a full user record
// (including password_hash / resetToken / mfaSecret) to the client
// via prop. Every field is serialised to the client bundle.
// CWE-200 information exposure via RSC.

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: searchParams.id },
  });

  if (!user) {
    return <div>not found</div>;
  }

  return <UserCard user={user} />;
}

function UserCard({ user }: { user: any }) {
  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
