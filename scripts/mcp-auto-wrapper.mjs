#!/usr/bin/env node
/**
 * MCP Auto Wrapper
 *
 * Automatically detects the project based on current working directory
 * and connects to the appropriate MCP endpoint.
 *
 * Usage (launched from project directory):
 *   node /home/samuel/sv/supervisor-service-s/scripts/mcp-auto-wrapper.mjs
 */

import * as readline from 'readline';
import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';

// Detect project from current working directory
function detectProject() {
  const cwd = process.cwd();
  const cwdName = path.basename(cwd);

  // Map directory names to project names
  const projectMap = {
    'supervisor-service-s': 'meta',
    'consilio-s': 'consilio',
    'odin-s': 'odin',
    'openhorizon-s': 'openhorizon',
    'health-agent-s': 'health-agent'
  };

  // Check if we're in a known project directory
  if (projectMap[cwdName]) {
    return projectMap[cwdName];
  }

  // Check if we're in a subdirectory of a project
  const parts = cwd.split('/');
  for (let i = parts.length - 1; i >= 0; i--) {
    const dirName = parts[i];
    if (projectMap[dirName]) {
      return projectMap[dirName];
    }
  }

  // Default to meta if we can't detect
  return 'meta';
}

const project = detectProject();
const MCP_SERVER_HOST = process.env.MCP_SERVER_HOST || 'localhost';
const MCP_SERVER_PORT = process.env.MCP_SERVER_PORT || '8081';
const MCP_ENDPOINT = `/mcp/${project}`;

// Debug logging (to stderr to not interfere with stdio communication)
const debug = (...args) => {
  if (process.env.MCP_DEBUG) {
    console.error('[MCP-AUTO]', ...args);
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
  debug(`Auto-detected project: ${project}`);
  debug(`CWD: ${process.cwd()}`);
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
