import fs from 'fs';
import path from 'path';
import logger from '../config/logger';

/**
 * Converts cookies from simple format to Netscape format
 * The Netscape format required for yt-dlp is:
 * domain  includeSubdomains  path  secureOnly  expirationTime  name  value
 */
export const convertCookiesToNetscape = (inputFile: string, outputFile: string): boolean => {
  try {
    // Read the original cookie file
    const cookiesContent = fs.readFileSync(inputFile, 'utf8');
    const lines = cookiesContent.split('\n').filter(line => line.trim() !== '');

    // Header required for cookie files in Netscape format
    const netscapeHeader = '# Netscape HTTP Cookie File\n';
    let netscapeContent = netscapeHeader;

    // Process each cookie line
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 7) {
        // Already in the correct format, just add it
        netscapeContent += line + '\n';
      } else if (parts.length === 6) {
        // Common format with 6 parts (domain, path flag, path, secure flag, expiry, name, value)
        const [domain, includeSubdomains, path, secureFlag, expiry, name, value] = parts;

        // Ensure we have all required data
        if (domain && path && name && value !== undefined) {
          netscapeContent += `${domain}\t${includeSubdomains === 'TRUE' ? 'TRUE' : 'FALSE'}\t${path}\t`;
          netscapeContent += `${secureFlag === 'TRUE' ? 'TRUE' : 'FALSE'}\t${expiry || '0'}\t${name}\t${value}\n`;
        }
      }
    }

    // Write the converted file
    fs.writeFileSync(outputFile, netscapeContent);
    logger.info(`Cookies successfully converted to: ${outputFile}`);
    return true;
  } catch (error) {
    logger.error(`Error converting cookies: ${error}`);
    return false;
  }
};

/**
 * Checks if a cookie file is in Netscape format
 */
export const isNetscapeFormat = (filePath: string): boolean => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.includes('# Netscape HTTP Cookie File');
  } catch (error) {
    return false;
  }
};

/**
 * Ensures cookies are in the correct Netscape format
 */
export const ensureNetscapeCookies = (cookiesFile: string): string => {
  try {
    if (!fs.existsSync(cookiesFile)) {
      logger.error(`Cookie file not found: ${cookiesFile}`);
      return '';
    }

    // If already in Netscape format, return the original path
    if (isNetscapeFormat(cookiesFile)) {
      return cookiesFile;
    }

    // Otherwise, convert to Netscape format
    const dir = path.dirname(cookiesFile);
    const filename = path.basename(cookiesFile, path.extname(cookiesFile));
    const outputFile = path.join(dir, `${filename}_netscape.txt`);

    if (convertCookiesToNetscape(cookiesFile, outputFile)) {
      return outputFile;
    }

    return '';
  } catch (error) {
    logger.error(`Error processing cookie file: ${error}`);
    return '';
  }
};

export default {
  convertCookiesToNetscape,
  isNetscapeFormat,
  ensureNetscapeCookies,
};
