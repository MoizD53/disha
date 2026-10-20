import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import AdminManagementClient from "./AdminManagementClient";

export default async function AdminManagementPage() {
  const { session, user } = await getSession();

  if (!session || !user) {
    redirect("/login");
  }

  if (!isSuperAdmin(user)) {
    redirect("/dashboard");
  }

  return <AdminManagementClient currentUserId={user.id} />;
}
