import jwt
import time

sdk_key = "XbDofABNSRqqCzhC1Yf3hg"  # Your Client ID
sdk_secret = "F7g5ytE8o2Fr770Bhk1X00WFwCW3fw4h" # Your Client Secret

# Get current time in seconds since epoch
current_time = int(time.time())

# Set expiration times
# JWT expires in 1 hour
jwt_expiry = current_time + (60 * 60)
# SDK session token expires in 7 days
token_expiry = current_time + (60 * 60 * 24 * 7)

# Create the payload
payload = {
    "appKey": sdk_key,
    "iat": current_time,
    "exp": jwt_expiry,
    "tokenExp": token_expiry
}

# Create the header
header = {
    "alg": "HS256",
    "typ": "JWT"
}

# Generate the JWT token
# The 'HS256' algorithm uses the SDK Secret as the key
jwt_token = jwt.encode(payload, sdk_secret, algorithm="HS256", headers=header)

print("Generated JWT Token:")
print(jwt_token) 