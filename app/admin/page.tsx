import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { isAdminEmail } from "../../lib/admin";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/my/orders");
  }

  redirect("/admin/production");
}