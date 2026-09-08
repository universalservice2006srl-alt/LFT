import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { profiles } from "./schema";
import { hashPassword, generatePassword, validatePassword } from "@/lib/password";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const fullName = (process.env.ADMIN_NAME ?? "Fleet Administrator").trim();
  const password = process.env.ADMIN_PASSWORD ?? generatePassword();

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!fullName) throw new Error("ADMIN_NAME is required");
  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(`ADMIN_PASSWORD: ${passwordError}`);

  const existing = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);
  if (existing.length > 0) {
    throw new Error(`A profile already exists for ${email}; no changes were made`);
  }

  const [admin] = await db
    .insert(profiles)
    .values({
      email,
      fullName,
      role: "super_admin",
      passwordHash: hashPassword(password),
      passwordPlain: password,
      isActive: true,
    })
    .returning({ id: profiles.id, email: profiles.email });

  console.log(`Created admin ${admin.email} (${admin.id})`);
  console.log(`Password: ${password}`);
  console.log("Store this password securely. It is shown once by this command.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });