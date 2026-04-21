export async function dynamicSelect(table: string, id: string, knex: any) {
  return await knex.raw(`SELECT * FROM ${table} WHERE id = '${id}'`);
}
