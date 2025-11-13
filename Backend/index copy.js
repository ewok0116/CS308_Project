const admin = require('firebase-admin');
const express = require('express');

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

const app = express();

// Basic health check
app.get('/health', (req, res) => {
	return res.json({ status: 'ok' });
});

// List top-level collection names
app.get('/collections', async (req, res) => {
	try {
		const firestore = admin.firestore();
		const collections = await firestore.listCollections();
		const names = collections.map((c) => c.id);
		return res.json({ collections: names });
	} catch (err) {
		console.error('Failed to list collections:', err);
		return res.status(500).json({ error: 'Failed to list collections' });
	}
});

// Return up to 20 documents from a collection
app.get('/collections/:name', async (req, res) => {
	const { name } = req.params;
	try {
		const firestore = admin.firestore();
		const snapshot = await firestore.collection(name).limit(20).get();
		const documents = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
		return res.json({ collection: name, count: documents.length, documents });
	} catch (err) {
		console.error(`Failed to read collection ${name}:`, err);
		return res.status(500).json({ error: `Failed to read collection ${name}` });
	}
});

// Root helper
app.get('/', (req, res) => {
	return res.json({
		message: 'Backend is running',
		endpoints: ['/health', '/collections', '/collections/:name']
	});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on http://localhost:${PORT}`);
});


