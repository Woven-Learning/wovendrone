import React, { useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import DroneControl from '../components/DroneControl'
import { Home } from 'lucide-react'

export default function ManualControlPage() {
  

  return (
    <React.Fragment>
      <Head>
        <title>Manual Control - Woven</title>
      </Head>
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-between mb-6">
          <Link 
            href="/home"
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors duration-200 bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-3xl font-bold text-center flex-1">Manual Drone Control</h1>
          {/* Empty div to balance the flex layout */}
          <div className="w-[105px]"></div>
        </div>
        <DroneControl />
      </div>
    </React.Fragment>
  )
}
