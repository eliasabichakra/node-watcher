require('dotenv').config();
const { MongoClient } = require('mongodb');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

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
                    const jarPath = path.join(__dirname, '..', jarName);
                    const logPath = path.join(__dirname, '..', `wrapper-${tag}.log`);
                    const appDir = path.join(__dirname, '..');

                    // Step 0: Kill running Java wrapper process
                    console.log(`🛑 Stopping any running Java wrapper processes...`);
                    exec(`pkill -f "java.*wrapper"`, (killErr) => {
                        if (killErr) {
                            console.warn('⚠️ No Java wrapper process found or error killing it.');
                        } else {
                            console.log('✅ Java wrapper process stopped.');
                        }

                        // Step 1: Remove old JARs and logs except the new tag ones
                        fs.readdirSync(appDir).forEach(file => {
                            if (
                                (file.startsWith('wrapper') && file.endsWith('.jar') && file !== jarName) 
                            ) {
                                const filePath = path.join(appDir, file);
                                fs.unlinkSync(filePath);
                                console.log(`🗑️ Removed old file: ${file}`);
                            }
                        });

                        // Step 2: Download the new jar
                        const downloadCommand = `wget "https://github.com/eliasabichakra/jar-release/releases/download/${tag}/wrapper.jar" -O ${jarPath}`;
                        console.log(`⬇️ Downloading new wrapper from GitHub...`);
                        exec(downloadCommand, (downloadErr, stdout, stderr) => {
                            if (downloadErr) {
                                console.error('❌ Error downloading new wrapper:', stderr);
                                return;
                            }

                            console.log(`✅ Downloaded new wrapper: ${jarName}`);

                            // Step 3: Ensure config.json exists
                            const configPath = path.join(__dirname, '..', 'config.json');
                            if (!fs.existsSync(configPath)) {
                                console.error('❌ config.json not found. Aborting.');
                                return;
                            }

                            // Step 4: Run the new jar with proper logging
                            const runCommand = `nohup java --enable-native-access=ALL-UNNAMED -jar ${jarPath} > ${logPath} 2>&1 &`;
                            exec(runCommand, (runErr) => {
                                if (runErr) {
                                    console.error('❌ Error starting new wrapper:', runErr);
                                } else {
                                    console.log(`🚀 Started new wrapper: ${jarName}, logging to ${logPath}`);
                                }
                            });
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
