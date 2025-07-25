// /scripts/migrate-db.js (CommonJS version)

const { MongoClient } = require("mongodb");
const dotenv = require("dotenv");
dotenv.config();

const uri = process.env.MONGODB_URI;

async function migrate() {
  const client = new MongoClient(uri);
  try {
    await client.connect();

    const oldDb = client.db("quickcart");
    const newDb = client.db("CommerceCraft");

    const collectionsToMigrate = ["users", "orders", "products", "addresses"];

    for (const collectionName of collectionsToMigrate) {
      const sourceCollection = oldDb.collection(collectionName);
      const docs = await sourceCollection.find({}).toArray();

      if (docs.length > 0) {
        await newDb.collection(collectionName).insertMany(docs);
        console.log(`✅ Migrated ${docs.length} documents to CommerceCraft.${collectionName}`);
      } else {
        console.log(`⚠️ No documents found in quickcart.${collectionName}`);
      }
    }

    console.log("🎉 Migration completed successfully!");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.close();
  }
}

migrate();
