const fs = require('fs');
const path = require('path');

const webPath = path.join(__dirname, '../../src/components/EresusApp.tsx');
const mobilePath = path.join(__dirname, '../app/index.tsx');

let content = fs.readFileSync(webPath, 'utf8');

// 1. Imports
content = content.replace(/['"]lucide-react['"]/g, "'lucide-react-native'");
content = content.replace(/['"]qrcode\.react['"]/g, "'react-native-qrcode-svg'"); // Needs lib

// Add RN imports
content = `import { View, Text, TouchableOpacity, ScrollView, TextInput, Image, Platform } from 'react-native';\n` + content;

// 2. HTML to RN Tags
content = content.replace(/<div/g, '<View');
content = content.replace(/<\/div>/g, '</View>');

content = content.replace(/<span/g, '<Text');
content = content.replace(/<\/span>/g, '</Text>');

content = content.replace(/<p/g, '<Text');
content = content.replace(/<\/p>/g, '</Text>');

content = content.replace(/<h[1-6]/g, '<Text');
content = content.replace(/<\/h[1-6]>/g, '</Text>');

content = content.replace(/<button/g, '<TouchableOpacity');
content = content.replace(/<\/button>/g, '</TouchableOpacity>');

// 3. Events
content = content.replace(/onClick={/g, 'onPress={');

// 4. Input handling (rough)
content = content.replace(/onChange={\(e\) => ([^}]+)\(e\.target\.value\)}/g, 'onChangeText={$1}');

// 5. Remove window / localStorage refs
content = content.replace(/window\.localStorage/g, 'AsyncStorage');
content = content.replace(/window\.navigator\.vibrate/g, 'false'); // Disable temp, use Platform.vibrate or expo-haptics
content = content.replace(/window\.AudioContext/g, 'null'); // AudioContext doesn't exist in RN
content = content.replace(/crypto\.randomUUID\(\)/g, 'Crypto.randomUUID()');

// 6. Fix class mappings
// React Native / NativeWind doesn't support some pseudo-classes easily or uses different syntax, but NativeWind v4 handles most.

fs.writeFileSync(mobilePath, content);
console.log('Migration script completed. Output saved to ' + mobilePath);
