# Paste Sync

A simple and efficient web-based tool for sharing text and files across devices in a local network.

[中文说明](./README.md)

## Features

- **Shared Clipboard**: Instantly share text between your phone, tablet, and computer.
- **File Sharing**: Upload and download files with ease.
- **Dark Mode**: Supports Light, Dark, and System-based theme switching.
- **Docker Support**: Ready for deployment using Docker Compose.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/AlakaSquasho/paste_sync.git
   cd paste_sync
   ```

2. Start the application:
   ```bash
   docker-compose up -d --build
   ```

3. Access the application:
   - Frontend: [http://localhost:8080](http://localhost:8080)
   - Backend API: [http://localhost:3000](http://localhost:3000)

## Public Nginx Reverse Proxy Template (with WebSocket)

A ready-to-use reverse proxy template is included:

- `nginx.reverse-proxy.template.conf`

This template is for direct frontend/backend split routing at the public Nginx layer, and already includes WebSocket upgrade headers plus long connection timeouts. Routing flow:

- Outer Nginx forwards `/` to `127.0.0.1:8080` (frontend)
- Outer Nginx forwards `/api` and `/ws` to `127.0.0.1:3000` (backend)

How to use:

1. Replace `DOMAIN_NAME` in the template with your real domain.
2. Add HTTPS certificate settings if needed (`listen 443 ssl`, cert paths, etc.).
3. Ensure Docker port mapping matches `docker-compose.yml` (default `8080:80`).
4. Reload Nginx.

## Security Features

For secure deployment on the public internet, the following protections are integrated:

- **Rate Limiting**: Rate limiting on the login endpoint and global API to prevent brute force attacks.
- **Brute Force Delay**: Artificial delay in login verification to increase attack costs.
- **Bcrypt Support**: Support for using Bcrypt hash values as passwords in environment variables.
- **Access Audit Logs**: Automatically records the IP, request path, and status of all visitors. Logs are stored locally on the server (`server/logs/access.log`).

## Configuration

You can customize the following environment variables in `docker-compose.yml`:

- `SHARED_PASSWORD`: The password required for access. Supports plaintext or Bcrypt hash (recommended).
- `JWT_SECRET`: Secret key for authentication tokens. **Please make sure to change this.**
- `IPINFO_API_KEY`: API key for the IP geolocation service. When set, access logs include region details.

### Generate a Secure Password Hash

It is recommended to use a hash instead of plaintext:
```bash
node -e "console.log(require('bcryptjs').hashSync('your_password', 10))"
```
Put the resulting `$2a$...` string into `SHARED_PASSWORD`.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite.
- **Backend**: Node.js, Express, Prisma.
- **Database**: SQLite.
- **Deployment**: Nginx, Docker.

## License

This project is licensed under the MIT License.
