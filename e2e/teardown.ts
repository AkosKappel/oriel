import postgres from 'postgres'

// Deletes the accounts the tests created, and the shared spaces only they were in (shared spaces
// have no owner column, so they do not go with their users).
export default async function teardown() {
  if (!process.env.DATABASE_URL) process.loadEnvFile()
  const sql = postgres(process.env.DATABASE_URL as string, {
    max: 1,
    onnotice: () => {},
  })
  await sql`
    DELETE FROM space WHERE personal_owner_id IS NULL AND id IN (
      SELECT space_id FROM space_member m JOIN "user" u ON u.id = m.user_id
      GROUP BY space_id HAVING bool_and(u.email LIKE 'e2e-%@example.com'))`
  await sql`DELETE FROM "user" WHERE email LIKE 'e2e-%@example.com'`
  await sql.end()
}
