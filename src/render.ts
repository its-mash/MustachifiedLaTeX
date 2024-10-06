import * as fs from 'fs';
import * as path from 'path';
import * as Mustache from 'mustache';
import * as yaml from 'js-yaml';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

function loadTemplate(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

function findInputs(template: string): string[] {
    const inputPattern = /\\input{([^}]+)}/g;
    const inputs: string[] = [];
    let match;

    while ((match = inputPattern.exec(template)) !== null) {
        inputs.push(match[1]); // Collect the paths of inputs
    }

    return inputs;
}

function renderTemplate(templatePath: string, data: any): string {
    const template = loadTemplate(templatePath);
    const partials = findInputs(template);
    let renderedTemplate = template;

    // Loop through each partial to replace the \input{} with the rendered content
    for (const partial of partials) {
        const partialPath = path.resolve(path.dirname(templatePath), partial); // Resolve to absolute path
        const renderedPartial = renderTemplate(partialPath, data); // Recursive call to renderTemplate
        renderedTemplate = renderedTemplate.replace(`\\input{${partial}}`, renderedPartial);
    }

    // Finally render the main template with the data
    return Mustache.render(renderedTemplate, data, {}, { 
        tags: ['<<', '>>'] // Set custom delimiters
    });
}

// Command-line argument parsing using yargs
const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <data.yaml> <main.tex> [output.tex]')
    .demandCommand(2)
    .argv as { _: string[] }; // Assert the type of argv;

// Ensure argv._ is correctly inferred
const dataFilePath = argv._[0] as string;         // YAML data file path
const mainTemplatePath = argv._[1] as string;     // Main LaTeX template file path
const outputFilePath = argv._[2]                  // Optional output file path
    ? path.resolve(argv._[2])                     // Resolve if specified
    : path.join(path.dirname(mainTemplatePath), 'output.tex');  // Default to output.tex in the template directory

// Load data (YAML format)
let data: any;
try {
    const yamlContent = fs.readFileSync(dataFilePath, 'utf-8');
    data = yaml.load(yamlContent);
} catch (error: any) {
    console.error(`Error loading YAML file: ${error.message}`);
    process.exit(1);
}

// Render the template
const output = renderTemplate(mainTemplatePath, data);

// Save the processed LaTeX file
fs.writeFileSync(outputFilePath, output);

console.log(`LaTeX document generated: ${outputFilePath}`);
