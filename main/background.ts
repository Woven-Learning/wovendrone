import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { WebSocketServer, WebSocket } from 'ws'
import dgram from 'dgram'

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

// Drone Control Setup
const DRONE_PORT = 2390
const SERVER_PORT = 2399
const DRONE_IP = '192.168.43.42'
const WEB_PORT = 3001

interface DroneCommand {
  thrust: number
  roll: number
  pitch: number
  yaw: number
}

// Function to compare DroneCommands
const commandsEqual = (a: DroneCommand, b: DroneCommand): boolean => {
  return a.thrust === b.thrust && 
         a.roll === b.roll && 
         a.pitch === b.pitch && 
         a.yaw === b.yaw;
}

let isConnected = false
let lastCommand: DroneCommand = { thrust: 0, roll: 0, pitch: 0, yaw: 0 }
let lastSentCommand: DroneCommand = { thrust: 0, roll: 0, pitch: 0, yaw: 0 }
let commandInterval: NodeJS.Timeout | null = null
let watchdogTimer: NodeJS.Timeout | null = null
let isSending = false // Flag to prevent overlapping sends
let sendTimeout: NodeJS.Timeout | null = null
let lastSendTime = Date.now()
let lastSendAttemptTime = Date.now()
const COMMAND_INTERVAL = 50  // Send commands every 50ms
const MIN_SEND_INTERVAL = 25 // Don't send faster than this
const WATCHDOG_TIMEOUT = 2000 // Reconnect if no successful sends for 2 seconds
const SEND_TIMEOUT = 500 // Timeout for individual UDP sends

// Create UDP socket
const udpClient = dgram.createSocket('udp4')

// Function to reset the watchdog timer
const resetWatchdog = () => {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer)
  }
  
  watchdogTimer = setTimeout(() => {
    // Only trigger watchdog if we haven't had a successful send in a while
    const now = Date.now()
    if (now - lastSendTime > WATCHDOG_TIMEOUT) {
      console.log(`Watchdog timeout - last successful send was ${now - lastSendTime}ms ago`)
      
      // Reset the sending state in case it got stuck
      isSending = false
      if (sendTimeout) {
        clearTimeout(sendTimeout)
        sendTimeout = null
      }
      
      // Try to reconnect
      if (isConnected) {
        console.log('Connection appears to be lost, reconnecting...')
        isConnected = false
        stopCommandInterval()
        
        // Notify all clients
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ 
              type: 'connection_status', 
              connected: false,
              error: 'Connection lost. Attempting to reconnect.'
            }))
          }
        })
        
        // Try to reconnect after a brief delay
        setTimeout(() => {
          if (!isConnected) {
            console.log('Attempting to reconnect...')
            // Send test packet to see if we can connect
            const testPacket = Buffer.from([0x30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x30])
            try {
              udpClient.send(testPacket, DRONE_PORT, DRONE_IP, (err) => {
                if (!err) {
                  console.log('Reconnection successful')
                  isConnected = true
                  startCommandInterval()
                  
                  // Notify all clients
                  wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                      client.send(JSON.stringify({ type: 'connection_status', connected: true }))
                    }
                  })
                } else {
                  console.error('Reconnection failed:', err)
                }
              })
            } catch (e) {
              console.error('Reconnection error:', e)
            }
          }
        }, 1000)
      }
    }
  }, WATCHDOG_TIMEOUT / 2) // Check at half the timeout period
}

