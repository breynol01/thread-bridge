#!/usr/bin/env tsx
import { createCli } from "../src/cli.js";

const program = createCli();
program.parse(process.argv);
