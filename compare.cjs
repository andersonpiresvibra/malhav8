const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getHash(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function walkDir(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git') continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walkDir(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const rootDir = __dirname;
const dirsToCheck = ['MalhaRepo', 'repo'];

const report = {
    identical: [],
    different: [],
    unique: []
};

for (const dirName of dirsToCheck) {
    const fullDirPath = path.join(rootDir, dirName);
    const files = walkDir(fullDirPath);
    
    for (const file of files) {
        const relativePath = path.relative(fullDirPath, file);
        const rootPath = path.join(rootDir, relativePath);
        
        const size = fs.statSync(file).size;
        const entry = `${dirName}/${relativePath} (${size} bytes)`;
        
        if (fs.existsSync(rootPath)) {
            const hashDir = getHash(file);
            const hashRoot = getHash(rootPath);
            
            if (hashDir === hashRoot) {
                report.identical.push(entry);
            } else {
                report.different.push(`${entry} - Root size: ${fs.statSync(rootPath).size} bytes`);
            }
        } else {
            report.unique.push(entry);
        }
    }
}

let markdown = `# DUPLICATE_CLEANUP_REPORT\n\n`;

markdown += `### 1. Arquivos idênticos (mesmo hash da raiz) → SEGURO REMOVER\n`;
for (const file of report.identical) {
    markdown += `- ${file}\n`;
}
if (report.identical.length === 0) markdown += `*Nenhum arquivo!*\n`;

markdown += `\n### 2. Arquivos com mesmo nome MAS conteúdo diferente da raiz → REVISAR ANTES DE REMOVER\n`;
for (const file of report.different) {
    markdown += `- ${file}\n`;
}
if (report.different.length === 0) markdown += `*Nenhum arquivo!*\n`;

markdown += `\n### 3. Arquivos que existem APENAS em /MalhaRepo/ ou /repo/ e NÃO existem na raiz → REVISAR ANTES DE REMOVER (possível conteúdo único)\n`;
for (const file of report.unique) {
    markdown += `- ${file}\n`;
}
if (report.unique.length === 0) markdown += `*Nenhum arquivo!*\n`;

fs.writeFileSync('DUPLICATE_CLEANUP_REPORT.md', markdown);
console.log('Report generated.');
