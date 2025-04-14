import { Inngest } from "inngest";
import { extractEmailCode, parseEmailHeaders } from './email-utils'; 

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * You can use ES2017+ features, today!
 */

/**
 * Reads a ReadableStream and converts it to a string
 */
async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    let result = "";
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            result += new TextDecoder().decode(value);
        }
    } finally {
        reader.releaseLock();
    }
    
    return result;
}

/**
 * Process an email and send it to Inngest
 */
async function processEmail(
    rawEmail: string,
    from: string,
    to: string,
    headers: Record<string, string>,
    eventKey: string
): Promise<{ success: boolean; emailCode: string | null; error?: string }> {
    // Extract email code from the recipient address
    const emailCode = extractEmailCode(to);
    if (!emailCode) {
        return { success: false, emailCode: null, error: `No valid email code found in recipient address: ${to}` };
    }
    
    // Forward the email with the extracted code
    const inngest = new Inngest({ id: "email4ynab-worker", eventKey });
    const eventName = "worker/email.received";
    await inngest.send({
        name: eventName,
        data: {
            from,
            to,
            rawSize: rawEmail.length,
            headers,
            raw: rawEmail,
            emailCode
        },
    });
    
    console.log(`Sent ${eventName} event with code: ${emailCode}`);
    return { success: true, emailCode };
}

const worker = {
    async email(message: ForwardableEmailMessage, env: Env) {
        const eventKey = await env.INNGEST_EVENT_KEY.get();
        if (!eventKey) {
            throw new Error("Event key not found");
        }
        
        console.log(`Received email from: ${message.from} to: ${message.to}`);
        
        // Extract the email code from the recipient address
        const emailCode = extractEmailCode(message.to);
        
        if (!emailCode) {
            console.error(`No valid email code found in recipient: ${message.to}`);
            // Reject the email with a permanent SMTP error
            message.setReject("Invalid email recipient");
            return;
        }
        
        // Read the raw email content from the stream
        const rawEmailContent = await streamToString(message.raw);
        
        // Convert Headers to Record<string, string>
        const headerRecord: Record<string, string> = {};
        for (const [key, value] of Object.entries(message.headers)) {
            headerRecord[key] = value;
        }
        
        // Process the email
        await processEmail(rawEmailContent, message.from, message.to, headerRecord, eventKey);
    },
    async fetch(request: Request, env: Env) {
        // Only process POST requests with raw email content
        if (request.method !== 'POST') {
            return new Response('Only POST method is supported', { status: 405 });
        }
        
        const eventKey = await env.INNGEST_EVENT_KEY.get();
        if (!eventKey) {
            return new Response('Event key not found', { status: 500 });
        }
        
        // Get the raw email content from the request body
        const rawEmailContent = await request.text();
        if (!rawEmailContent) {
            return new Response('Empty email content', { status: 400 });
        }
        
        console.log('Received raw email content via HTTP for debugging');
        
        // Parse the raw email to extract basic headers
        const { headers, from, to } = parseEmailHeaders(rawEmailContent);
        
        // Process the email
        const result = await processEmail(rawEmailContent, from, to, headers, eventKey);
        
        if (!result.success) {
            return new Response(result.error, { status: 400 });
        }
        
        return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
        });
    },
};

export default worker satisfies ExportedHandler<Env>;
