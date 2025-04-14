# Email4YNAB Worker

This worker processes incoming emails in `.eml` format and extracts relevant information for YNAB (You Need A Budget).

## Prerequisites

- Node.js
- npm

## Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run the development server:**
    This starts the Cloudflare Worker locally using `wrangler`. By default, it should be available at `http://localhost:8787`.
    ```bash
    npm run dev
    ```

3.  **Post an email:**
    To test the worker, you can send an email file (`.eml`) using `curl`. Make sure the development server is running. Replace `path/to/your/email.eml` with the actual path to your email file.

    ```bash
    curl -X POST \
      http://localhost:8787/ \
      -H 'Content-Type: message/rfc822' \
      --data-binary @path/to/your/email.eml
    ```

    The worker expects the raw email content in the request body with the `Content-Type` header set to `message/rfc822`.

## Deployment

```bash
npm run deploy
```
