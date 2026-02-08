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

## Configuration

You can customize the following environment variables in `docker-compose.yml`:

- `APP_PASSWORD`: The password required to access the dashboard (Default: `admin123`).
- `JWT_SECRET`: Secret key for authentication tokens.

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite.
- **Backend**: Node.js, Express, Prisma.
- **Database**: SQLite.
- **Deployment**: Nginx, Docker.

## License

This project is licensed under the MIT License.
