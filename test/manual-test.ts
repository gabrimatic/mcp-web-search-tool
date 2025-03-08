#!/usr/bin/env node

/**
 * Manual test script for the MCP Web Search server
 *
 * This script starts the server as a child process and sends test requests.
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';
import 'dotenv/config';

// Define types for MCP messages
interface McpRequest {
  jsonrpc: string;
  id: string;
  method: string;
  params: Record<string, unknown>;
}

// Ensure API key is available
if (!process.env.BRAVE_API_KEY) {
  console.error('Error: BRAVE_API_KEY environment variable is not set.');
  console.error('Please create or update your .env file with a valid API key.');
  process.exit(1);
}

// Start the MCP server as a child process
const serverProcess = spawn('node', ['./build/index.js'], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: process.env
});

// Create readline interface for server's stdout
const rl = createInterface({
  input: serverProcess.stdout,
  crlfDelay: Infinity
});

// Listen for server output
rl.on('line', (line) => {
  console.log(`Server: ${line}`);

  // If we see the server is ready, send test requests
  if (line.includes('MCP server ready')) {
    console.log('\n--- Starting tests ---\n');
    runTests();
  } else {
    try {
      // Try to parse the response as JSON
      const response = JSON.parse(line);
      console.log('Received response:');
      console.log(JSON.stringify(response, null, 2));

      // If this is the last test, exit after a short delay
      if (response.id === 'test-3') {
        setTimeout(() => {
          console.log('\nTests completed. Shutting down...');
          serverProcess.kill();
          process.exit(0);
        }, 1000);
      }
    } catch (e) {
      // Not JSON, just a regular log message
    }
  }
});

/**
 * Send a message to the server
 *
 * @param message - The MCP request to send
 */
function sendToServer(message: McpRequest): void {
  console.log(`\nSending to server: ${JSON.stringify(message, null, 2)}`);
  serverProcess.stdin.write(JSON.stringify(message) + '\n');
}

/**
 * Run a series of test requests
 */
async function runTests(): Promise<void> {
  // Test 1: List available tools
  sendToServer({
    jsonrpc: '2.0',
    id: 'test-1',
    method: 'tools/list',
    params: {}
  });

  // Wait a bit before sending the next request
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Call web_search tool with a valid query
  sendToServer({
    jsonrpc: '2.0',
    id: 'test-2',
    method: 'tools/call',
    params: {
      name: 'web_search',
      arguments: {
        search_term: 'Model Context Protocol'
      }
    }
  });

  // Wait a bit before sending the next request
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 3: Call web_search tool with an invalid query (empty string)
  sendToServer({
    jsonrpc: '2.0',
    id: 'test-3',
    method: 'tools/call',
    params: {
      name: 'web_search',
      arguments: {
        search_term: ''
      }
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('Stopping test...');
  serverProcess.kill();
  process.exit();
});

console.log('Starting MCP Web Search server test...');
