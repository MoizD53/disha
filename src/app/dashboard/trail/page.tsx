import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import LocationTrailClient from "@/components/dashboard/LocationTrailClient";

export const metadata = {
  title: "Location Trail & Route History | DISHA Command Center",
};

interface TrailPageProps {
  searchParams: Promise<{
    personnelId?: string;
    date?: string;
    session?: string;
  }>;
}

export default async function LocationTrailPage({ searchParams }: TrailPageProps) {
  const { session, user } = await getSession();

  if (!session || !user) {
    redirect("/login");
  }

  // Enforce server-side authorization: requires LIVE_MAP permission
  if (!hasPermission(user, "LIVE_MAP")) {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;

  return (
    <LocationTrailClient
      initialPersonnelId={resolvedParams.personnelId || null}
      initialDate={resolvedParams.date || null}
      initialDutySessionId={resolvedParams.session || null}
    />
  );
}
