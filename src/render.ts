import * as fs from 'fs';
import * as path from 'path';
import * as Mustache from 'mustache';
import * as yaml from 'js-yaml';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

// Save the original lookup method
const originalLookup = Mustache.Context.prototype.lookup;

let latexMouchteacheGlobalLang: string = 'en'; // Default to English
// Override the lookup method to add language support
Mustache.Context.prototype.lookup = function(name: string) {
    const langSpecificName = `${name}.${latexMouchteacheGlobalLang}`;  // Try language-specific key first
    console.log(name,langSpecificName)
    const langValue = originalLookup.call(this, langSpecificName); // Call original lookup for name.language

    
    if (langValue !== undefined) {
        return langValue; // Return if language-specific value is found
    }

    // Fallback to default behavior if no language-specific value exists
    return originalLookup.call(this, name);
};


// Function to load the template
function loadTemplate(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

// Function to find LaTeX \input{} files
function findInputs(template: string): string[] {
    const inputPattern = /\\input{([^}]+)}/g;
    const inputs: string[] = [];
    let match;

    while ((match = inputPattern.exec(template)) !== null) {
        inputs.push(match[1]); // Collect the paths of inputs
    }

    return inputs;
}

// Function to render templates recursively
function renderTemplate(templatePath: string, data: any): string {
    const template = loadTemplate(templatePath);
    const partials = findInputs(template);
    let renderedTemplate = template;

    // Loop through each partial to replace \input{} with rendered content
    for (const partial of partials) {
        const partialPath = path.resolve(path.dirname(templatePath), partial); // Resolve to absolute path
        const renderedPartial = renderTemplate(partialPath, data); // Recursive call
        renderedTemplate = renderedTemplate.replace(`\\input{${partial}}`, renderedPartial);
    }

    // Render the template with the custom language-aware resolver
    return Mustache.render(renderedTemplate, data, {}, {
        tags: ['<<', '>>'] // Custom delimiters
    });
}

// Define the type for argv to include output and lang options
interface Argv {
    _: string[]; // Positional arguments
    output?: string; // Output file path
    lang: string; // Language for rendering
}


// Command-line argument parsing using yargs
const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <data.yaml> <main.tex> [--output <output.tex>] [--lang <language>]')
    .demandCommand(2)
    .option('output', {
        alias: 'o',
        type: 'string',
        description: 'Output file path',
    })
    .option('lang', {
        alias: 'l',
        type: 'string',
        description: 'Language for rendering (e.g., en, de)',
        default: 'en',  // Default to English
    })
    .argv as Argv; // Assert the type of argv;

    
// Ensure argv._ is correctly inferred
const dataFilePath = argv._[0] as string;         // YAML data file path
const mainTemplatePath = argv._[1] as string;     // Main LaTeX template file path
const outputFilePath = argv.output                  // Optional output file path from options
    ? path.resolve(argv.output.trim())                     // Resolve if specified
    : path.join(path.dirname(mainTemplatePath), 'output.tex');  // Default to output.tex in the template directory

console.log(`Resolved Output Path: ${outputFilePath}`); // Debug output for resolved paths

// Load YAML data
let data: any;
try {
    const yamlContent = fs.readFileSync(dataFilePath, 'utf-8');
    data = yaml.load(yamlContent);
    latexMouchteacheGlobalLang = argv.lang.trim();  // Inject the selected language into the data object
} catch (error: any) {
    console.error(`Error loading YAML file: ${error.message}`);
    process.exit(1);
}

// Render the template with the selected language
const output = renderTemplate(mainTemplatePath, data);

// Save the rendered LaTeX file
fs.writeFileSync(outputFilePath, output);

console.log(`LaTeX document generated: ${outputFilePath} in language: ${latexMouchteacheGlobalLang}`);
