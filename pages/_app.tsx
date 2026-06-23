import type { AppProps } from 'next/app'
import { ClerkProvider } from '@clerk/nextjs'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_Y2xlcmsuY29tJA"}
      appearance={{
        variables: {
          colorPrimary: '#6366f1',
          colorBackground: '#0a0524',
          colorText: '#ffffff',
          colorTextSecondary: '#a0aec0',
          colorInputBackground: '#030014',
          colorInputText: '#ffffff',
          colorBorder: 'rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      <Component {...pageProps} />
    </ClerkProvider>
  )
}
