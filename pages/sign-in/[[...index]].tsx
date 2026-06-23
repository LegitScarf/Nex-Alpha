import { SignIn } from "@clerk/nextjs"
import Head from "next/head"

export default function SignInPage() {
  return (
    <>
      <Head>
        <title>Sign In - NexAlpha</title>
        <meta name="description" content="Access your NexAlpha dashboards securely." />
      </Head>
      <main className="min-h-screen grid-bg flex flex-col items-center justify-center p-6 relative">
        {/* Glow ambient background elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/15 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight gradient-text mb-2">
            NexAlpha
          </h1>
          <p className="text-gray-400">
            Sign in to unlock AI Analytics & Options Assistants
          </p>
        </div>

        <div className="shadow-2xl rounded-2xl overflow-hidden border border-white/5 neon-glow">
          <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
        </div>
      </main>
    </>
  )
}
