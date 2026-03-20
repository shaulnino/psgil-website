import { NextResponse } from "next/server";
import { getCurrentStewardUser } from "@/lib/stewards/auth";
import { getPendingIndicatorsForUser } from "@/lib/stewards/repository";

export async function GET() {
  try {
    const user = await getCurrentStewardUser();
    if (!user || !user.isActive) {
      return NextResponse.json({ indicators: [], total: 0 });
    }
    const indicators = await getPendingIndicatorsForUser(user);
    const total = indicators.reduce((sum, i) => sum + i.count, 0);
    return NextResponse.json({ indicators, total });
  } catch {
    return NextResponse.json({ indicators: [], total: 0 });
  }
}
