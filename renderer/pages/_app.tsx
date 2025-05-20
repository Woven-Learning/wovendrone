import React from 'react'
import type { AppProps } from 'next/app'
import BuildInfo from '../components/BuildInfo'

import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="relative min-h-screen">
      <BuildInfo className="absolute top-2 right-4 z-50" />
      <Component {...pageProps} />
    </div>
  )
}

export default MyApp
