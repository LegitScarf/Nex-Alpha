import os
import requests
import jwt
from fastapi import FastAPI, Depends, HTTPException, status, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jwt.exceptions import PyJWTError

# Automatically load environment variables from Next.js .env.local
def load_env_vars():
    try:
        # Check standard root locations
        paths = [
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env.local"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
            ".env.local",
            ".env"
        ]
        for path in paths:
            if os.path.exists(path):
                print(f"Loading env parameters from: {path}")
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            key, val = line.split("=", 1)
                            # Only set if not already set by system
                            k = key.strip()
                            if k not in os.environ:
                                os.environ[k] = val.strip().strip('"').strip("'")
                break
    except Exception as e:
        print(f"Failed to auto-load local env configuration: {e}")

load_env_vars()

app = FastAPI(docs_url="/api/docs", openapi_url="/api/openapi.json")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clerk Configuration
CLERK_JWKS_URL = os.getenv("CLERK_JWKS_URL")
# If CLERK_JWKS_URL is not set, we can derive it from the frontend API or use a default Clerk endpoint
# Example: https://clerk.nexalpha.dev/.well-known/jwks.json or api.clerk.com/v1/jwks

# Global cache for JWKS keys to avoid requesting Clerk on every request
jwks_cache = None

import base64

def get_jwks_keys():
    global jwks_cache
    if jwks_cache is not None:
        return jwks_cache

    url = os.getenv("CLERK_JWKS_URL")
    headers = {}

    # If no explicit URL, try to decode the publishable key to get the public JWKS endpoint (no auth needed)
    if not url:
        pub_key = os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") or os.getenv("CLERK_PUBLISHABLE_KEY")
        if pub_key:
            try:
                parts = pub_key.split('_')
                if len(parts) >= 3:
                    encoded = parts[2]
                    padded = encoded + "=" * (4 - len(encoded) % 4)
                    decoded = base64.b64decode(padded).decode('utf-8')
                    domain = decoded.rstrip('$')
                    url = f"https://{domain}/.well-known/jwks.json"
            except Exception as e:
                print(f"Error parsing publishable key for JWKS: {e}")

    # Fallback to general Clerk JWKS endpoint which requires Secret Key Authorization
    if not url:
        url = "https://api.clerk.com/v1/jwks"
        secret_key = os.getenv("CLERK_SECRET_KEY")
        if secret_key:
            headers["Authorization"] = f"Bearer {secret_key}"

    try:
        print(f"Fetching JWKS keys from: {url}")
        response = requests.get(url, headers=headers, timeout=6)
        response.raise_for_status()
        jwks_cache = response.json().get("keys", [])
        return jwks_cache
    except Exception as e:
        print(f"Failed to fetch JWKS keys from Clerk: {e}")
        return []

def verify_clerk_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    
    token = authorization.split(" ")[1]
    keys = get_jwks_keys()
    
    if not keys:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWKS keys unavailable",
        )
        
    try:
        # Retrieve the key ID (kid) from the JWT header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token format: {str(e)}",
        )

    # Find the correct public key in JWKS
    public_key = None
    for key in keys:
        if key.get("kid") == kid:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
            break
            
    if not public_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown signing key",
        )

    try:
        # Verify the signature and claims
        # Note: In production, verify aud (audience) and iss (issuer) if desired.
        # We skip audience verification if Clerk frontend API client ID changes dynamically.
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False}
        )
        return payload
    except PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
        )

# Database / Product mapping
PRODUCT_URLS = {
    "omega": "https://omega-v2-nexalpha.streamlit.app/",
    "optitrade": "https://optitrade-nexalpha.streamlit.app/",
}

@app.get("/api")
def root():
    return {"status": "ok", "message": "NexAlpha FastAPI backend is running."}

@app.get("/api/launch")
def launch_product(
    product: str = Query(..., description="Product name (omega or optitrade)"),
    authorization: str = Depends(verify_clerk_token)
):
    """
    Validates user session and redirects to the public Streamlit dashboard.
    For production scale, we check publicMetadata tier access here.
    """
    prod_lower = product.lower()
    if prod_lower not in PRODUCT_URLS:
        raise HTTPException(status_code=404, detail="Product not found")

    user_id = authorization.get("sub")
    
    # We can check metadata for subscription tier. 
    # By default, Clerk passes metadata inside public_metadata or custom claims.
    # If the user sets up Clerk Metadata, it will be visible in the token payload.
    metadata = authorization.get("public_metadata", {})
    tier = metadata.get("tier", "free")
    
    # For now, let's log the launch and return the redirect URL.
    # In a more strict setup, we can restrict Omega/OptiTrade based on tiers.
    # OptiTrade might be Premium-only, Omega might have Free trials.
    
    return {
        "success": True,
        "product": prod_lower,
        "url": PRODUCT_URLS[prod_lower],
        "user_id": user_id,
        "tier": tier
    }
