#! /usr/bin/env node
import { program } from 'commander';

import path from 'path';
import ERROR_CODES from './src/models/errors.js';
import { NG_FILE_INFO } from './src/models/ng-file-info.js';

program.option('--file <filePath>', 'File to generate tests for')

program.parse(process.argv);

const options = program.opts();
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

testGenerator.generate();