const { MongoClient } = require('mongodb');

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

    changeStream.on('change', (change) => {
      if (change.operationType === 'insert') {
        const tag = change.fullDocument.tag;
        console.log(`🚀 New tag detected (insert): ${tag}`);
      }

      if (change.operationType === 'update') {
        const updatedFields = change.updateDescription.updatedFields;
        if (updatedFields.tag) {
          console.log(`🔁 Tag updated to: ${updatedFields.tag}`);
        }
      }
    });
  } catch (err) {
    console.error('❌ Connection error:', err);
  }
}

watchReleases();
