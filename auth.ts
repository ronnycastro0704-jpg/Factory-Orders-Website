import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./lib/prisma";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getAllowedSignInEmails() {
  return (process.env.ALLOWED_SIGNUP_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function isEmailAllowed(email?: string | null) {
  if (!email) return false;

  const allowedEmails = getAllowedSignInEmails();

  if (allowedEmails.length === 0) {
    return true;
  }

  return allowedEmails.includes(normalizeEmail(email));
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

        const userId =
          typeof rawUser.id === "string" ? rawUser.id : email;

        const userEmail =
          typeof rawUser.email === "string" ? rawUser.email : email;

        const userName =
          typeof rawUser.name === "string" && rawUser.name.trim().length > 0
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