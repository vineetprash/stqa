#!/bin/bash

# SSL Certificate Generation Script for EC2
# This creates self-signed certificates for development/testing

echo "🔐 Generating Self-Signed SSL Certificates for EC2..."

# Get EC2 public IP (or use localhost if not on EC2)
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "localhost")
echo "📍 Using IP/Domain: $EC2_IP"

# Generate private key
echo "🔑 Generating private key..."
openssl genrsa -out key.pem 2048

# Generate certificate signing request
echo "📝 Generating certificate signing request..."
openssl req -new -key key.pem -out cert.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=$EC2_IP"

# Generate self-signed certificate
echo "📜 Generating self-signed certificate..."
openssl x509 -req -in cert.csr -signkey key.pem -out cert.pem -days 365

# Set proper permissions
chmod 600 key.pem cert.pem

# Clean up
rm cert.csr

echo "✅ SSL certificates generated successfully!"
echo "📁 Files created:"
echo "   - key.pem (private key)"
echo "   - cert.pem (certificate)"
echo ""
echo "⚠️  Note: This is a self-signed certificate for development only."
echo "   Browsers will show security warnings."
echo ""
echo "🚀 To use HTTPS, set USE_HTTPS=true in your .env file"