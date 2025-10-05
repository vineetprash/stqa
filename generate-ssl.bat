@echo off
REM SSL Certificate Generation Script for Windows/EC2
REM This creates self-signed certificates for development/testing

echo 🔐 Generating Self-Signed SSL Certificates for EC2...

REM Check if OpenSSL is available
where openssl >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ OpenSSL not found. Please install OpenSSL first.
    echo 💡 Download from: https://slproweb.com/products/Win32OpenSSL.html
    pause
    exit /b 1
)

REM Try to get EC2 public IP, fallback to localhost
echo 📍 Detecting IP address...
powershell -Command "(Invoke-WebRequest -Uri 'http://169.254.169.254/latest/meta-data/public-ipv4' -TimeoutSec 5).Content" 2>nul > temp_ip.txt
set /p EC2_IP=<temp_ip.txt
if "%EC2_IP%"=="" set EC2_IP=localhost
del temp_ip.txt 2>nul
echo 📍 Using IP/Domain: %EC2_IP%

REM Generate private key
echo 🔑 Generating private key...
openssl genrsa -out key.pem 2048

REM Generate certificate signing request
echo 📝 Generating certificate signing request...
openssl req -new -key key.pem -out cert.csr -subj "/C=US/ST=State/L=City/O=Organization/CN=%EC2_IP%"

REM Generate self-signed certificate
echo 📜 Generating self-signed certificate...
openssl x509 -req -in cert.csr -signkey key.pem -out cert.pem -days 365

REM Clean up
del cert.csr

echo ✅ SSL certificates generated successfully!
echo 📁 Files created:
echo    - key.pem (private key)
echo    - cert.pem (certificate)
echo.
echo ⚠️  Note: This is a self-signed certificate for development only.
echo    Browsers will show security warnings.
echo.
echo 🚀 To use HTTPS, set USE_HTTPS=true in your .env file
pause