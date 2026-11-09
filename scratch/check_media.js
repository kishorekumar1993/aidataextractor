const fs = require('fs');

// We have media_1794064761686_71526ea6.png in .user_uploaded
console.log("Checking user uploaded images...");
const path1 = 'C:/Users/KISHORE KUMAR/.gemini/antigravity/brain/2b5da576-f753-4505-b2d6-c98fe30ebeed/.user_uploaded/media_1794064761686_71526ea6.png';
const path2 = 'C:/Users/KISHORE KUMAR/.gemini/antigravity/brain/2b5da576-f753-4505-b2d6-c98fe30ebeed/.user_uploaded/media_1794065357107_95355ba7.png';
console.log('Path 1 exists:', fs.existsSync(path1));
console.log('Path 2 exists:', fs.existsSync(path2));

