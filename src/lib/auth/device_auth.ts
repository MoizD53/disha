import { prisma } from "@/lib/prisma";
import { randomBytes, createHash } from "crypto";

export async function generateDeviceCredential(deviceId: string) {
  // Generate a cryptographically random token
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Invalidate any existing active credentials for this device
  await prisma.deviceCredential.updateMany({
    where: { deviceId, isActive: true },
    data: { isActive: false },
  });

  // Store the new hashed credential
  await prisma.deviceCredential.create({
    data: {
      deviceId,
      tokenHash,
      isActive: true,
    },
  });

  // Return the raw token (only shown once)
  return token;
}

export async function verifyDeviceToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  
  const credential = await prisma.deviceCredential.findUnique({
    where: { tokenHash },
    include: {
      device: {
        include: { personnel: true },
      },
    },
  });

  if (!credential || !credential.isActive) {
    return null;
  }

  // Device and Personnel must be active
  if (credential.device.status !== "ACTIVE" || !credential.device.personnel.active) {
    return null;
  }

  // Update last seen
  await prisma.deviceCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() },
  });

  return credential.device;
}
