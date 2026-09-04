import { prisma } from "./prisma";

const SETTING_ID = 1;

export async function isInstalled(): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { id: SETTING_ID } });
  return setting?.installed ?? false;
}

export async function markInstalled(): Promise<void> {
  await prisma.setting.upsert({
    where: { id: SETTING_ID },
    update: { installed: true },
    create: { id: SETTING_ID, installed: true },
  });
}
