// src/email-utils.ts

/**
 * Extract the 8-character code from an email address like 1234abcd@email4ynab.com.
 * @param email The recipient email address.
 * @returns The 8-character code (lowercase) or null if not found or invalid.
 */
export function extractEmailCode(email: string): string | null {
	if (!email) return null;

	const emailParts = email.split('@');
	if (emailParts.length !== 2) return null;

	const localPart = emailParts[0];

	// Must start with 'fw+' followed by 8-32 alphanumeric characters
	const codeRegex = /^fw\+([a-zA-Z0-9]{8,32})$/;
	const match = localPart.match(codeRegex);
	if (!match) return null;

	return match[1].toLowerCase();
}


/**
 * Parse raw email headers from a string
 */
export function parseEmailHeaders(rawEmail: string): { headers: Record<string, string>; from: string; to: string } {
    const headers: Record<string, string> = {};
    const lines = rawEmail.split(/\r?\n/); // Handle both LF and CRLF line endings
    let from = '';
    let to = '';

    // Extract headers from the raw email
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim(); // Use let as line can be modified
        if (!line) break; // Empty line marks the end of headers

        // Handle folded headers (lines starting with whitespace)
        while (lines[i+1] && /^\s/.test(lines[i+1])) {
            line += ' ' + lines[i+1].trim(); // Add a space before the trimmed folded line
            i++;
        }

        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
            const [, name, value] = match;
            const headerName = name.toLowerCase();
            headers[headerName] = value;

            if (headerName === 'from') from = value;
            if (headerName === 'to') to = value;
        }
    }

    return { headers, from, to };
}
