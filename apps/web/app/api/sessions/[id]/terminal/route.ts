
import { NextRequest, NextResponse } from 'next/server';
import { sessionStore } from "@soryos/session";
import { ptyManager } from "@soryos/terminal";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const { command } = await req.json();

  try {
    const session = sessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const terminalState = ptyManager.getOrCreateSessionState(sessionId);
    const terminalId = terminalState.activeTerminalId;

    // The `executeCommand` is async, but we don't need to wait for it here.
    // The command will run in the background. The user can get the output
    // via a separate polling mechanism or WebSocket connection.
    ptyManager.executeCommand({ sessionId, terminalId, command });

    return NextResponse.json({ success: true, message: "Command received" });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Terminal command failed: ${errorMessage}` }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  
  try {
    const terminalState = ptyManager.getOrCreateSessionState(sessionId);
    const activeTerminal = terminalState.terminals.get(terminalState.activeTerminalId);

    if (!activeTerminal) {
      return NextResponse.json({ error: 'Active terminal not found for session.' }, { status: 404 });
    }

    // Return the current buffer of the active terminal
    return NextResponse.json({
      sessionId,
      terminalId: activeTerminal.id,
      buffer: activeTerminal.buffer,
      cwd: activeTerminal.cwd,
      exitCode: activeTerminal.exitCode
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to get terminal state: ${errorMessage}` }, { status: 500 });
  }
}
