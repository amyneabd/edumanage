// One-off script: creates a linked Teacher + Pupil + Parent trio for manual
// testing (real Supabase Auth users, all statuses set to ACTIVE and the
// pupil already assigned to the teacher's class + the parent link already
// approved, so no manual admin/teacher approval steps are needed).
//
// Run with: npx tsx prisma/seed-test-accounts.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { supabaseAdmin } from "../src/utils/supabaseAdmin.js";
import { generateTeacherCode, generateParentCode } from "../src/utils/teacherCode.js";

const prisma = new PrismaClient();

const PASSWORD = "Test1234!";

const TEACHER_EMAIL = "test.teacher@bachandi.app";
const PUPIL_EMAIL = "test.pupil@bachandi.app";
const PARENT_EMAIL = "test.parent@bachandi.app";

async function createSupabaseUser(email: string): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Failed to create Supabase user ${email}: ${error?.message}`);
  return data.user.id;
}

async function main() {
  const existing = await prisma.user.findFirst({
    where: { email: { in: [TEACHER_EMAIL, PUPIL_EMAIL, PARENT_EMAIL] } },
  });
  if (existing) {
    console.log("Test accounts already exist. Delete them first (Supabase Auth + DB) to re-seed.");
    return;
  }

  // 1. Teacher
  let teacherCode = generateTeacherCode();
  while (await prisma.teacherProfile.findUnique({ where: { teacherCode } })) {
    teacherCode = generateTeacherCode();
  }
  const teacherSupabaseId = await createSupabaseUser(TEACHER_EMAIL);
  const teacher = await prisma.user.create({
    data: {
      email: TEACHER_EMAIL,
      supabaseId: teacherSupabaseId,
      name: "Test Teacher",
      role: "TEACHER",
      status: "ACTIVE",
      teacherProfile: { create: { teacherCode } },
    },
    include: { teacherProfile: true },
  });

  // 2. A class for the teacher, so the pupil has somewhere to belong
  const klass = await prisma.class.create({
    data: {
      teacherId: teacher.id,
      name: "Classe Test",
      type: "MATH",
      monthlyFee: 100,
    },
  });

  // 3. Pupil, pre-assigned to the class
  let parentCode = generateParentCode();
  while (await prisma.pupilProfile.findUnique({ where: { parentCode } })) {
    parentCode = generateParentCode();
  }
  const pupilSupabaseId = await createSupabaseUser(PUPIL_EMAIL);
  const pupil = await prisma.user.create({
    data: {
      email: PUPIL_EMAIL,
      supabaseId: pupilSupabaseId,
      name: "Test Pupil",
      role: "PUPIL",
      status: "ACTIVE",
      pupilProfile: {
        create: {
          requestedType: "MATH",
          teacherId: teacher.id,
          classId: klass.id,
          parentCode,
        },
      },
    },
    include: { pupilProfile: true },
  });

  // 4. Parent, pre-linked to the pupil (approved)
  const parentSupabaseId = await createSupabaseUser(PARENT_EMAIL);
  const parent = await prisma.user.create({
    data: {
      email: PARENT_EMAIL,
      supabaseId: parentSupabaseId,
      name: "Test Parent",
      role: "PARENT",
      status: "ACTIVE",
      parentProfile: { create: {} },
    },
    include: { parentProfile: true },
  });

  await prisma.parentLink.create({
    data: {
      parentId: parent.id,
      pupilId: pupil.id,
      teacherId: teacher.id,
      status: "ACTIVE",
      respondedAt: new Date(),
    },
  });

  console.log("Seeded linked test accounts:");
  console.log(`  Teacher: ${TEACHER_EMAIL} / ${PASSWORD}  (teacherCode: ${teacherCode})`);
  console.log(`  Pupil:   ${PUPIL_EMAIL} / ${PASSWORD}  (parentCode: ${parentCode}, class: ${klass.name})`);
  console.log(`  Parent:  ${PARENT_EMAIL} / ${PASSWORD}  (linked to Test Pupil, status ACTIVE)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
