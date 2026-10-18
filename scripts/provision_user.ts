import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { UserRole, UserStatus } from "../generated/prisma/enums";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { Writable } from "node:stream";

interface ProvisionOptions {
  username?: string;
  password?: string;
  role?: string;
  personnelCode?: string;
  name?: string;
  designation?: string;
  unit?: string;
  phone?: string;
}

async function promptPassword(prompt: string): Promise<string> {
  if (!input.isTTY) {
    const rl = readline.createInterface({ input, output });
    try {
      return (await rl.question(prompt)).trim();
    } finally {
      rl.close();
    }
  }

  let muted = false;
  const mutableOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        output.write(chunk, encoding);
      }
      callback();
    }
  });

  const rl = readline.createInterface({
    input,
    output: mutableOutput,
    terminal: true,
  });

  output.write(prompt);
  muted = true;
  try {
    const answer = await rl.question("");
    return answer.trim();
  } finally {
    muted = false;
    output.write("\n");
    rl.close();
  }
}

async function promptInteractive(): Promise<ProvisionOptions> {
  console.log("\n--- DISHA Safe Personnel Provisioning ---");
  const rl = readline.createInterface({ input, output });
  let username = "";
  let role = "";
  try {
    username = await rl.question("Enter Username (e.g., admin_sp or officer_101): ");
    console.log("Available Roles:", Object.values(UserRole).join(", "));
    role = await rl.question("Enter Role (SP, DYSP, CONTROL_ROOM_OFFICER, FIELD_PERSONNEL): ");
  } finally {
    rl.close();
  }

  const password = await promptPassword("Enter Password (min 8 chars, input hidden): ");

  let personnelCode: string | undefined;
  let name: string | undefined;
  let designation: string | undefined;
  let unit: string | undefined;
  let phone: string | undefined;

  if (role.trim().toUpperCase() === UserRole.FIELD_PERSONNEL) {
    const rl2 = readline.createInterface({ input, output });
    try {
      personnelCode = await rl2.question("Enter Personnel Code / Badge ID (e.g., POL-101): ");
      name = await rl2.question("Enter Officer Full Name (e.g., Inspector R. Sharma): ");
      designation = await rl2.question("Enter Designation (optional, e.g., Sub-Inspector): ");
      unit = await rl2.question("Enter Unit / Station (optional, e.g., Central Zone): ");
      phone = await rl2.question("Enter Phone Number (optional): ");
    } finally {
      rl2.close();
    }
  }

  return {
    username: username.trim(),
    password: password.trim(),
    role: role.trim().toUpperCase(),
    personnelCode: personnelCode?.trim(),
    name: name?.trim(),
    designation: designation?.trim() || undefined,
    unit: unit?.trim() || undefined,
    phone: phone?.trim() || undefined,
  };
}

