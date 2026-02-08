# Paste and Share

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
   git clone https://github.com/AlakaSquasho/paste_and_share.git
   cd paste_and_share
   ```

2. Start the application:
   ```bash
   docker-compose up -d --build
   ```

3. Access the application:
   - Frontend: [http://localhost:8080](http://localhost:8080)
   - Backend API: [http://localhost:3000](http://localhost:3000)

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
