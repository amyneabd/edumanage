// One-off dev utility: creates a linked teacher/pupil/parent trio of ACTIVE,
// email-verified accounts for manual end-to-end testing. Safe to re-run:
// skips creation and reports existing accounts if the emails are already taken.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const PASSWORD = "TestPass123!";

function teacherCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}
function parentCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const now = new Date();

  // --- Teacher ---
  const teacherEmail = "test.teacher@bachandi.app";
  let teacher = await prisma.user.findUnique({ where: { email: teacherEmail } });
  if (!teacher) {
    let code = teacherCode();
    while (await prisma.teacherProfile.findUnique({ where: { teacherCode: code } })) code = teacherCode();

    teacher = await prisma.user.create({
      data: {
        email: teacherEmail,
        passwordHash,
        name: "Test Teacher",
        role: "TEACHER",
        status: "ACTIVE",
        emailVerifiedAt: now,
        teacherProfile: { create: { teacherCode: code } },
      },
      include: { teacherProfile: true },
    });
    console.log("Created teacher:", teacherEmail);
  } else {
    console.log("Teacher already exists:", teacherEmail);
  }

  // --- Class owned by the teacher (with a weekly schedule slot) ---
  let klass = await prisma.class.findFirst({ where: { teacherId: teacher.id, name: "Test Class" } });
  if (!klass) {
    klass = await prisma.class.create({
      data: {
        teacherId: teacher.id,
        name: "Test Class",
        type: "MATH",
        monthlyFee: 150,
        scheduleSlots: {
          create: [{ dayOfWeek: 1, startTime: "16:00", endTime: "17:00" }],
        },
      },
    });
    console.log("Created class: Test Class (Math, Mon 16:00-17:00)");
  } else {
    console.log("Class already exists: Test Class");
  }

  // --- Pupil, enrolled directly in the class ---
  const pupilEmail = "test.pupil@bachandi.app";
  let pupil = await prisma.user.findUnique({ where: { email: pupilEmail } });
  if (!pupil) {
    let pCode = parentCode();
    while (await prisma.pupilProfile.findUnique({ where: { parentCode: pCode } })) pCode = parentCode();

    pupil = await prisma.user.create({
      data: {
        email: pupilEmail,
        passwordHash,
        name: "Test Pupil",
        role: "PUPIL",
        status: "ACTIVE",
        emailVerifiedAt: now,
        pupilProfile: {
          create: {
            requestedType: "MATH",
            teacherId: teacher.id,
            classId: klass.id,
            parentCode: pCode,
            phone: "+21600000001",
            parentPhone: "+21600000002",
          },
        },
      },
      include: { pupilProfile: true },
    });
    console.log("Created pupil:", pupilEmail);
  } else {
    console.log("Pupil already exists:", pupilEmail);
  }

  // --- A current-period payment record so the ledger has something to show ---
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  await prisma.paymentRecord.upsert({
    where: { pupilId_period: { pupilId: pupil.id, period } },
    create: {
      pupilId: pupil.id,
      period,
      status: "UNPAID",
      amountDue: 150,
      amountPaid: 0,
      dueDate: new Date(now.getFullYear(), now.getMonth(), 28),
    },
    update: {},
  });
  console.log("Ensured payment record for period", period);

  // --- Parent, linked to the pupil and pre-approved ---
  const parentEmail = "test.parent@bachandi.app";
  let parent = await prisma.user.findUnique({ where: { email: parentEmail } });
  if (!parent) {
    parent = await prisma.user.create({
      data: {
        email: parentEmail,
        passwordHash,
        name: "Test Parent",
        role: "PARENT",
        status: "ACTIVE",
        emailVerifiedAt: now,
        parentProfile: { create: {} },
      },
      include: { parentProfile: true },
    });
    console.log("Created parent:", parentEmail);
  } else {
    console.log("Parent already exists:", parentEmail);
  }

  const existingLink = await prisma.parentLink.findUnique({
    where: { parentId_pupilId: { parentId: parent.id, pupilId: pupil.id } },
  }).catch(() => null);
  if (!existingLink) {
    await prisma.parentLink.create({
      data: {
        parentId: parent.id,
        pupilId: pupil.id,
        teacherId: teacher.id,
        status: "ACTIVE",
        respondedAt: now,
      },
    });
    console.log("Linked parent to pupil (ACTIVE)");
  } else if (existingLink.status !== "ACTIVE") {
    await prisma.parentLink.update({ where: { id: existingLink.id }, data: { status: "ACTIVE", respondedAt: now } });
    console.log("Updated existing parent link to ACTIVE");
  } else {
    console.log("Parent link already ACTIVE");
  }

  console.log("\n=== Test accounts ready (all password: " + PASSWORD + ") ===");
  console.log("Teacher: ", teacherEmail);
  console.log("Pupil:   ", pupilEmail);
  console.log("Parent:  ", parentEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
