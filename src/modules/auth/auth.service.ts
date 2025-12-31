import bcrypt from "bcrypt";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import jwt, { type SignOptions } from "jsonwebtoken";


type UserShort = {
  id: string;
  username: string;
  fullName: string;
  userType: "student" | "teacher";
};

function toUserShort(u: any): UserShort {
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName ?? "",
    userType: u.userType,
  };
}

function signAccessToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as unknown as SignOptions["expiresIn"],
  };

  return jwt.sign({ sub: userId }, env.JWT_SECRET, options);
}

export const authService = {
  async register(input: {
    username: string;
    password: string;
    email: string;
    phone: string;
    userType: "student" | "teacher";
    code: string;
  }) {
    const existsUsername = await prisma.user.findUnique({ where: { username: input.username } });
    if (existsUsername) throw new AppError(400, "AUTH_002", "Username đã tồn tại");

    const existsEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existsEmail) throw new AppError(400, "AUTH_003", "Email đã tồn tại");

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        phone: input.phone,
        userType: input.userType,
        code: input.code,
        passwordHash,
        fullName: "",
      },
    });

    return { accessToken: signAccessToken(user.id), user: toUserShort(user) };
  },

  async login(input: { username: string; password: string }) {
    const user = await prisma.user.findUnique({ where: { username: input.username } });
    if (!user) throw new AppError(401, "AUTH_001", "Thông tin đăng nhập không chính xác"); 

    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) throw new AppError(401, "AUTH_001", "Thông tin đăng nhập không chính xác"); 

    return { accessToken: signAccessToken(user.id), user: toUserShort(user) };
  },

  async forgotPassword(input: { email: string }) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) throw new AppError(400, "AUTH_004", "Email không hợp lệ hoặc không tồn tại");

    return { message: "Vui lòng kiểm tra email để đặt lại mật khẩu" };
  },
};
