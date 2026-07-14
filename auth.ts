import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./lib/prisma";
import type { NextRequest } from "next/server";
import {
  getApprovedCustomerProfile,
  isApprovedCustomerEmail,
} from "./lib/approved-customer";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(normalizeEmail(email));
}

async function isEmailAllowed(email?: string | null) {
  if (!email) return false;
  return (await isApprovedCustomerEmail(email)) || isAdminEmail(email);
}

const FAILED_LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_LOCK_MINUTES = 15;

function getRequestIp(request?: Request | NextRequest | null) {
  const forwardedFor = request?.headers.get("x-forwarded-for");
  const realIp = request?.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return realIp || null;
}

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function isLoginTemporarilyBlocked(email: string, ipAddress: string | null) {
  const since = minutesAgo(LOGIN_WINDOW_MINUTES);

  const emailFailures = await prisma.loginAttempt.count({
    where: {
      email,
      success: false,
      createdAt: {
        gte: since,
      },
    },
  });

  const ipFailures = ipAddress
    ? await prisma.loginAttempt.count({
        where: {
          ipAddress,
          success: false,
          createdAt: {
            gte: since,
          },
        },
      })
    : 0;

  return emailFailures >= FAILED_LOGIN_LIMIT || ipFailures >= FAILED_LOGIN_LIMIT;
}

async function recordLoginAttempt(args: {
  email: string;
  ipAddress: string | null;
  success: boolean;
}) {
  await prisma.loginAttempt.create({
    data: {
      email: args.email,
      ipAddress: args.ipAddress,
      success: args.success,
    },
  });
}

async function clearFailedLoginAttempts(email: string) {
  await prisma.loginAttempt.deleteMany({
    where: {
      email,
      success: false,
    },
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },
      async authorize(credentials, request) {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");
        const ipAddress = getRequestIp(request);

        if (!email || !password) {
          return null;
        }
        if (await isLoginTemporarilyBlocked(email, ipAddress)) {
  return null;
}

        if (!(await isEmailAllowed(email))) {
  await recordLoginAttempt({ email, ipAddress, success: false });
  return null;
}

        const rawUser = (await prisma.user.findUnique({
          where: { email },
        })) as Record<string, unknown> | null;

        if (!rawUser) {
  await recordLoginAttempt({ email, ipAddress, success: false });
  return null;
}

        const passwordHash =
          typeof rawUser.passwordHash === "string"
            ? rawUser.passwordHash
            : typeof rawUser.password === "string"
            ? rawUser.password
            : null;

        if (!passwordHash) {
  await recordLoginAttempt({ email, ipAddress, success: false });
  return null;
}

        const passwordMatches = await compare(password, passwordHash);

        if (!passwordMatches) {
  await recordLoginAttempt({ email, ipAddress, success: false });
  return null;
}

      await recordLoginAttempt({ email, ipAddress, success: true });
await clearFailedLoginAttempts(email);

        const approvedCustomer = await getApprovedCustomerProfile(email);

        const userId = typeof rawUser.id === "string" ? rawUser.id : email;

        const userEmail = approvedCustomer?.email
          ? approvedCustomer.email
          : typeof rawUser.email === "string"
          ? normalizeEmail(rawUser.email)
          : email;

        const userName = approvedCustomer?.name
          ? approvedCustomer.name
          : typeof rawUser.name === "string" && rawUser.name.trim().length > 0
          ? rawUser.name
          : userEmail.split("@")[0];

        return {
          id: userId,
          email: userEmail,
          name: userName,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return await isEmailAllowed(user.email);
    },
    async jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email;
      }

      if (user?.name) {
        token.name = user.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && typeof token.email === "string") {
        session.user.email = token.email;
      }

      if (session.user && typeof token.name === "string") {
        session.user.name = token.name;
      }

      return session;
    },
  },
});