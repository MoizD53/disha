import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import StaffManagementClient from "./StaffManagementClient";
import { fetchStaffList } from "@/services/staff/staff_service";

export default async function StaffManagementPage() {
  const { session, user } = await getSession();

  if (!session || !user) {
    redirect("/login");
  }

  if (!hasPermission(user, "STAFF_MANAGEMENT")) {
    redirect("/dashboard");
  }

  const initialStaff = await fetchStaffList();

  return <StaffManagementClient initialStaff={initialStaff} />;
}
