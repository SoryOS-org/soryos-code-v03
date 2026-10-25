/**
 * LLM Utilities for SoryOS-Code
 * Extracts files, code blocks, and markdown structures from model responses.
 */

export function extractFilesFromResponse(responseText: string): Record<string, string> {
  const files: Record<string, string> = {};
  if (!responseText) return files;

  // Pattern 1: ```lang filepath=path/to/file or filename=path/to/file
  const codeBlockRegex = /```(?:[a-zA-Z0-9_\-+]+)?\s+(?:filepath|filename|path)=["']?([^ \n\r"']+)["']?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(responseText)) !== null) {
    const rawPath = match[1]?.trim();
    const content = match[2];
    if (rawPath && content !== undefined) {
      files[rawPath] = content;
    }
  }

  // Pattern 2: File: path/to/file\n```...``` or File path/to/file:\n```...```
  const fileHeaderRegex = /(?:^|\n)(?:###?\s+)?(?:File|Fichier):\s*[`"']?([^`"'\n\r]+)[`"']?\s*\n```(?:[a-zA-Z0-9_\-+]+)?\n([\s\S]*?)```/g;
  while ((match = fileHeaderRegex.exec(responseText)) !== null) {
    const rawPath = match[1]?.trim();
    const content = match[2];
    if (rawPath && content !== undefined && !files[rawPath]) {
      files[rawPath] = content;
    }
  }

  return files;
}
