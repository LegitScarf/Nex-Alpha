import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()
  
  // Protect the dashboard root route
  if (req.nextUrl.pathname === '/') {
    if (!userId) {
      // Redirect back to landing page login portal
      const landingPageUrl = process.env.NEXT_PUBLIC_LANDING_PAGE_URL || 'http://localhost:3000'
      return NextResponse.redirect(`${landingPageUrl}/sign-in`)
    }
  }
})

export const config = {
  matcher: ['/'],
}
