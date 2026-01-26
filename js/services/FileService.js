/**
 * File Service
 * Handles file processing including images, PDFs, and text files
 */

import { validateFile } from '../utils/validators.js';
import { formatFileSize } from '../utils/helpers.js';

/**
 * Converts a file to base64 data URL
 * @param {File} file - The file to convert
 * @returns {Promise<string>} - Base64 data URL
 */
export function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
}

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
    if (file.type.startsWith('image/')) {
        const base64 = await convertFileToBase64(file);
        return {
            type: 'image',
            content: base64,
            name: file.name,
            size: file.size
        };
    } else if (file.type === 'application/pdf') {
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
 * Safe file reading with error handling and timeout
 * @param {File} file - The file to read
 * @param {string} method - The read method to use
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} - Promise that resolves with the file content
 */
export function safeFileRead(file, method = 'readAsText', timeout = 30000) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
        reader.onabort = () => reject(new Error(`File read aborted: ${file.name}`));

        // Timeout after specified duration
        const timeoutId = setTimeout(() => {
            reader.abort();
            reject(new Error(`File read timeout: ${file.name}`));
        }, timeout);

        try {
            if (method === 'readAsText') reader.readAsText(file);
            else if (method === 'readAsDataURL') reader.readAsDataURL(file);
            else if (method === 'readAsArrayBuffer') reader.readAsArrayBuffer(file);
            else reject(new Error(`Unknown read method: ${method}`));
        } catch (err) {
            clearTimeout(timeoutId);
            reject(err);
        }
    });
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

/**
 * Formats file information for display
 * @param {File} file - The file
 * @returns {string} - Formatted file info string
 */
export function formatFileInfo(file) {
    return `${file.name} (${formatFileSize(file.size)})`;
}

/**
 * Checks if a file is an image
 * @param {File} file - The file to check
 * @returns {boolean} - True if the file is an image
 */
export function isImageFile(file) {
    return file.type.startsWith('image/');
}

/**
 * Checks if a file is a PDF
 * @param {File} file - The file to check
 * @returns {boolean} - True if the file is a PDF
 */
export function isPDFFile(file) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Creates a file info object for storage
 * @param {Object} attachment - The attachment object
 * @returns {string} - Formatted string for chat history
 */
export function createAttachmentInfo(attachment) {
    if (attachment.type === 'image') {
        return `\n\n[Uploaded Image: ${attachment.name}]`;
    } else {
        return `\n\n[File: ${attachment.name}]\n${attachment.content}`;
    }
}
