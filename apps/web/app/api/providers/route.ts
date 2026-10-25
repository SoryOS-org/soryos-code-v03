import { NextRequest, NextResponse } from "next/server";
import {
  getAllProviders,
  syncOpenCodeZenModels,
  INITIAL_PROVIDERS,
} from "@/lib/providers";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const forceSync = url.searchParams.get("sync") === "true";

    if (forceSync) {
      await syncOpenCodeZenModels();
    }

    const providers = getAllProviders();
    return NextResponse.json({
      providers,
      totalProviders: providers.length,
      totalModels: providers.reduce((acc, p) => acc + p.models.length, 0),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Failed to get providers:", err);
    return NextResponse.json({
      providers: INITIAL_PROVIDERS,
      totalProviders: INITIAL_PROVIDERS.length,
      totalModels: INITIAL_PROVIDERS.reduce((acc, p) => acc + p.models.length, 0),
      timestamp: new Date().toISOString(),
    });
  }
}

export async function POST() {
  try {
    const syncResult = await syncOpenCodeZenModels();
    const providers = getAllProviders();
    return NextResponse.json({
      success: true,
      syncResult,
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Sync failed",
        providers: getAllProviders(),
      },
      { status: 500 },
    );
  }
}
