export async function POST() {
  await runReminderJob();
  return Response.json({ done: true });
}
