import { NextResponse } from "next/server";
import { runOpenCodeZenTests } from "@/lib/test-zen";

export async function GET() {
  try {
    const result = await runOpenCodeZenTests();
    return NextResponse.json({
      success: true,
      diagnostic: result,
      message: "OpenCode Zen provider tests executed successfully.",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Test execution failed",
      },
      { status: 500 },
    );
  }
}
