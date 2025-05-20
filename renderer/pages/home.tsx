import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Image from 'next/image'
import { Play, Gamepad2, Settings, ExternalLink } from 'lucide-react'
import { useRouter } from 'next/router'

export default function HomePage() {
  const router = useRouter();
  const [konamiSequence, setKonamiSequence] = useState<string[]>([]);
  const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const newSequence = [...konamiSequence, event.key];
      
      // Keep only the last 10 keys
      if (newSequence.length > 10) {
        newSequence.shift();
      }
      
      setKonamiSequence(newSequence);

      // Check if the sequence matches the Konami code
      if (newSequence.length === 10 && 
          newSequence.every((key, index) => key.toLowerCase() === konamiCode[index].toLowerCase())) {
        router.push('/secret');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [konamiSequence, router]);

  return (
    <React.Fragment>
      <Head>
        <title>WovenDrone</title>
      </Head>
      <div className="absolute top-8 left-8">
            <Image
              src="/images/drone-32.jpg"
              alt="Drone"
              width={150}
              height={150}
              className="rounded-lg"
            />
          </div>
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl mx-auto text-center relative">
          {/* Drone Image */}
        
          
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/images/woven.jpg"
              alt="Woven Logo"
              width={350} 
              height={350}
              className="mx-auto"
            />
          </div>

          <h1 className="text-4xl font-bold mb-8 text-gray-900">
            Welcome to WovenDrone
          </h1>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
            <Link href="/program">
              <div className="bg-gray-900 p-6 rounded-lg shadow-sm hover:bg-gray-800 transition-colors duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <Play className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-semibold">Flight Planner</h2>
                </div>
                <p className="text-gray-400">Create and edit drone flight plans using blocks.</p>
              </div>
            </Link>

            <Link href="/manual">
              <div className="bg-gray-900 p-6 rounded-lg shadow-sm hover:bg-gray-800 transition-colors duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <Gamepad2 className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-semibold">Manual Control</h2>
                </div>
                <p className="text-gray-400">Control the drone manually using keyboard.</p>
              </div>
            </Link>

            <Link href="/debug">
              <div className="bg-gray-900 p-6 rounded-lg shadow-sm hover:bg-gray-800 transition-colors duration-200">
                <div className="flex items-center gap-3 mb-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  <h2 className="text-xl font-semibold">Setup</h2>
                </div>
                <p className="text-gray-400">Initial drone set up for weight and balance.</p>
              </div>
            </Link>
          </div>

          {/* About Woven Section */}
          <div className="mt-12 bg-gray-200/90 p-8 rounded-lg border border-gray-300">
            <Link 
              href="https://wovenlearning.org/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block hover:opacity-90 transition-opacity"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-3">About Woven: Equity in Education</h2>
              <p className="text-gray-600 text-lg leading-relaxed">
                Programs and workshops include robotics, electronics, programming/coding, game design, 3D design and printing, and more.
              </p>
              <div className="mt-4 text-blue-600 hover:text-blue-700 transition-colors inline-flex items-center gap-2">
                Learn more at wovenlearning.org
                <ExternalLink className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </React.Fragment>
  )
}
