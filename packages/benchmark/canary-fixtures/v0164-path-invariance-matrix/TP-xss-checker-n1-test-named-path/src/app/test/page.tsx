// Server Component at N1-class path. Scanner must flag the unsafe-html pattern.
export default function TestPage({ searchParams }: { searchParams: { q: string } }): JSX.Element {
  const userInput = searchParams.q;
  return <div dangerouslySetInnerHTML={{ __html: userInput }} />;
}
