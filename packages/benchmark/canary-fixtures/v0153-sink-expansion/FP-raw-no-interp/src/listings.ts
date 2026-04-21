export async function listAllUsers(knex: any) {
  return await knex.raw(`SELECT * FROM users`);
}
