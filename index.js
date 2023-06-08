#! /usr/bin/env node
import { program } from 'commander';

import fs from 'fs';
import path from 'path';
import ERROR_CODES from './src/models/errors.js';
import { NG_FILE_INFO } from './src/models/ng-file-info.js';

function generate(inOptions) {
    let filePath = inOptions.file;

    if (filePath == undefined) {
        throw ERROR_CODES.NO_FILE.toString();
    }

    let basename = path.basename(filePath);

    const fileInfo = Object.values(NG_FILE_INFO).find(obj => basename.endsWith(obj.extension));
    if (fileInfo == undefined) {
        throw ERROR_CODES.INVALID_FILE.toString();
    }

    let testGenerator = new fileInfo.generator(filePath);

    let output = testGenerator.generate(inOptions.generateMethodTests);

    if (inOptions.print != false) {
        console.log(output);
    }

    if (inOptions.writeFile == true) {
        let specFilePath = filePath.substring(0, filePath.lastIndexOf('.')) + '.spec.ts';

        if (!fs.existsSync(specFilePath)) {
            fs.writeFileSync(specFilePath, "");
        }

        let specIsEmpty = fs.readFileSync(specFilePath).length === 0;

        if (!specIsEmpty && !inOptions.force) {
            console.log(`${specFilePath} is not empty! Please use --force`)
        } else if (specIsEmpty || inOptions.force == true) {
            fs.writeFileSync(specFilePath, output);
        }
    }
}

program.option('--file <filePath>', 'File to generate tests for')
    .option('--no-generate-method-tests', 'Do not generate method tests, only the skeleton boilerplate', true)
    .option('--no-print', 'disable print output to console', true)
    .option('--write-file', 'Write to .spec.ts file if file is empty', false)
    .option('--force', '--write-file will write over code in the .spec.ts file', false)

program.parse(process.argv);


let options = program.opts();

if (options.file) {
    generate(options);
}

export { generate };