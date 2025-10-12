const fs = require('fs');
const path = require('path');

// Create a simple test image file
const createTestImage = () => {
  const fixturesDir = path.join(__dirname);
  
  // Create a minimal PNG file (1x1 pixel black PNG)
  const pngData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, etc.
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // Image data
    0xE2, 0x21, 0xBC, 0x33, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk size
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);

  const imagePath = path.join(fixturesDir, 'test-image.png');
  fs.writeFileSync(imagePath, pngData);
  
  // Also create a JPEG test file (simple JPEG header)
  const jpegData = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, // JPEG header
    0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, // JFIF
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, // More JFIF data
    0xFF, 0xD9 // End of JPEG
  ]);

  const jpegPath = path.join(fixturesDir, 'test-image.jpg');
  fs.writeFileSync(jpegPath, jpegData);
  
  return { imagePath, jpegPath };
};

// Create test files for different scenarios
const createTestFiles = () => {
  const fixturesDir = path.dirname(__filename);
  
  // Create sample text file
  const sampleText = `
Test Blog Post Content
=====================

This is a sample blog post for testing purposes. It contains:

1. Multiple paragraphs
2. Different formatting
3. Special characters: áéíóú ñüÑÜ 中文 🚀
4. Numbers and symbols: 123 !@#$%^&*()

Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

Testing Content:
- Bullet points
- More content
- Even more content

End of test content.
  `.trim();

  const textPath = path.join(fixturesDir, 'sample-content.txt');
  fs.writeFileSync(textPath, sampleText, 'utf8');

  // Create JSON test data
  const testData = {
    users: [
      {
        firstName: 'Test',
        lastName: 'User',
        email: 'testuser1@example.com',
        username: 'testuser1'
      },
      {
        firstName: 'Another',
        lastName: 'User',
        email: 'testuser2@example.com',
        username: 'testuser2'
      }
    ],
    posts: [
      {
        title: 'Sample Post 1',
        content: 'This is sample post content',
        tags: ['sample', 'test']
      },
      {
        title: 'Sample Post 2',
        content: 'This is another sample post',
        tags: ['sample', 'demo']
      }
    ]
  };

  const jsonPath = path.join(fixturesDir, 'test-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(testData, null, 2));

  return { textPath, jsonPath };
};

// Main execution
if (require.main === module) {
  try {
    console.log('🎨 Creating test fixtures...');
    
    const { imagePath, jpegPath } = createTestImage();
    console.log('✅ Test images created:');
    console.log(`   - PNG: ${imagePath}`);
    console.log(`   - JPEG: ${jpegPath}`);
    
    const { textPath, jsonPath } = createTestFiles();
    console.log('✅ Test files created:');
    console.log(`   - Text: ${textPath}`);
    console.log(`   - JSON: ${jsonPath}`);
    
    console.log('🎉 All test fixtures created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating test fixtures:', error);
    process.exit(1);
  }
}

module.exports = {
  createTestImage,
  createTestFiles
};