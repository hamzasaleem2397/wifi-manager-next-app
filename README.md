# WiFi Manager

A Next.js web application for managing your Huawei HG8145C ONT router. View connected devices, block/unblock devices, and manage device nicknames through a clean, modern interface.

## Features

- 🔐 **Secure Authentication** - Login with your router credentials (encrypted session storage)
- 📱 **Device Management** - View all connected devices with real-time status
- 🚫 **WiFi Blocking** - Block/unblock devices from connecting to your WiFi
- 🏷️ **Device Nicknames** - Add friendly names to identify your devices
- 🎯 **Smart Filtering** - Filter by All, Online, Offline, or Blocked devices
- 📊 **Live Statistics** - See counts of total, online, offline, and blocked devices
- 🎨 **Modern UI** - Clean, responsive design with dark mode

## Screenshots

### Login
Enter your router IP, username, and password to connect securely.

### Dashboard
View all devices in a list format with filtering options and quick actions.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Router**: Huawei HG8145C ONT

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Access to a Huawei HG8145C router
- Router admin credentials

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd wifi-manager
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
SESSION_SECRET=your-random-32-character-secret-key-here
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### First Time Setup

1. Navigate to the login page
2. Enter your router details:
   - **Router IP**: Usually `192.168.100.1`
   - **Username**: Default is `telecomadmin`
   - **Password**: Your router admin password
3. Click "Connect" - your credentials will be validated against the router
4. Once logged in, you'll see the dashboard with all connected devices

## API Documentation

All API endpoints require authentication via session cookie. Login first to obtain a session.

### Authentication

#### POST `/api/auth/login`

Login with router credentials.

**Request Body:**
```json
{
  "ip": "192.168.100.1",
  "username": "telecomadmin",
  "password": "your-password"
}
```

**Response (Success - 200):**
```json
{
  "ok": true
}
```

**Response (Error - 401):**
```json
{
  "error": "Invalid router credentials or unable to connect to router."
}
```

**Response (Error - 400):**
```json
{
  "error": "Router IP, username, and password are required."
}
```

#### POST `/api/auth/logout`

Logout and destroy session.

**Response (200):**
```json
{
  "ok": true
}
```

---

### Devices

#### GET `/api/devices`

Get list of all connected devices with their status.

**Response (200):**
```json
{
  "devices": [
    {
      "mac": "AA:BB:CC:DD:EE:FF",
      "ip": "192.168.100.45",
      "hostname": "pixel-7",
      "status": "Online",
      "port": "SSID0",
      "leaseTime": "12:55",
      "alias": "Dad's Phone",
      "blocked": false
    }
  ]
}
```

**Response (401):**
```json
{
  "error": "Unauthorized"
}
```

**Response (502):**
```json
{
  "error": "Could not authenticate with router"
}
```

**Device Fields:**
- `mac` (string): Device MAC address
- `ip` (string): Device IP address
- `hostname` (string): Device hostname from DHCP
- `status` (string): "Online" or "Offline"
- `port` (string): Connection port (e.g., "SSID0", "LAN1")
- `leaseTime` (string, optional): DHCP lease remaining time
- `alias` (string | null): Custom nickname for the device
- `blocked` (boolean): Whether device is blocked from WiFi

---

### Device Blocking

#### POST `/api/block`

Block or unblock a device from connecting to WiFi.

**Request Body:**
```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "action": "block"
}
```

**Parameters:**
- `mac` (string, required): Device MAC address (case-insensitive)
- `action` (string, required): Either "block" or "unblock"

**Response (Success - 200):**
```json
{
  "ok": true
}
```

**Response (Error - 400):**
```json
{
  "error": "mac and action are required."
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized"
}
```

**Response (Error - 500):**
```json
{
  "error": "Failed to block device on router"
}
```

**Notes:**
- Blocking adds the MAC to the router's WLAN MAC filter blacklist
- Unblocking removes the MAC from the router's filter
- Changes take effect immediately
- Blocked devices will be disconnected from WiFi

---

### Device Aliases

#### POST `/api/alias`

Add or update a friendly nickname for a device.

**Request Body:**
```json
{
  "mac": "AA:BB:CC:DD:EE:FF",
  "alias": "Dad's Phone"
}
```

