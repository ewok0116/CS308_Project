const admin = require('firebase-admin');

// Initialize using Application Default Credentials (set GOOGLE_APPLICATION_CREDENTIALS env var)
// Fallback: If you insist on a file, set SERVICE_ACCOUNT_PATH env var to a JSON file
const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
if (serviceAccountPath) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
	});
} else {
    admin.initializeApp({
		credential: admin.credential.applicationDefault(),
	});
}

async function main() {
	const firestore = admin.firestore();

	// List top-level collections and show up to 20 documents from each
	try {
		const collections = await firestore.listCollections();
		if (collections.length === 0) {
			console.log('(No collections found yet)');
			return;
		}

		console.log('Connected to Firestore. Collections and sample documents:');
		for (const col of collections) {
			console.log(`\nCollection: ${col.id}`);
			const snapshot = await col.limit(20).get();
			if (snapshot.empty) {
				console.log('  (No documents)');
				continue;
			}
			let count = 0;
			snapshot.forEach((doc) => {
				count += 1;
				console.log(`  - ${doc.id}:`, doc.data());
			});
			if (count === 20) {
				console.log('  ... (showing first 20 documents)');
			}
		}
	} catch (err) {
		console.error('Failed to access Firestore:', err);
		process.exit(1);
	}
}

main();


