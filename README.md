# WovenDrone

WovenDrone is an open-source Electron application built with Next.js and TypeScript for drone control through a graphical interface. 

In the Woven Learning Drone program, students aren't just flying drones – they're becoming the engineers and programmers behind them through the incredible ESP32 Drone project. This hands-on experience allows students to dive deep into the mechanics of unmanned aerial vehicles. From the very first step of soldering the intricate motor connections to ensuring the drone's weight is perfectly balanced for optimal flight, students gain practical skills. They'll progress from mastering manual flight controls, understanding the physics of aerial movement, to the exciting challenge of building and soldering their own custom controllers using Makey Makey boards. This project provides a unique opportunity to explore electronics, engineering, and computer science in an incredibly engaging and tangible way.

[![Sponsored by Woven Learning](https://img.shields.io/badge/Sponsored%20by-Woven%20Learning-blue)](https://wovenlearning.org/)



## Features

- **Manual Control Mode**: Direct real-time control using keyboard inputs. Perfect for testing, developing flight skills, and building custom joystick flight controllers. Offers intuitive, responsive control for pilots of all experience levels.

- **Flight Planning Mode**: Program complex drone flight sequences through a visual interface. Ideal for educational purposes, teaching programming concepts, logical thinking, and algorithmic design. Create and save reusable flight patterns that can be executed with precision.

- **Cross-platform support** for Mac and Windows

## Getting Started

### Hardware Requirements

- **Drone**: ESP32-S2 drone (tested with [ESP32-S2-Drone v1.2](https://docs.espressif.com/projects/espressif-esp-drone/en/latest/gettingstarted.html))

### Prerequisites

- [Node.js](https://nodejs.org/) (14.x or later)
- npm (included with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/wovendrone.git
cd wovendrone

# Install dependencies
npm install

# Install Electron dependencies
npm run postinstall
```

### Development Mode

```bash
# Run in development mode with hot reloading
npm run dev
```

### Production Build

```bash
# Build for current platform
npm run build

# Build for Mac only
npm run build:mac

# Build for Windows only
npm run build:win

# Build for both Mac and Windows
npm run build:all
```

## Distribution

After running the build commands, the packaged applications will be available in the `dist` directory:

### For Mac Users
Distribute the DMG file:
- `WovenDrone-x.x.x-arm64.dmg` or `WovenDrone-x.x.x.dmg`

### For Windows Users
Distribute the setup installer:
- `WovenDrone Setup x.x.x.exe`

## Architecture

WovenDrone uses a client-server architecture:

- **Main Process (Electron backend)**: Handles UDP communication with the drone
- **Renderer Process (Next.js frontend)**: Provides the user interface

### Control Modes

#### Manual Mode (`/manual`)
The manual control interface provides real-time flight control through keyboard inputs:
- Arrow keys for directional movement (roll/pitch)
- Additional keys for altitude control (thrust) and rotation (yaw)
- Real-time feedback on drone status and orientation
- Great for testing hardware, practicing flight skills, and prototyping custom controllers

#### Flight Planning Mode (`/program`)
The programming interface allows users to create sequences of flight commands:
- Drag-and-drop interface for building flight sequences
- Support for basic programming concepts (loops, conditionals, variables)
- Visual feedback on the planned flight path
- Execute, pause, and modify flight plans in real-time
- Excellent educational tool for teaching programming concepts and logical thinking

### Communication Flow

1. Frontend establishes WebSocket connection to backend (port 3001)
2. User inputs are translated into drone commands in frontend
3. Commands sent via WebSocket to the main process
4. Main process formats commands as UDP packets
5. UDP packets sent to drone on port 2390

## Drone Protocol

The application communicates with the ESP32-S2 drone via UDP on port 2390. Control packets include parameters for thrust, roll, pitch, and yaw.

For more information about the ESP32-S2-Drone, please visit the [official documentation](https://docs.espressif.com/projects/espressif-esp-drone/en/latest/gettingstarted.html).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## About Woven Learning

Woven Learning weaves hands-on STEAM practice, character education, and open-source collaboration into a single fabric of equitable, inquiry-driven learning. Founded by teachers who saw the power of games like Minecraft to unlock curiosity, the organization now offers modular workshops—from robotics and coding to 3-D design and drone flight—designed to help every learner "dream big" and build real-world skills, especially in underserved communities.

- **Mission-first 501(c)(3)**: Our mission is to inspire and equip children, parents, and educators through STEAM and character education so all kids can access tomorrow's opportunities.

- **Proven classroom DNA**: Starting as Minecrafter Camp in 2012 and formalized as Woven Learning in 2017, the program was built by educators who became co-learners with their students.

- **Inquiry + making**: Workshop menus span robotics, electronics, programming, game design, 3-D printing, and more—each framed around questions that matter to kids.

- **A "woven" approach**: Unlike simple blended-learning models that focus on tools, woven learning interlaces modalities around real capabilities learners need, producing deeper, context-rich growth.

Learn more at [wovenlearning.org](https://wovenlearning.org/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.