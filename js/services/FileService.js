/**
 * File Service
 * Handles file processing for PDFs and text/code files.
 */

import { validateFile } from '../utils/validators.js';

/**
 * Reads a file as text
 * @param {File} file - The file to read
 * @returns {Promise<string>} - File content as text
 */
export function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Extracts text from a PDF file
 * @param {File} file - The PDF file to process
 * @param {Object} pdfjsLib - PDF.js library instance
 * @returns {Promise<string>} - Extracted text content
 */
export async function extractTextFromPDF(file, pdfjsLib) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText;
}

/**
 * Processes a file for attachment
 * @param {File} file - The file to process
 * @param {Object} pdfjsLib - PDF.js library instance
 * @returns {Promise<Object>} - Processed attachment object
 */
export async function processFile(file, pdfjsLib) {
    // Validate the file
    const validation = validateFile(file);
    if (!validation.isValid) {
        throw new Error(validation.error);
    }

    // Process based on file type
    if (file.type === 'application/pdf') {
        const text = await extractTextFromPDF(file, pdfjsLib);
        return {
            type: 'text',
            content: text,
            name: file.name,
            size: file.size
        };
    } else {
        // Text/Code handling
        const text = await readFileAsText(file);
        return {
            type: 'text',
            content: text,
            name: file.name,
            size: file.size
        };
    }
}

/**
 * Gets a file icon for display
 * @param {string} fileName - The file name
 * @returns {string} - Emoji icon for the file type
 */
export function getFileIcon(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();

    const iconMap = {
        'pdf': '📄',
        'txt': '📝',
        'md': '📝',
        'js': '📜',
        'py': '🐍',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'png': '🖼️',
        'gif': '🖼️',
        'webp': '🖼️'
    };

    return iconMap[ext] || '📄';
}

