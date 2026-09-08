import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { supabaseAdmin } from "../src/utils/supabaseAdmin.js";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin account already exists: ${email}`);
    return;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Failed to create Supabase admin user: ${error?.message}`);

  await prisma.user.create({
    data: { email, supabaseId: data.user.id, name: "Admin", role: "ADMIN", status: "ACTIVE" },
  });
  console.log(`Seeded admin account: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
