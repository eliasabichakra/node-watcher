const { MongoClient } = require('mongodb');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config(); // Load variables from .env


async function watchReleases() {
    console.log('🔄 Connecting to MongoDB Atlas...');

    const uri = process.env.MONGO_URI;
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log('✅ Connected to MongoDB Atlas. Watching for new tag releases...');

        const db = client.db('tags');
        const collection = db.collection('tag-version');

        const changeStream = collection.watch();

        changeStream.on('change', async (change) => {
            if (change.operationType === 'insert' || change.operationType === 'update') {
                const tag = change.operationType === 'insert'
                    ? change.fullDocument.tag
                    : change.updateDescription.updatedFields.tag;

                if (tag) {
                    console.log(`📦 New tag detected: ${tag}`);

                    const jarName = `wrapper-${tag}.jar`;
                    const jarPath = path.join(__dirname, '..', jarName);  // /app/wrapper-{tag}.jar
                    const logPath = path.join(__dirname, '..', 'wrapper.log');  // /app/wrapper.log

                    // Optional: clean up old jars except the current one
                    const appDir = path.join(__dirname, '..');
                    fs.readdirSync(appDir).forEach(file => {
                        if (file.startsWith('wrapper-') && file !== jarName) {
                            fs.unlinkSync(path.join(appDir, file));
                            console.log(`🗑️ Removed old JAR file: ${file}`);
                        }
                    });

                    // Step 2: Download new wrapper-{tag}.jar
                    const downloadCommand = `wget "https://github.com/eliasabichakra/jar-release/releases/download/${tag}/wrapper.jar" -O ${jarPath}`;
                    exec(downloadCommand, (err, stdout, stderr) => {
                        if (err) {
                            console.error('❌ Error downloading wrapper.jar:', stderr);
                            return;
                        }

                        console.log(`⬇️ Downloaded new wrapper: ${jarName}`);

                        // Step 3: Run the new jar
                        const runCommand = `nohup java --enable-native-access=ALL-UNNAMED -jar ${jarPath} > ${logPath} 2>&1 &`;
                        exec(runCommand, (err, stdout, stderr) => {
                            if (err) {
                                console.error('❌ Error running wrapper.jar:', stderr);
                                return;
                            }

                            console.log(`🚀 New wrapper.jar (${jarName}) started successfully.`);
                        });
                    });
                }
            }
        });
    } catch (err) {
        console.error('❌ Connection error:', err);
    }
}

watchReleases();
