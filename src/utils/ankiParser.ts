/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses Anki exported text/CSV/TSV files and returns a Set of normalized words.
 */
export function parseAnkiExportFile(text: string): Set<string> {
  const words = new Set<string>();
  const lines = text.split(/\r?\n/);
  
  let separator = "\t"; // Default to tab for Anki exports
  let guidCol = -1;
  let notetypeCol = -1;
  let deckCol = -1;
  let tagsCol = -1;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Check for Anki configuration headers
    if (trimmed.startsWith("#")) {
      const header = trimmed.substring(1).trim().toLowerCase();
      if (header.startsWith("separator:")) {
        const sepValue = header.substring("separator:".length).trim();
        if (sepValue === "tab") {
          separator = "\t";
        } else if (sepValue === "comma") {
          separator = ",";
        } else if (sepValue === "semicolon") {
          separator = ";";
        } else if (sepValue.length === 1) {
          separator = sepValue;
        }
      } else if (header.startsWith("guid column:")) {
        guidCol = parseInt(header.substring("guid column:".length).trim(), 10) - 1;
      } else if (header.startsWith("notetype column:")) {
        notetypeCol = parseInt(header.substring("notetype column:".length).trim(), 10) - 1;
      } else if (header.startsWith("deck column:")) {
        deckCol = parseInt(header.substring("deck column:".length).trim(), 10) - 1;
      } else if (header.startsWith("tags column:")) {
        tagsCol = parseInt(header.substring("tags column:".length).trim(), 10) - 1;
      }
      continue;
    }
    
    // Split the line by the active separator
    const columns = trimmed.split(separator);
    if (columns.length > 0) {
      let extractedWord = "";
      
      // 1. Scan all fields on the line for custom card HTML tags
      for (let i = 0; i < columns.length; i++) {
        // Skip metadata columns if configured
        if (i === guidCol || i === notetypeCol || i === deckCol || i === tagsCol) {
          continue;
        }
        
        const col = columns[i];
        
        // Match <h1 class="anki-word">...</h1> (case-insensitive)
        const wordMatch = col.match(/class=["']{1,2}anki-word["']{1,2}[^>]*>([^<]+)</i);
        if (wordMatch && wordMatch[1]) {
          extractedWord = wordMatch[1].trim();
          break;
        }
        
        // Match <div class="anki-header">...</div> (sometimes contains "word • /ipa/")
        const headerMatch = col.match(/class=["']{1,2}anki-header["']{1,2}[^>]*>([^<•]+)/i);
        if (headerMatch && headerMatch[1]) {
          extractedWord = headerMatch[1].trim();
          break;
        }
      }
      
      // 2. Fallback: If no HTML patterns matched, select the first non-metadata column
      if (!extractedWord) {
        for (let i = 0; i < columns.length; i++) {
          if (i === guidCol || i === notetypeCol || i === deckCol || i === tagsCol) {
            continue;
          }
          
          let candidate = columns[i].trim();
          
          // Clean HTML tags from the candidate
          candidate = candidate.replace(/<\/?[^>]+(>|$)/g, "").trim();
          
          // Strip surrounding quotes
          if (candidate.startsWith('"') && candidate.endsWith('"')) {
            candidate = candidate.substring(1, candidate.length - 1).trim();
          }
          
          // Unescape double quotes if any (e.g. ""word"" -> "word")
          candidate = candidate.replace(/""/g, '"');
          
          // Avoid matching GUIDs or long lines of HTML
          if (candidate && candidate.length < 100) {
            // Check if it looks like a guid (contains special chars like ;, |, `, etc.)
            const isGuid = /^[a-zA-Z0-9;_|`]+$/.test(candidate) && candidate.length === 10 && (candidate.includes(";") || candidate.includes("|") || candidate.includes("`"));
            if (!isGuid) {
              extractedWord = candidate;
              break;
            }
          }
        }
      }
      
      // Normalize and add
      if (extractedWord) {
        // Strip any remaining double quotes
        extractedWord = extractedWord.replace(/^"+|"+$/g, "").trim();
        if (extractedWord && extractedWord.length < 100) {
          words.add(extractedWord.toLowerCase());
        }
      }
    }
  }
  
  return words;
}
