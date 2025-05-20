import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Home } from 'lucide-react';

export default function SecretPage() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/home"
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-8"
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </Link>

        <div className="relative">
          <blockquote className="text-gray-800 text-xl leading-relaxed mb-8">
            "All y'all hate me 'cause I'm up. Everybody's like, 'Is it a UFO, is it military, is it promo for SNL 50?' 
            Meanwhile, I'm just minding my business, hovering over people's homes, maybe filming them. What is so threatening 
            about random machines in the night sky? God, it's like y'all have never been to Afghanistan before."
          </blockquote>

          <div className="fixed bottom-0 right-0 w-96 h-96">
            <div className="relative w-full h-full">
              <Image
                src="/images/snl.jpg"
                alt="SNL"
                layout="fill"
                objectFit="contain"
                className="object-right-bottom"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
