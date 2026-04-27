import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./lib/prisma";
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

function isEmailAllowed(email?: string | null) {
  if (!email) return false;
  return isApprovedCustomerEmail(email) || isAdminEmail(email);
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
      async authorize(credentials) {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          return null;
        }

        if (!isEmailAllowed(email)) {
          return null;
        }

        const rawUser = (await prisma.user.findUnique({
          where: { email },
        })) as Record<string, unknown> | null;

        if (!rawUser) {
          return null;
        }

        const passwordHash =
          typeof rawUser.passwordHash === "string"
            ? rawUser.passwordHash
            : typeof rawUser.password === "string"
            ? rawUser.password
            : null;

        if (!passwordHash) {
          return null;
        }

        const passwordMatches = await compare(password, passwordHash);

        if (!passwordMatches) {
          return null;
        }

        const approvedCustomer = getApprovedCustomerProfile(email);

        const userId =
          typeof rawUser.id === "string" ? rawUser.id : email;

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
      return isEmailAllowed(user.email);
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