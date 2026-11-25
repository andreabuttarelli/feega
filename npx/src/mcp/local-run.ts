import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PROJECT_VAR } from '../../../inspect/src/host/ai/editor-mcp';
import { editorRegistry } from '../../../inspect/src/host/local-bridge/editors';
import { localTools } from './local-tools';
import { toolServer } from './server';

const VERSION = '1';

const tools = localTools({ registry: editorRegistry(), send: fetch, cwd: process.env[PROJECT_VAR] ?? process.cwd() });

void toolServer(VERSION, tools).connect(new StdioServerTransport());