**Parameters:**
- `mac` (string, required): Device MAC address
- `alias` (string, required): Friendly name for the device (empty string to remove)

**Response (Success - 200):**
```json
{
  "ok": true
}
```

**Response (Error - 400):**
```json
{
  "error": "mac and alias are required."
}
```

**Response (Error - 401):**
```json
{
  "error": "Unauthorized"
}
```

**Notes:**
- Aliases are stored locally in `data/aliases.json`
- Aliases persist across sessions
- Use empty string to remove an alias

---

## Project Structure

```
wifi-manager/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts      # Router authentication
│   │   │   └── logout/route.ts     # Session destruction
│   │   ├── alias/route.ts          # Device nickname management
│   │   ├── block/route.ts          # Block/unblock devices
│   │   ├── devices/route.ts        # Get all devices
│   │   └── wifi/route.ts           # WiFi control (future)
│   ├── dashboard/page.tsx          # Main dashboard UI
│   ├── login/page.tsx              # Login page
│   └── page.tsx                    # Landing/redirect page
├── lib/
│   ├── auth.ts                     # Authentication & session
│   ├── router.ts                   # Router API client
│   ├── aliases.ts                  # Device alias storage
│   └── blocked.ts                  # Blocked devices (deprecated)
├── data/
│   └── aliases.json                # Persisted device nicknames
└── public/                         # Static assets
```

## How It Works

### Router Communication

The app communicates with the Huawei HG8145C router using its web interface API:

1. **Authentication**: Uses the router's login.cgi with base64-encoded password and CSRF token
2. **Device List**: Parses GetLanUserDevInfo.asp for connected device information
3. **MAC Filtering**: Uses wlanmacfilter.asp to manage WiFi access control
4. **Blocking**: Adds MAC addresses to the router's WLAN MAC filter blacklist
5. **Unblocking**: Removes MAC addresses from the filter using del.cgi

### Session Management

- Router credentials are encrypted using AES-256-CBC
- Encrypted credentials stored in HttpOnly secure cookie
- Session expires after 8 hours of inactivity
- Each API request re-authenticates with the router using stored credentials

### Data Storage

- **Aliases**: Stored in `data/aliases.json` (local file)
- **Blocked Devices**: Read directly from router's WLAN MAC filter (single source of truth)
- **Session**: Encrypted in HttpOnly cookie

## Security Considerations

- ✅ Router credentials encrypted with AES-256
- ✅ HttpOnly cookies prevent XSS attacks
- ✅ Credentials validated against actual router
- ✅ Session timeout after 8 hours
- ✅ CSRF protection via router tokens
- ⚠️ Use HTTPS in production
- ⚠️ Keep SESSION_SECRET secure and random

## Environment Variables

Create a `.env.local` file:

```bash
# Required: Session encryption key (32+ characters, random)
SESSION_SECRET=your-random-32-character-secret-key-here
```

## Troubleshooting

### Cannot connect to router
- Verify router IP is correct (usually `192.168.100.1`)
- Check that you're on the same network as the router
- Confirm router credentials are correct
- Try accessing router web interface directly first

### Devices not showing
- Ensure router login credentials are valid
- Check if devices are actually connected to WiFi
- Refresh the page to fetch latest device list

### Blocking not working
- Verify you have admin access to the router
- Check router's WLAN MAC filter settings manually
- Some devices may need WiFi toggle to reconnect after unblocking

### Session expires frequently
- Increase `maxAge` in `lib/auth.ts` createSession function
- Default is 8 hours (28800 seconds)

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
npm start
```

### Linting
```bash
npm run lint
```

## Limitations

- **Router Specific**: Only works with Huawei HG8145C ONT routers
- **Single User**: Designed for single-user access (no multi-user support)
- **Local Network**: Must be on the same network as the router
- **HTTP Only**: Router uses HTTP (not HTTPS)

## Future Enhancements

- [ ] Multi-router support
- [ ] Device usage statistics
- [ ] Scheduled blocking (parental controls)
- [ ] Device grouping
- [ ] Bandwidth monitoring
- [ ] Guest network management
- [ ] Mobile app

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Built with Next.js and Tailwind CSS
- Reverse-engineered Huawei HG8145C router API
- Inspired by the need for better home network management

---

**Note**: This project is not affiliated with or endorsed by Huawei. Use at your own risk.
