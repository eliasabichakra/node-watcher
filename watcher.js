const { MongoClient } = require('mongodb');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

async function watchReleases() {
  console.log('🔄 Connecting to MongoDB Atlas...');

  const uri = 'mongodb+srv://eliasabichacra89:LtpkfZOvyF4tdqWS@tag-version.im7c9hx.mongodb.net/?retryWrites=true&w=majority&appName=tag-version';
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

          // Step 1: Remove old wrapper.jar if exists
          const jarPath = path.join(__dirname, 'wrapper.jar');
          if (fs.existsSync(jarPath)) {
            fs.unlinkSync(jarPath);
            console.log('🗑️ Removed old wrapper.jar');
          }

          // Step 2: Download new wrapper.jar
          const downloadCommand = `wget "https://github.com/eliasabichakra/jar-release/releases/download/${tag}/wrapper.jar" -O ${jarPath}`;
          exec(downloadCommand, (err, stdout, stderr) => {
            if (err) {
              console.error('❌ Error downloading wrapper.jar:', stderr);
              return;
            }

            console.log('⬇️ Downloaded new wrapper.jar');

            // Step 3: Run the new jar
            const runCommand = `nohup java --enable-native-access=ALL-UNNAMED -jar ${jarPath} > ${path.join(__dirname, 'wrapper.log')} 2>&1 &`;
            exec(runCommand, (err, stdout, stderr) => {
              if (err) {
                console.error('❌ Error running wrapper.jar:', stderr);
                return;
              }

              console.log('🚀 New wrapper.jar started successfully.');
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
