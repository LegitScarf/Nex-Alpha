import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Load Cabinet Grotesk, Satoshi, and JetBrains Mono fonts from Fontshare CDN */}
        <link 
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,900&f[]=satoshi@900,700,500,400,300&f[]=jet-brains-mono@700,500,400,300&display=swap" 
          rel="stylesheet" 
        />
        <meta name="description" content="NexAlpha - Omega Advanced Agentic Business Analytics & Intelligent Workflow Automation." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