async function main() {
  try {
    // 1. Collect inputs from environment variables, CLI args, or interactive prompts
    const envOptions: ProvisionOptions = {
      username: process.env.PROVISION_USERNAME,
      password: process.env.PROVISION_PASSWORD,
      role: process.env.PROVISION_ROLE?.toUpperCase(),
      personnelCode: process.env.PERSONNEL_CODE,
      name: process.env.PERSONNEL_NAME,
      designation: process.env.PERSONNEL_DESIGNATION,
      unit: process.env.PERSONNEL_UNIT,
      phone: process.env.PERSONNEL_PHONE,
    };

    const [argUser, argPass, argRole, argCode, argName, argDesig, argUnit, argPhone] = process.argv.slice(2);

    let opts: ProvisionOptions = {
      username: argUser || envOptions.username,
      password: argPass || envOptions.password,
      role: (argRole || envOptions.role)?.toUpperCase(),
      personnelCode: argCode || envOptions.personnelCode,
      name: argName || envOptions.name,
      designation: argDesig || envOptions.designation,
      unit: argUnit || envOptions.unit,
      phone: argPhone || envOptions.phone,
    };

    // If still missing essential fields and stdin is TTY, prompt interactively
    if ((!opts.username || !opts.password || !opts.role) && process.stdin.isTTY) {
      const interactive = await promptInteractive();
      opts = { ...opts, ...interactive };
    }

    const { username, password, role } = opts;

    if (!username || !password || !role) {
      console.error("\n[ERROR] Missing required credentials.");
      console.error("Usage via CLI args: npx tsx scripts/provision_user.ts <username> <password> <role> [personnelCode] [name] [designation] [unit] [phone]");
      console.error("Usage via Env Vars: PROVISION_USERNAME=... PROVISION_PASSWORD=... PROVISION_ROLE=... npx tsx scripts/provision_user.ts");
      console.error("Roles:", Object.values(UserRole).join(", "));
      process.exit(1);
    }

    if (!Object.values(UserRole).includes(role as UserRole)) {
      console.error(`\n[ERROR] Invalid role: "${role}". Must be one of: ${Object.values(UserRole).join(", ")}`);
      process.exit(1);
    }

    if (password.length < 8) {
      console.error("\n[ERROR] Password must be at least 8 characters long for security compliance.");
      process.exit(1);
    }

    const userRole = role as UserRole;
    const passwordHash = await hashPassword(password);

    // If FIELD_PERSONNEL, ensure personnel fields exist
    let personnelCode = opts.personnelCode || (userRole === UserRole.FIELD_PERSONNEL ? `EMP-${username}` : undefined);
    let personnelName = opts.name || (userRole === UserRole.FIELD_PERSONNEL ? username : undefined);

    // Check if user already exists (Idempotent handling)
    const existingUser = await prisma.user.findUnique({
      where: { username },
      include: { personnel: true },
    });

    if (existingUser) {
      console.log(`[INFO] User "${username}" already exists. Updating credentials and status...`);

      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          role: userRole,
          status: UserStatus.ACTIVE,
        },
      });

      if (userRole === UserRole.FIELD_PERSONNEL || personnelCode) {
        if (existingUser.personnel) {
          await prisma.personnel.update({
            where: { id: existingUser.personnel.id },
            data: {
              personnelCode: personnelCode || existingUser.personnel.personnelCode,
              name: personnelName || existingUser.personnel.name,
              designation: opts.designation ?? existingUser.personnel.designation,
              unit: opts.unit ?? existingUser.personnel.unit,
              phone: opts.phone ?? existingUser.personnel.phone,
              active: true,
            },
          });
          console.log(`[SUCCESS] Linked personnel profile "${existingUser.personnel.personnelCode}" updated and active.`);
        } else {
          const newPersonnel = await prisma.personnel.create({
            data: {
              userId: updatedUser.id,
              personnelCode: personnelCode!,
              name: personnelName || username,
              designation: opts.designation,
              unit: opts.unit,
              phone: opts.phone,
              active: true,
            },
          });
          console.log(`[SUCCESS] Created new linked personnel profile: "${newPersonnel.personnelCode}" (ID: ${newPersonnel.id})`);
        }
      }

      console.log(`[SUCCESS] Account "${username}" (Role: ${userRole}) is ACTIVE and ready.`);
    } else {
      // Create new User
      const newUser = await prisma.user.create({
        data: {
          username,
          passwordHash,
          role: userRole,
          status: UserStatus.ACTIVE,
        },
      });

      console.log(`[SUCCESS] User "${username}" created with Role "${userRole}" (ID: ${newUser.id})`);

      if (userRole === UserRole.FIELD_PERSONNEL || personnelCode) {
        const personnel = await prisma.personnel.create({
          data: {
            userId: newUser.id,
            personnelCode: personnelCode!,
            name: personnelName || username,
            designation: opts.designation,
            unit: opts.unit,
            phone: opts.phone,
            active: true,
          },
        });
        console.log(`[SUCCESS] Linked personnel profile created: "${personnel.personnelCode}" - ${personnel.name} (ID: ${personnel.id})`);
      }
    }
  } catch (err: unknown) {
    if ((err as any)?.code === "P2002") {
      const target = (err as any)?.meta?.target || "unique field";
      console.error(`[ERROR] Provisioning failed: Unique constraint conflict on ${Array.isArray(target) ? target.join(", ") : target}.`);
    } else {
      console.error("[ERROR] Provisioning failed:", (err as Error).message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
