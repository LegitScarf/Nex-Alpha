import { clerkMiddleware } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export default clerkMiddleware((auth, req) => {
  const { userId } = auth()
  
  // Protect the dashboard root route
  if (req.nextUrl.pathname === '/') {
    if (!userId) {
      // Redirect back to landing page login portal
      return NextResponse.redirect('http://localhost:3000/sign-in')
    }
  }
})

export const config = {
  matcher: ['/'],
}