// Function to send command to drone
const sendLastCommand = () => {
  if (!isConnected) return
  
  // Don't try to send if we're already in the process of sending
  if (isSending) {
    // If we've been "sending" for too long, reset the sending state
    if (Date.now() - lastSendAttemptTime > SEND_TIMEOUT) {
      console.log('Send operation timed out, resetting send state')
      isSending = false
      if (sendTimeout) {
        clearTimeout(sendTimeout)
        sendTimeout = null
      }
    } else {
      return
    }
  }
  
  // Rate limiting
  const now = Date.now()
  if (now - lastSendTime < MIN_SEND_INTERVAL) return
  
  // Mark as sending and set timeout to clear flag if send never completes
  isSending = true
  lastSendAttemptTime = now
  
  if (sendTimeout) clearTimeout(sendTimeout)
  sendTimeout = setTimeout(() => {
    console.log('Send timeout triggered - clearing sending flag')
    isSending = false
    sendTimeout = null
  }, SEND_TIMEOUT)
  
  // Always reset the watchdog when we attempt to send
  resetWatchdog()

  const buffer = Buffer.alloc(16)
  buffer[0] = 0x30
  
  const thrustScaled = Math.max(0, Math.min(65535, Math.floor((lastCommand.thrust / 100) * 65535)))
  
  buffer.writeFloatLE(lastCommand.roll, 1)
  buffer.writeFloatLE(lastCommand.pitch, 5)
  buffer.writeFloatLE(lastCommand.yaw, 9)
  buffer.writeUInt16LE(thrustScaled, 13)
  
  let crc = 0
  for (let i = 0; i < 15; i++) {
    crc += buffer[i]
  }
  buffer[15] = crc & 0xFF

  try {
    udpClient.send(buffer, DRONE_PORT, DRONE_IP, (err) => {
      // Always clear the sending flag and timeout
      isSending = false
      if (sendTimeout) {
        clearTimeout(sendTimeout)
        sendTimeout = null
      }
      
      if (err) {
        console.error('Failed to send command:', err)
        
        // Handle network unreachable error (ENETUNREACH)
        if (err.code === 'ENETUNREACH') {
          console.log('Network unreachable, disconnecting...')
          isConnected = false
          stopCommandInterval()
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ 
                type: 'connection_status', 
                connected: false,
                error: 'Network unreachable. Drone IP not accessible.'
              }))
            }
          })
        }
      } else {
        // Successful send
        lastSendTime = now
        lastSentCommand = { ...lastCommand }
        
        // Reset the watchdog since we had a successful send
        resetWatchdog()
      }
    })
  } catch (e) {
    // Handle any synchronous errors in the send operation
    console.error('UDP send error:', e)
    isSending = false
    if (sendTimeout) {
      clearTimeout(sendTimeout)
      sendTimeout = null
    }
  }
}

const startCommandInterval = () => {
  if (commandInterval) clearInterval(commandInterval)
  
  // Reset timers
  lastSendTime = Date.now()
  lastSendAttemptTime = Date.now()
  
  // Start the command interval
  commandInterval = setInterval(sendLastCommand, COMMAND_INTERVAL)
  
  // Initialize the watchdog
  resetWatchdog()
  
  // Reset flags
  isSending = false
  if (sendTimeout) {
    clearTimeout(sendTimeout)
    sendTimeout = null
  }
  
  console.log('Started command stream')
}

const stopCommandInterval = () => {
  if (commandInterval) {
    clearInterval(commandInterval)
    commandInterval = null
  }
  
  // Clear the watchdog
  if (watchdogTimer) {
    clearTimeout(watchdogTimer)
    watchdogTimer = null
  }
  
  // Clear any pending send timeouts
  if (sendTimeout) {
    clearTimeout(sendTimeout)
    sendTimeout = null
  }
  
  // Reset the sending flag
  isSending = false
  
  console.log('Stopped command stream')
}

// Initialize WebSocket server
const wss = new WebSocketServer({ port: WEB_PORT })

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected')
  ws.send(JSON.stringify({ type: 'connection_status', connected: isConnected }))

  ws.on('message', async (message: string) => {
    try {
      const data = JSON.parse(message.toString())
      console.log('Received WebSocket message:', data)
      
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
                lastCommand = { thrust: 0, roll: 0, pitch: 0, yaw: 0 }
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
          if (data.command && typeof data.command === 'object') {
            // Handle emergency commands (flush mode from the program page)
            if (data.queueMode === 'flush') {
              console.log('Emergency command received:', data.command)
              
              // Reset state and immediately apply this command
              isSending = false
              if (sendTimeout) {
                clearTimeout(sendTimeout)
                sendTimeout = null
              }
              
              // Set and send the command immediately
              lastCommand = data.command
              sendLastCommand()
            } else {
              // Regular command
              lastCommand = data.command
            }
          } else {
            console.error('Invalid command format:', data.command)
          }
          break

        case 'disconnect':
          isConnected = false
          stopCommandInterval()
          lastCommand = { thrust: 0, roll: 0, pitch: 0, yaw: 0 }
          ws.send(JSON.stringify({ type: 'connection_status', connected: false }))
          break
      }
    } catch (error) {
      console.error('Message error:', error)
    }
  })
})

// Setup UDP socket
udpClient.bind(SERVER_PORT, () => {
  console.log(`UDP socket bound to port ${SERVER_PORT}`)
  udpClient.setBroadcast(true)
})

udpClient.on('message', (msg, rinfo) => {
  console.log(`Received response from ${rinfo.address}:${rinfo.port}:`, msg)
})

udpClient.on('error', (err) => {
  console.error('UDP socket error:', err)
  isConnected = false
  stopCommandInterval()
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'connection_status', connected: false }))
    }
  })
})

// Electron app setup
;(async () => {
  await app.whenReady()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    //mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
