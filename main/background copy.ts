import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { WebSocketServer } from 'ws'
import dgram from 'dgram'

const isProd: boolean = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

let mainWindow;

(async () => {
  await app.whenReady()

  mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

// UDP and WebSocket setup
const VERSION = '1.2.0'
const BUILD_DATE = '2024-12-28'

interface DroneCommand {
  thrust: number
  roll: number
  pitch: number
  yaw: number
}

const DRONE_PORT = 2390  // Fixed drone port
const SERVER_PORT = 2399 // Fixed server port
const DRONE_IP = '192.168.43.42' // Default drone IP
const WEB_PORT = 3001 // Web server port

// Create UDP socket with broadcast enabled
const udpClient = dgram.createSocket('udp4')
let isConnected = false
let lastCommand: DroneCommand = { thrust: 0, roll: 0, pitch: 0, yaw: 0 }
let commandInterval: NodeJS.Timeout | null = null

const COMMAND_INTERVAL = 50 // Send commands every 50ms

// Function to send the last command
const sendLastCommand = () => {
  if (!isConnected) return

  // Create buffer for command packet (16 bytes total)
  const buffer = Buffer.alloc(16)
  
  // Write header (1 byte)
  buffer[0] = 0x30  // Commander port (3) << 4 | 0
  
  // Scale thrust from 0-100 to 0-65535
  const thrustScaled = Math.max(0, Math.min(65535, Math.floor((lastCommand.thrust / 100) * 65535)))
  
  // Write command data in exact order matching CommanderPacket struct
  buffer.writeFloatLE(lastCommand.roll, 1)     // Roll (4 bytes, offset 1-4)
  buffer.writeFloatLE(lastCommand.pitch, 5)    // Pitch (4 bytes, offset 5-8)
  buffer.writeFloatLE(lastCommand.yaw, 9)      // Yaw (4 bytes, offset 9-12)
  buffer.writeUInt16LE(thrustScaled, 13)   // Thrust (2 bytes, offset 13-14)
  
  // Calculate CRC (sum of all bytes & 0xFF)
  let crc = 0
  for (let i = 0; i < 15; i++) {
    crc += buffer[i]
  }
  buffer[15] = crc & 0xFF

  udpClient.send(buffer, DRONE_PORT, DRONE_IP, (err) => {
    if (err) {
      console.error('Failed to send command:', err)
    }
  })
}

// Start sending commands when connected
const startCommandInterval = () => {
  if (commandInterval) {
    clearInterval(commandInterval)
  }
  commandInterval = setInterval(sendLastCommand, COMMAND_INTERVAL)
  console.log('Started command stream')
}

// Stop sending commands when disconnected
const stopCommandInterval = () => {
  if (commandInterval) {
    clearInterval(commandInterval)
    commandInterval = null
    console.log('Stopped command stream')
  }
}

// Bind UDP socket and enable broadcast
udpClient.bind(SERVER_PORT, () => {
  console.log(`UDP socket bound to port ${SERVER_PORT}`)
  udpClient.setBroadcast(true)
})

udpClient.on('message', (msg, rinfo) => {
  console.log(`Received response from ${rinfo.address}:${rinfo.port}:`, msg)
})

// Configure UDP socket
udpClient.on('error', (err) => {
  console.error('UDP socket error:', err)
  isConnected = false
  stopCommandInterval()
  // Notify all WebSocket clients of connection loss
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'connection_status', connected: false }))
    }
  })
})

// Create WebSocket server
const wss = new WebSocketServer({ port: WEB_PORT })

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected')
  ws.send(JSON.stringify({ type: 'connection_status', connected: isConnected }))

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString())
      
      switch (data.type) {
        case 'connect':
          try {
            const testPacket = Buffer.from([0x30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x30])
            udpClient.send(testPacket, DRONE_PORT, DRONE_IP, (err) => {
              if (err) {
                console.error('Connection failed:', err)
                ws.send(JSON.stringify({ type: 'connection_status', connected: false }))
              } else {
                console.log('Connected to drone')
                isConnected = true
                startCommandInterval()
                ws.send(JSON.stringify({ type: 'connection_status', connected: true }))
              }
            })
          } catch (error) {
            console.error('Connection error:', error)
            ws.send(JSON.stringify({ type: 'connection_status', connected: false }))
          }
          break

        case 'command':
          lastCommand = data.command
          break

        case 'disconnect':
          isConnected = false
          stopCommandInterval()
          ws.send(JSON.stringify({ type: 'connection_status', connected: false }))
          break
      }
    } catch (error) {
      console.error('Message error:', error)
    }
  })
})
