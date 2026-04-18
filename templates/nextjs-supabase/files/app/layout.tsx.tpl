export const metadata = {
  title: '{{PROJECT_NAME}}',
  description: 'AEGIS-scaffolded Next.js + Supabase project',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
