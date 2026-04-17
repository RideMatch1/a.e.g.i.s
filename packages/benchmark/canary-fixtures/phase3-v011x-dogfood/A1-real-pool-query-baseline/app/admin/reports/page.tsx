import { pool } from '@/lib/db';

export default async function ReportsPage() {
  const { rows } = await pool.query('SELECT * FROM reports ORDER BY id DESC');
  return <pre>{JSON.stringify(rows, null, 2)}</pre>;
}
