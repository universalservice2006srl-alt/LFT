import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getVehicleDailyReport } from "@/lib/data";

const HEADERS = [
  "Date",
  "Vehicle Reg",
  "Vehicle",
  "Office",
  "Assigned Staff",
  "Logged By",
  "Morning Mileage",
  "Evening Mileage",
  "Total Mileage (km)",
  "Refuel Count",
  "Refuel Amount (EUR)",
  "Total Litres",
  "Status",
  "Check",
  "Verification",
];

function rowCells(r: Awaited<ReturnType<typeof getVehicleDailyReport>>["rows"][number]) {
  const statusLabel =
    r.status === "not_used"
      ? "Vehicle not used"
      : r.status === "partial"
        ? "Incomplete log"
        : "Logged";
  return [
    r.date,
    r.plate,
    r.vehicleLabel,
    r.branchName,
    r.assignedStaff ?? "Unassigned (pool)",
    r.loggedBy.join(" / "),
    r.morningKm ?? "",
    r.eveningKm ?? "",
    r.totalKm ?? "",
    r.refuelCount || "",
    r.refuelCost ? r.refuelCost.toFixed(2) : "",
    r.refuelLiters ? r.refuelLiters.toFixed(2) : "",
    statusLabel,
    r.severity === "alert" ? "NEEDS CHECK" : r.severity === "info" ? "Idle" : "OK",
    r.mismatch ?? "",
  ];
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role === "driver") {
    return NextResponse.json(
      { error: "Only managers can access the verification report" },
      { status: 403 }
    );
  }

  const sp = request.nextUrl.searchParams;
  const report = await getVehicleDailyReport(user, {
    from: sp.get("from"),
    to: sp.get("to"),
    branchId: sp.get("branch"),
    vehicleId: sp.get("vehicle"),
    q: sp.get("q"),
    issuesOnly: sp.get("issues") === "1",
  });

  const format = sp.get("format");
  if (!format) return NextResponse.json(report);

  const stamp = `${report.summary.from}_${report.summary.to}`;

  if (format === "xls") {
    const esc = (s: string | number) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = report.rows
      .map((r) => `<tr>${rowCells(r).map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
      .join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table border="1"><thead><tr>${HEADERS.map(
      (h) => `<th>${h}</th>`
    ).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    return new NextResponse(html, {
      headers: {
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="vehicle-verification-${stamp}.xls"`,
      },
    });
  }

  const csvCell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [HEADERS.join(",")];
  for (const r of report.rows) lines.push(rowCells(r).map(csvCell).join(","));

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vehicle-verification-${stamp}.csv"`,
    },
  });
}
