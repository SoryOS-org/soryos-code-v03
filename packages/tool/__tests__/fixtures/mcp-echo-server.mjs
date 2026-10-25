#!/usr/bin/env node
/**
 * Real MCP stdio fixture server for engine tests.
 * Speaks the actual Model Context Protocol via @modelcontextprotocol/sdk.
 * Tools: echo (text), add (numbers), boom (isError), image (media part).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "soryos-fixture", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "echo",
      description: "Echo the given text back",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", description: "Text to echo" } },
        required: ["text"],
      },
    },
    {
      name: "add",
      description: "Add two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
    {
      name: "boom",
      description: "Always returns an error",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "pixel",
      description: "Returns a tiny media (image) part",
      inputSchema: { type: "object", properties: {} },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "echo") {
    return { content: [{ type: "text", text: String(args?.text ?? "") }] };
  }
  if (name === "add") {
    const sum = Number(args?.a) + Number(args?.b);
    return { content: [{ type: "text", text: String(sum) }] };
  }
  if (name === "boom") {
    return { content: [{ type: "text", text: "fixture exploded" }], isError: true };
  }
  if (name === "pixel") {
    // 1x1 transparent PNG
    return {
      content: [
        { type: "image", data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", mimeType: "image/png" },
      ],
    };
  }
  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
