// Server Component at N1-class path. Scanner must flag the record-spread pattern.
export default async function UsersPage(): Promise<JSX.Element> {
  const supabase = (globalThis as any).supabase;
  const { data } = await supabase.from('users').select('*');
  return <UserList data={data} />;
}

function UserList({ data }: { data: unknown }): JSX.Element {
  return <div>{JSON.stringify(data)}</div>;
}
