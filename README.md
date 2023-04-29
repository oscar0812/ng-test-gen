
# Angular Test Generator
This is an npm package that generates the skeleton for Angular tests using Jasmine and Testbed. It allows you to quickly set up your test files with the necessary providers, and declarations. It spys function calls and mocks services.

## Installation

To use this package, you need to have Node.js and npm installed on your machine. Once you have these, you can install the package using the following command:

npm install -g ngtestgen

## Usage

To use the Angular Test Generator run the following command:

ngtestgen --file **file-path**

Replace **file-path** with the name of the typescript file for which you want to create the test files.


This will generate two files in the current directory:

.spec.ts: This file contains the test cases for your component.

For more information on paramaters run the following command:

ngtestgen --help

## Configuration

You can configure the Angular Test Generator by editing the config.js file in the npm install directory

## License

This project is licensed under the MIT License. See the LICENSE.md file for details.

## Contact

If you have any questions or issues with this package, please contact us at oscar0812torres@gmail.com