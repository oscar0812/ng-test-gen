#! /usr/bin/env node
import { program } from 'commander';

import path from 'path';
import ERROR_CODES from './src/models/errors.js';
import { NG_FILE_INFO } from './src/models/ng-file-info.js';

program.option('--file <filePath>', 'File to generate tests for')
    .option('--no-print', 'disable print output to console', true)
    .option('--write-to-file', 'Write to .spec.ts file if file is empty', false)
    .option('--force', '--write-to-file will write over code in the .spec.ts file', false)

program.parse(process.argv);

const options = program.opts();
console.log(options)
let filePath = options.file;

if (filePath == undefined) {
    throw ERROR_CODES.NO_FILE.toString();
}

let basename = path.basename(filePath);

const fileInfo = Object.values(NG_FILE_INFO).find(obj => basename.endsWith(obj.extension));
if (fileInfo == undefined) {
    throw ERROR_CODES.INVALID_FILE.toString();
}

let testGenerator = new fileInfo.generator(filePath);

let output = testGenerator.generate();

if(options.print != false)
    console.log(output);