import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import type { User } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

type UpdateInput = {
  fullName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: "male" | "female";
  password?: string;
};

type UploadContext = {
  files?: unknown;
  file?: unknown;
  baseUrl: string;
};

type AvatarFile = {
  fieldname?: string;
  originalname?: string;
  buffer?: Buffer;
  path?: string;
};

function toUserProfile(user: User) {
  const profile: {
    id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    userType: User["userType"];
    code: string;
    gender?: User["gender"];
    dateOfBirth?: string | null;
    avatarUrl?: string | null;
  } = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    userType: user.userType,
    code: user.code,
  };

  if (user.gender) profile.gender = user.gender;
  if (user.dateOfBirth) profile.dateOfBirth = user.dateOfBirth;
  if (user.avatarUrl) profile.avatarUrl = user.avatarUrl;

  return profile;
}

// Normalize multer-style file shapes from different parsers.
function pickAvatarFile(files: unknown, file: unknown): AvatarFile | undefined {
  const direct = file as AvatarFile | undefined;
  if (direct?.fieldname === "avatar") return direct;

  const fileList = files as AvatarFile[] | undefined;
  if (Array.isArray(fileList)) {
    return fileList.find((f) => f.fieldname === "avatar");
  }

  const map = files as Record<string, AvatarFile | AvatarFile[] | undefined> | undefined;
  const fromMap = map?.avatar;
  if (Array.isArray(fromMap)) return fromMap[0];
  return fromMap;
}

async function saveAvatar(userId: string, avatar: AvatarFile, baseUrl: string): Promise<string> {
  const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = path.extname(avatar.originalname ?? "");
  const filename = ext ? `${userId}${ext}` : `${userId}.bin`;
  const destPath = path.join(uploadsDir, filename);

  if (avatar.buffer) {
    await fs.writeFile(destPath, avatar.buffer);
  } else if (avatar.path) {
    await fs.copyFile(avatar.path, destPath);
  } else {
    throw new AppError(400, "USER_002", "Invalid avatar file");
  }

  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${cleanBaseUrl}/uploads/avatars/${filename}`;
}

export const userService = {
  async getProfile(userId?: string) {
    if (!userId) throw new AppError(401, "AUTH_001", "Unauthorized");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(401, "AUTH_001", "Unauthorized");

    return toUserProfile(user);
  },

  async updateProfile(userId: string | undefined, input: UpdateInput, ctx: UploadContext) {
    if (!userId) throw new AppError(401, "AUTH_001", "Unauthorized");
    if (!input?.password) throw new AppError(400, "USER_003", "Password is required");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(401, "AUTH_001", "Unauthorized");

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new AppError(400, "USER_001", "Invalid password");

    const data: {
      fullName?: string;
      phone?: string;
      dateOfBirth?: string;
      gender?: User["gender"];
      avatarUrl?: string;
    } = {};

    if (input.fullName !== undefined) data.fullName = input.fullName;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.dateOfBirth !== undefined) data.dateOfBirth = input.dateOfBirth;
    if (input.gender !== undefined) data.gender = input.gender as User["gender"];

    const avatar = pickAvatarFile(ctx.files, ctx.file);
    if (avatar) {
      data.avatarUrl = await saveAvatar(user.id, avatar, ctx.baseUrl);
    }

    const updated =
      Object.keys(data).length > 0
        ? await prisma.user.update({ where: { id: user.id }, data })
        : user;

    return toUserProfile(updated);
  },
};
