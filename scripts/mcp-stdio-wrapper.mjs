#!/usr/bin/env node
/**
 * MCP STDIO Wrapper
 *
 * Translates stdio communication to HTTP calls to the supervisor MCP server.
 * This allows Claude Code to communicate with the HTTP-based MCP server.
 *
 * Usage:
 *   node scripts/mcp-stdio-wrapper.mjs <project>
 *
 * Example:
 *   node scripts/mcp-stdio-wrapper.mjs meta
 *   node scripts/mcp-stdio-wrapper.mjs consilio
 */

import * as readline from 'readline';
import * as http from 'http';

// Get project name from command line argument
const project = process.argv[2] || 'meta';
const MCP_SERVER_HOST = process.env.MCP_SERVER_HOST || 'localhost';
const MCP_SERVER_PORT = process.env.MCP_SERVER_PORT || '8081';
const MCP_ENDPOINT = `/mcp/${project}`;

// Debug logging (to stderr to not interfere with stdio communication)
const debug = (...args) => {
  if (process.env.MCP_DEBUG) {
    console.error('[MCP-STDIO]', ...args);
  }
};

/**
 * Send request to HTTP MCP server
 */
async function sendToMCP(request) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: MCP_SERVER_HOST,
      port: MCP_SERVER_PORT,
      path: MCP_ENDPOINT,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(request)
      }
    };

    debug('Sending to MCP:', options.path);

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        debug('MCP Response:', data);
        resolve(data);
      });
    });

    req.on('error', (error) => {
      debug('MCP Error:', error);
      reject(error);
    });

    req.write(request);
    req.end();
  });
}

/**
 * Main loop - read JSON-RPC from stdin, send to MCP, write response to stdout
 */
async function main() {
  debug(`Starting MCP STDIO wrapper for project: ${project}`);
  debug(`Connecting to: http://${MCP_SERVER_HOST}:${MCP_SERVER_PORT}${MCP_ENDPOINT}`);

  const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
  });

  rl.on('line', async (line) => {
    try {
      const trimmed = line.trim();
      if (!trimmed) {
        return; // Skip empty lines
      }

      debug('Received from Claude:', trimmed);

      // Parse to validate JSON
      const request = JSON.parse(trimmed);

      // Forward to MCP server
      const response = await sendToMCP(trimmed);

      // Write response to stdout (Claude reads this)
      process.stdout.write(response + '\n');
    } catch (error) {
      debug('Error processing line:', error);

      // Send error response back to Claude
      const errorResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32603,
          message: error.message || 'Internal error'
        }
      };

      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });

  rl.on('close', () => {
    debug('STDIO closed, exiting');
    process.exit(0);
  });

  // Handle errors
  process.on('uncaughtException', (error) => {
    debug('Uncaught exception:', error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    debug('Unhandled rejection:', reason);
    process.exit(1);
  });
}

main();
