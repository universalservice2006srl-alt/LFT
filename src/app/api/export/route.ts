import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { listAllLogsForExport } from "@/lib/data";
import { entryTypeLabel, purposeLabel } from "@/lib/constants";

const HEADERS = [
  "Date",
  "Time",
  "Driver",
  "Plate",
  "Vehicle",
  "Branch",
  "Entry Type",
  "Odometer (km)",
  "Distance (km)",
  "Usage",
  "Trip Purpose",
  "Status",
  "Fuel (L)",
  "Cost (EUR)",
  "Station",
];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const fmt = sp.get("format") ?? "csv";

  const rows = await listAllLogsForExport(user, {
    branchId: sp.get("branch") || null,
    entryType: sp.get("type") || null,
    usage: (sp.get("usage") as "assigned" | "temporary" | null) || null,
    status: sp.get("status") || null,
    q: sp.get("q") || null,
    from: sp.get("from") || null,
    to: sp.get("to") || null,
  });

  const stamp = new Date().toISOString().slice(0, 10);

  if (fmt === "xls") {
    const esc = (s: string | number) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const bodyRows = rows
      .map((r) => {
        const d = new Date(r.createdAt);
        const cells = [
          d.toLocaleDateString("en-GB"),
          d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
          r.driverName,
          r.plate,
          r.vehicleLabel,
          r.branchName,
          entryTypeLabel(r.entryType),
          r.odometerValue,
          r.distanceKm,
          r.isTemporaryDriver ? "Temporary" : "Assigned",
          r.isTemporaryDriver ? purposeLabel(r.tripPurpose) : "",
          r.status,
          r.refuel ? r.refuel.liters : "",
          r.refuel ? r.refuel.totalCost : "",
          r.refuel?.stationName ?? "",
        ];
        return `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`;
      })
      .join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table border="1"><thead><tr>${HEADERS.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="fleetpulse-mileage-${stamp}.xls"`,
      },
    });
  }

  const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    const d = new Date(r.createdAt);
    lines.push(
      [
        d.toLocaleDateString("en-GB"),
        d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        r.driverName,
        r.plate,
        r.vehicleLabel,
        r.branchName,
        entryTypeLabel(r.entryType),
        r.odometerValue,
        r.distanceKm,
        r.isTemporaryDriver ? "Temporary" : "Assigned",
        r.isTemporaryDriver ? purposeLabel(r.tripPurpose) : "",
        r.status,
        r.refuel ? r.refuel.liters : "",
        r.refuel ? r.refuel.totalCost : "",
        r.refuel?.stationName ?? "",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fleetpulse-mileage-${stamp}.csv"`,
    },
  });
}
