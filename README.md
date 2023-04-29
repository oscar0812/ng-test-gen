# Angular Test Generator
This is an npm package that generates the skeleton for Angular tests using Jasmine and Testbed. It allows you to quickly set up your test files with the necessary providers and declarations. It also spies on function calls and mocks services, making it easier to write comprehensive unit tests for your Angular components.

## Installation
To use this package, you need to have Node.js and npm installed on your machine. Once you have these, you can install the package globally using the following command:

```bash
npm install -g ngtestgen
```
## Usage
To use the Angular Test Generator, run the following command:

```bash
ngtestgen --file <file-path>
```
Replace <file-path> with the path to the TypeScript file for which you want to create the test files.

This will generate a <file-name>.spec.ts file that contains the test cases for your component.

For more information on parameters, run the following command:

```bash
ngtestgen --help
```
This will display the available parameters and their descriptions.

## Configuration
You can configure the Angular Test Generator by editing the config.js file in the npm install directory. This file contains the default configuration options for the package, including the default values for the parameters that can be passed in via the command line.

## Contact
If you have any questions or issues with this package, please contact the package author at oscar0812torres@gmail.com.